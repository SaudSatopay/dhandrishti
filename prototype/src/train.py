"""Train DhanDrishti models and precompute dashboard payloads.

1. Probabilistic cash-flow forecaster: LightGBM quantile models (P10/P50/P90),
   direct multi-horizon (horizon-as-feature), 12-week horizon.
2. Early-warning risk classifier: P(distress within 8 weeks), time-split eval
   (AUC + median lead time), TreeSHAP reason codes mapped to a curated
   bilingual (EN/HI) vocabulary.
3. Rules overlay -> discrete flags + recommended interventions.
4. Writes models/*.txt, data/scores.json (per-enterprise payload),
   data/metrics.json (model card).
"""
from __future__ import annotations

import json
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score

from features import FEATURES, build_features

ROOT = Path(__file__).resolve().parents[1]
DATA, MODELS = ROOT / "data", ROOT / "models"

HORIZON = 12          # weeks ahead
LABEL_H = 8           # "distress within 8 weeks"
WARMUP = 16           # weeks of history before an enterprise is scoreable
SPLIT = 88            # week_idx < SPLIT -> train; >= SPLIT -> holdout
QUANTILES = [0.1, 0.5, 0.9]
N_WEEKS = 104

FC_FEATURES = FEATURES + ["horizon"]

# Domain monotonicity for the risk classifier (order must match FEATURES):
# risk falls with cash-flow level/trend, yoy revenue, runway, balance improvement,
# counterparty growth, digitalisation; rises with volatility, concentration, EMI burden.
MONOTONE = [-1, -1, 0, 1, -1,   # net_cf_ma4/ma8/ma12/std8/trend8
            0, 0, 1, -1,        # inflow_ma4/std8/cv8/yoy
            0, -1, 1, -1,       # upi_share/chg8, top_cp_share, cp_count_chg8
            -1, -1, 1,          # runway, balance_chg8, emi_to_inflow
            0, 0, 0, 0,         # mandi, rain, festival now/next6
            0, 0] + [0] * 6     # woy sin/cos + segments

# ---------------------------------------------------------------------------
# Bilingual reason-code vocabulary (feature group -> templates)
# ---------------------------------------------------------------------------
REASON_GROUPS = {
    "RUNWAY": ["runway_weeks", "balance_chg8"],
    "CASHFLOW_TREND": ["net_cf_trend8", "net_cf_ma4", "net_cf_ma8", "net_cf_ma12"],
    "INFLOW_DROP": ["inflow_yoy", "inflow_ma4"],
    "VOLATILITY": ["inflow_cv8", "net_cf_std8", "inflow_std8"],
    "CONCENTRATION": ["top_cp_share", "cp_count_chg8"],
    "EMI_BURDEN": ["emi_to_inflow"],
    "DIGITAL_SLIDE": ["upi_share_chg8", "upi_share"],
    "SEASONALITY": ["festival_next6", "festival_now", "woy_sin", "woy_cos"],
    "MARKET": ["mandi_mom8", "rain_anom"],
}

def reason_text(code: str, r: pd.Series) -> tuple[str, str]:
    if code == "RUNWAY":
        v = max(0.0, r.runway_weeks)
        return (f"Cash runway is only {v:.1f} weeks of expenses",
                f"नकद भंडार केवल {v:.1f} सप्ताह के खर्च जितना बचा है")
    if code == "CASHFLOW_TREND":
        return ("Net cash flow has been on a declining trend for ~8 weeks",
                "पिछले ~8 सप्ताह से शुद्ध नकदी प्रवाह लगातार घट रहा है")
    if code == "INFLOW_DROP":
        v = -100 * min(0.0, 0.0 if pd.isna(r.inflow_yoy) else r.inflow_yoy)
        if v >= 1:
            return (f"Revenue is down ~{v:.0f}% vs the same season last year",
                    f"आय पिछले वर्ष की इसी अवधि से लगभग {v:.0f}% कम है")
        return ("Revenue is below its recent baseline",
                "आय अपने सामान्य स्तर से नीचे चल रही है")
    if code == "VOLATILITY":
        return ("Weekly inflows have become unusually erratic",
                "साप्ताहिक आमदनी असामान्य रूप से अनियमित हो गई है")
    if code == "CONCENTRATION":
        v = 100 * r.top_cp_share
        return (f"A single buyer accounts for ~{v:.0f}% of inflows",
                f"एक ही खरीदार से लगभग {v:.0f}% आमदनी आती है — जोखिम केंद्रित है")
    if code == "EMI_BURDEN":
        v = 100 * r.emi_to_inflow
        return (f"Loan EMIs consume ~{v:.0f}% of average inflows",
                f"ऋण की किस्तें औसत आमदनी का लगभग {v:.0f}% ले रही हैं")
    if code == "DIGITAL_SLIDE":
        return ("Digital payment share is sliding — activity may be moving off the rails",
                "डिजिटल भुगतान का हिस्सा घट रहा है — कारोबार नकद की ओर खिसक रहा है")
    if code == "SEASONALITY":
        return ("A low-demand season lies ahead for this segment",
                "इस व्यवसाय के लिए आगे कम मांग का मौसम है")
    if code == "MARKET":
        return ("Local market conditions (mandi prices / rainfall) are adverse",
                "स्थानीय बाज़ार की स्थितियाँ (मंडी भाव/वर्षा) प्रतिकूल हैं")
    return (code, code)


FLAG_META = {
    "LIQUIDITY_CRUNCH_AHEAD": dict(
        sev=3,
        en=lambda d: f"Stress-case projection: balance dips below zero in {d['w']} week(s)",
        hi=lambda d: f"तनाव-परिदृश्य में {d['w']} सप्ताह में शेष राशि शून्य से नीचे जा सकती है",
        ien="Pre-approve a short-term working-capital line now; schedule a field visit this week",
        ihi="अभी अल्पकालिक कार्यशील-पूंजी सीमा स्वीकृत करें; इसी सप्ताह क्षेत्र भ्रमण तय करें"),
    "NEGATIVE_TREND": dict(
        sev=2,
        en=lambda d: f"Net cash flow declining ≈ ₹{d['x']:,.0f}/week over the last 8 weeks",
        hi=lambda d: f"पिछले 8 सप्ताह में शुद्ध नकदी प्रवाह ≈ ₹{d['x']:,.0f}/सप्ताह की दर से घट रहा है",
        ien="Field visit to diagnose demand loss; review inventory purchases against sales",
        ihi="मांग घटने का कारण जानने हेतु भ्रमण करें; बिक्री के अनुरूप स्टॉक खरीद की समीक्षा करें"),
    "EMI_STRESS": dict(
        sev=2,
        en=lambda d: f"EMIs take ~{d['x']:.0f}% of average weekly inflows",
        hi=lambda d: f"किस्तें औसत साप्ताहिक आमदनी का लगभग {d['x']:.0f}% ले रही हैं",
        ien="Consider restructuring the EMI schedule to match post-harvest / festival cash cycles",
        ihi="किस्तों को फसल-कटाई/त्योहार के नकदी-चक्र के अनुसार पुनर्गठित करने पर विचार करें"),
    "REVENUE_CONCENTRATION": dict(
        sev=1,
        en=lambda d: f"Top counterparty = {d['x']:.0f}% of inflows (segment norm ≈ {d['y']:.0f}%)",
        hi=lambda d: f"एक ही खरीदार से {d['x']:.0f}% आमदनी (क्षेत्र का सामान्य स्तर ≈ {d['y']:.0f}%)",
        ien="Support buyer diversification — ONDC listing, local haat and SHG-network linkages",
        ihi="खरीदार विविधता बढ़ाएँ — ONDC सूचीकरण, स्थानीय हाट व SHG नेटवर्क से जुड़ाव"),
    "PAYMENT_IRREGULARITY": dict(
        sev=1,
        en=lambda d: f"Inflow volatility is {d['x']:.1f}× the segment norm",
        hi=lambda d: f"आमदनी में उतार-चढ़ाव क्षेत्र के सामान्य स्तर का {d['x']:.1f} गुना है",
        ien="Verify billing hygiene; enable QR collection at point of sale",
        ihi="बिलिंग व्यवस्था जाँचें; बिक्री-स्थल पर QR से वसूली शुरू कराएँ"),
    "SEASONAL_DIP_AHEAD": dict(
        sev=1,
        en=lambda d: f"Net cash outflow of ≈ ₹{d['x']:,.0f} expected over the next 6 weeks, with a thin buffer",
        hi=lambda d: f"अगले 6 सप्ताह में ≈ ₹{d['x']:,.0f} की शुद्ध नकदी-निकासी संभावित है, और बफ़र पतला है",
        ien="Build a cash buffer; defer discretionary purchases until the lean season passes",
        ihi="नकद बफ़र बनाएँ; गैर-ज़रूरी खरीदारी कम मांग का मौसम बीतने तक टालें"),
}


def pinball(y: np.ndarray, p: np.ndarray, q: float) -> float:
    d = y - p
    return float(np.mean(np.maximum(q * d, (q - 1) * d)))


def main() -> None:
    MODELS.mkdir(parents=True, exist_ok=True)
    ents = pd.read_csv(DATA / "enterprises.csv")
    weekly = pd.read_csv(DATA / "weekly.csv")
    events = pd.read_csv(DATA / "events.csv")

    df = build_features(weekly, ents)
    ev_week = dict(zip(events.enterprise_id, events.event_week))

    # ------------------------------------------------------------------ #
    # 1. Quantile cash-flow forecaster (direct multi-horizon)             #
    # ------------------------------------------------------------------ #
    print("== building forecast training set ==")
    net = df.pivot(index="week_idx", columns="enterprise_id", values="net_cash_flow")
    frames = []
    base = df[df.week_idx >= WARMUP][["enterprise_id", "week_idx"] + FEATURES].copy()
    for h in range(1, HORIZON + 1):
        f = base.copy()
        f["horizon"] = h
        tgt = net.shift(-h)  # value at week_idx + h
        f["y"] = [
            tgt.at[w, e] if w in tgt.index else np.nan
            for e, w in zip(f.enterprise_id, f.week_idx)
        ]
        frames.append(f)
    fc = pd.concat(frames, ignore_index=True).dropna(subset=["y"])
    fc_train = fc[fc.week_idx + fc.horizon <= SPLIT]
    fc_hold = fc[(fc.week_idx >= SPLIT - HORIZON) & (fc.week_idx < N_WEEKS - 1) & (fc.week_idx + fc.horizon > SPLIT)]
    print(f"forecast rows: train={len(fc_train):,} holdout={len(fc_hold):,}")

    q_models: dict[float, lgb.Booster] = {}
    for q in QUANTILES:
        params = dict(objective="quantile", alpha=q, learning_rate=0.06, num_leaves=63,
                      min_data_in_leaf=40, feature_fraction=0.85, bagging_fraction=0.8,
                      bagging_freq=1, verbose=-1, seed=42)
        dtr = lgb.Dataset(fc_train[FC_FEATURES], fc_train.y)
        m = lgb.train(params, dtr, num_boost_round=350)
        m.save_model(str(MODELS / f"forecast_q{int(q*100)}.txt"))
        q_models[q] = m

    # Holdout skill vs seasonal-naive baseline
    ph = {q: q_models[q].predict(fc_hold[FC_FEATURES]) for q in QUANTILES}
    yh = fc_hold.y.to_numpy()
    naive = []
    for e, w, h in zip(fc_hold.enterprise_id, fc_hold.week_idx, fc_hold.horizon):
        src = w + h - 52
        naive.append(net.at[src, e] if src in net.index else net[e].iloc[max(0, w - 4):w].mean())
    naive = np.array(naive)
    mae_p50 = float(np.mean(np.abs(yh - ph[0.5])))
    mae_naive = float(np.mean(np.abs(yh - naive)))
    coverage_raw = float(np.mean((yh >= ph[0.1]) & (yh <= ph[0.9])))

    # Conformalized quantile regression (CQR): per-horizon margin so that the
    # widened [P10-q, P90+q] band achieves ~80% coverage on the temporal holdout.
    hzn = fc_hold.horizon.to_numpy()
    conf_score = np.maximum(ph[0.1] - yh, yh - ph[0.9])
    cqr_margin = {}
    for h in range(1, HORIZON + 1):
        s = np.sort(conf_score[hzn == h])
        k = min(len(s) - 1, int(np.ceil(0.8 * (len(s) + 1))) - 1)
        cqr_margin[h] = float(max(0.0, s[k]))
    qh = np.array([cqr_margin[h] for h in hzn])
    coverage_cqr = float(np.mean((yh >= ph[0.1] - qh) & (yh <= ph[0.9] + qh)))

    fc_metrics = dict(
        mae_p50=round(mae_p50, 1), mae_seasonal_naive=round(mae_naive, 1),
        skill_vs_naive=round(1 - mae_p50 / mae_naive, 3),
        pinball_p10=round(pinball(yh, ph[0.1], 0.1), 1),
        pinball_p50=round(pinball(yh, ph[0.5], 0.5), 1),
        pinball_p90=round(pinball(yh, ph[0.9], 0.9), 1),
        p10_p90_coverage_raw=round(coverage_raw, 3),
        p10_p90_coverage_conformal=round(coverage_cqr, 3),
        holdout_rows=int(len(fc_hold)),
    )
    print("forecast metrics:", fc_metrics)

    # ------------------------------------------------------------------ #
    # 2. Early-warning classifier                                         #
    # ------------------------------------------------------------------ #
    print("== training risk classifier ==")
    cl = df[df.week_idx >= WARMUP].copy()
    ew = cl.enterprise_id.map(ev_week)
    cl["label"] = ((ew.notna()) & (cl.week_idx < ew) & (ew <= cl.week_idx + LABEL_H)).astype(int)
    # exclude in-distress / early-recovery weeks (we predict onset, not state)
    in_event = ew.notna() & (cl.week_idx >= ew) & (cl.week_idx <= ew + 12)
    cl = cl[~in_event]

    tr = cl[cl.week_idx < SPLIT]
    te = cl[cl.week_idx >= SPLIT]
    params = dict(objective="binary", metric="auc", learning_rate=0.04, num_leaves=15,
                  min_data_in_leaf=60, feature_fraction=0.7, bagging_fraction=0.8,
                  bagging_freq=1, monotone_constraints=MONOTONE,
                  scale_pos_weight=min(12.0, float((tr.label == 0).sum() / max(1, (tr.label == 1).sum()))),
                  verbose=-1, seed=42)
    clf = lgb.train(params, lgb.Dataset(tr[FEATURES], tr.label), num_boost_round=400)
    clf.save_model(str(MODELS / "risk_classifier.txt"))

    # Platt calibration on the temporal holdout (raw margin -> probability)
    margin_te = clf.predict(te[FEATURES], raw_score=True)
    platt = LogisticRegression(C=1e6, max_iter=1000)
    platt.fit(margin_te.reshape(-1, 1), te.label)
    proba_te = platt.predict_proba(margin_te.reshape(-1, 1))[:, 1]
    auc = float(roc_auc_score(te.label, proba_te))
    ap = float(average_precision_score(te.label, proba_te))

    # Lead time: how many weeks before the event does the score first cross 0.5?
    leads = []
    te_scored = te.assign(p=proba_te)
    for eid, ev in ev_week.items():
        if ev <= SPLIT:
            continue
        s = te_scored[(te_scored.enterprise_id == eid) & (te_scored.week_idx < ev) & (te_scored.p >= 0.5)]
        if len(s):
            leads.append(int(ev - s.week_idx.min()))
    clf_metrics = dict(
        auc=round(auc, 3), avg_precision=round(ap, 3),
        calibration="platt_on_temporal_holdout", monotone_constrained=True,
        median_lead_weeks=float(np.median(leads)) if leads else None,
        events_detected=len(leads),
        events_in_holdout=int(sum(1 for v in ev_week.values() if v > SPLIT)),
        train_rows=int(len(tr)), holdout_rows=int(len(te)),
        base_rate=round(float(te.label.mean()), 4),
    )
    print("classifier metrics:", clf_metrics)

    # ------------------------------------------------------------------ #
    # 3. Score every enterprise at the latest week                        #
    # ------------------------------------------------------------------ #
    print("== scoring latest week ==")
    last = df.sort_values("week_idx").groupby("enterprise_id").tail(1).set_index("enterprise_id")
    seg_top_share = last.groupby("segment")["top_cp_share"].median()
    seg_cv = last.groupby("segment")["inflow_cv8"].median()

    margin_last = np.asarray(clf.predict(last[FEATURES], raw_score=True))
    proba = platt.predict_proba(margin_last.reshape(-1, 1))[:, 1]
    contrib = clf.predict(last[FEATURES], pred_contrib=True)[:, :-1]  # drop bias
    fidx = {f: i for i, f in enumerate(FEATURES)}

    week_starts = pd.to_datetime(sorted(weekly.week_start.unique()))
    future_weeks = pd.date_range(week_starts[-1] + pd.Timedelta(weeks=1), periods=HORIZON, freq="W-MON")

    hist_df = df[df.week_idx >= N_WEEKS - 52]
    payload = {}
    for i, (eid, r) in enumerate(last.iterrows()):
        # forecast bands
        X = pd.DataFrame([r[FEATURES].astype(float)] * HORIZON)
        X["horizon"] = np.arange(1, HORIZON + 1)
        qs = {q: q_models[q].predict(X[FC_FEATURES]) for q in QUANTILES}
        band = np.sort(np.vstack([qs[0.1], qs[0.5], qs[0.9]]), axis=0)  # fix quantile crossing
        p10, p50, p90 = band
        m = np.array([cqr_margin[h] for h in range(1, HORIZON + 1)])
        p10, p90 = p10 - m, p90 + m  # conformal widening (80% target coverage)

        # projected balance paths (per-quantile cumulative path = scenario, not a true quantile of the sum)
        bal0 = float(r.closing_balance)
        path = {k: bal0 + np.cumsum(v) for k, v in (("p10", p10), ("p50", p50), ("p90", p90))}

        # ---- flags (rules overlay) ----
        flags = []
        neg = np.where(path["p10"] < 0)[0]
        if len(neg):
            d = {"w": int(neg[0] + 1)}
            sev = 3 if (len(np.where(path["p50"] < 0)[0]) or neg[0] < 4) else 2
            f = FLAG_META["LIQUIDITY_CRUNCH_AHEAD"]
            flags.append(dict(code="LIQUIDITY_CRUNCH_AHEAD", severity=sev,
                              detail_en=f["en"](d), detail_hi=f["hi"](d),
                              action_en=f["ien"], action_hi=f["ihi"]))
        drop8 = -float(r.net_cf_trend8) if not pd.isna(r.net_cf_trend8) else 0.0
        if drop8 > 0 and drop8 * 8 > 0.20 * max(1.0, float(r.inflow_ma4)):
            d = {"x": drop8}
            f = FLAG_META["NEGATIVE_TREND"]
            flags.append(dict(code="NEGATIVE_TREND", severity=2,
                              detail_en=f["en"](d), detail_hi=f["hi"](d),
                              action_en=f["ien"], action_hi=f["ihi"]))
        if float(r.emi_to_inflow) > 0.30:
            d = {"x": 100 * float(r.emi_to_inflow)}
            f = FLAG_META["EMI_STRESS"]
            flags.append(dict(code="EMI_STRESS", severity=2,
                              detail_en=f["en"](d), detail_hi=f["hi"](d),
                              action_en=f["ien"], action_hi=f["ihi"]))
        seg_norm = float(seg_top_share[r.segment])
        if float(r.top_cp_share) > max(0.60, seg_norm + 0.18):
            d = {"x": 100 * float(r.top_cp_share), "y": 100 * seg_norm}
            f = FLAG_META["REVENUE_CONCENTRATION"]
            flags.append(dict(code="REVENUE_CONCENTRATION", severity=1,
                              detail_en=f["en"](d), detail_hi=f["hi"](d),
                              action_en=f["ien"], action_hi=f["ihi"]))
        cv_ratio = float(r.inflow_cv8) / max(1e-6, float(seg_cv[r.segment]))
        if cv_ratio > 1.8:
            d = {"x": cv_ratio}
            f = FLAG_META["PAYMENT_IRREGULARITY"]
            flags.append(dict(code="PAYMENT_IRREGULARITY", severity=1,
                              detail_en=f["en"](d), detail_hi=f["hi"](d),
                              action_en=f["ien"], action_hi=f["ihi"]))
        cum6 = float(np.sum(p50[:6]))
        if cum6 < 0 and float(r.runway_weeks) < 8 and not len(neg):
            d = {"x": -cum6}
            f = FLAG_META["SEASONAL_DIP_AHEAD"]
            flags.append(dict(code="SEASONAL_DIP_AHEAD", severity=1,
                              detail_en=f["en"](d), detail_hi=f["hi"](d),
                              action_en=f["ien"], action_hi=f["ihi"]))
        flags.sort(key=lambda x: -x["severity"])

        # ---- reason codes from TreeSHAP contributions ----
        cvec = contrib[i]
        gscore = {}
        for code, feats in REASON_GROUPS.items():
            v = sum(cvec[fidx[f]] for f in feats if f in fidx)
            if v > 0:  # pushes toward distress
                gscore[code] = v
        top = sorted(gscore.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(v for _, v in top) or 1.0
        reasons = []
        for code, v in top:
            en, hi = reason_text(code, r)
            reasons.append(dict(code=code, weight=round(float(v / tot), 3), text_en=en, text_hi=hi))

        # Final score blends the calibrated model probability with the rules
        # overlay (noisy-OR), so flags and score can never contradict each other.
        sev_w = {3: 0.55, 2: 0.30, 1: 0.12}
        p_rules = 1.0 - float(np.prod([1 - sev_w[f["severity"]] for f in flags])) if flags else 0.0
        p_model = float(proba[i])
        score = float(100 * (1 - (1 - p_model) * (1 - p_rules)))
        tier = "HIGH" if score >= 60 else ("WATCH" if score >= 35 else "STABLE")

        h = hist_df[hist_df.enterprise_id == eid]
        payload[eid] = dict(
            id=eid, name=r["name"] if "name" in r else "", segment=r.segment,
            district=r.district, state=r.state,
            risk_score=round(score, 1), tier=tier,
            model_p=round(p_model, 3), rules_p=round(p_rules, 3),
            flags=flags, reasons=reasons,
            kpis=dict(
                inflow_ma4=round(float(r.inflow_ma4), 0),
                net_cf_ma4=round(float(r.net_cf_ma4), 0),
                runway_weeks=round(float(r.runway_weeks), 1),
                upi_share=round(float(r.upi_share), 3),
                top_cp_share=round(float(r.top_cp_share), 3),
                emi_to_inflow=round(float(r.emi_to_inflow), 3),
                closing_balance=round(bal0, 0),
            ),
            forecast=[dict(week=str(w.date()), p10=round(float(a), 0), p50=round(float(b), 0),
                           p90=round(float(c), 0))
                      for w, a, b, c in zip(future_weeks, p10, p50, p90)],
            balance_path=[dict(week=str(w.date()), p10=round(float(a), 0), p50=round(float(b), 0),
                               p90=round(float(c), 0))
                          for w, a, b, c in zip(future_weeks, path["p10"], path["p50"], path["p90"])],
            history=[dict(week=w, inflow=round(fi, 0), outflow=round(fo, 0), net=round(fn, 0),
                          balance=round(fb, 0), upi=round(fu, 3))
                     for w, fi, fo, fn, fb, fu in zip(
                         h.week_start, h.inflow_total, h.outflow_total,
                         h.net_cash_flow, h.closing_balance, h.upi_share)],
        )

    # attach names (last-row Series lost the registry columns not in features df)
    names = dict(zip(ents.enterprise_id, ents.name))
    for eid in payload:
        payload[eid]["name"] = names[eid]

    with open(DATA / "scores.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    tiers = pd.Series([p["tier"] for p in payload.values()]).value_counts().to_dict()
    metrics = dict(
        generated_at="2026-07-16",
        data=dict(n_enterprises=len(payload), n_weeks=N_WEEKS,
                  segments=sorted(ents.segment.unique().tolist()),
                  districts=sorted(ents.district.unique().tolist()),
                  tier_counts=tiers),
        forecaster=fc_metrics, classifier=clf_metrics,
    )
    with open(DATA / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    print("tier distribution:", tiers)
    print(f"wrote {DATA/'scores.json'} and {DATA/'metrics.json'}")


if __name__ == "__main__":
    main()
