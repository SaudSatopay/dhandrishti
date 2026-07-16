"""Synthetic-but-realistic weekly cash-flow data for rural micro enterprises.

Generates 200 enterprises across 6 segments and 8 districts, 104 weeks of
weekly history ending 2026-07-13, with:
  - segment-specific seasonality (harvest cycles, festival demand, monsoon)
  - UPI adoption drift, counterparty structure, EMI obligations
  - ground-truth distress episodes (revenue erosion ramps) for ~25% of
    enterprises, used to train and evaluate the early-warning classifier

Outputs (prototype/data/):
  enterprises.csv  - static registry
  weekly.csv       - weekly panel
  events.csv       - ground-truth distress events (generator-private)
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from pathlib import Path

RNG = np.random.default_rng(42)
OUT = Path(__file__).resolve().parents[1] / "data"

N_ENT = 200
N_WEEKS = 104
END_MONDAY = "2026-07-13"

SEGMENTS = {
    # base weekly revenue range (INR), monsoon sensitivity (- hurts), festival sensitivity
    "kirana":          dict(rev=(9_000, 45_000),  monsoon=-0.05, festival=0.35, cp=(25, 90), top_share=(0.05, 0.20)),
    "dairy":           dict(rev=(12_000, 60_000), monsoon=-0.02, festival=0.25, cp=(1, 4),   top_share=(0.70, 0.95)),
    "tailoring":       dict(rev=(6_000, 25_000),  monsoon=-0.18, festival=0.60, cp=(10, 40), top_share=(0.10, 0.30)),
    "agri_inputs":     dict(rev=(15_000, 80_000), monsoon=+0.10, festival=0.10, cp=(15, 60), top_share=(0.10, 0.30)),
    "food_processing": dict(rev=(10_000, 55_000), monsoon=-0.10, festival=0.45, cp=(5, 20),  top_share=(0.25, 0.55)),
    "handloom":        dict(rev=(5_000, 22_000),  monsoon=-0.12, festival=0.55, cp=(3, 15),  top_share=(0.30, 0.60)),
}

DISTRICTS = [
    ("Nashik", "Maharashtra"), ("Warangal", "Telangana"), ("Barabanki", "Uttar Pradesh"),
    ("Mandya", "Karnataka"), ("Nadia", "West Bengal"), ("Sabarkantha", "Gujarat"),
    ("Madurai", "Tamil Nadu"), ("Samastipur", "Bihar"),
]

FIRST = ["Lakshmi", "Ganga", "Shivam", "Annapurna", "Kisan", "Gram", "Surya", "Maa Durga",
         "Bharat", "Sona", "Hari Om", "Jai Kisan", "Radha", "Vikas", "Umang", "Sahyog",
         "Pragati", "Nandini", "Basant", "Chetna"]
KIND = {
    "kirana": "Kirana Store", "dairy": "Dairy Unit", "tailoring": "Tailors",
    "agri_inputs": "Agri Inputs", "food_processing": "Food Works", "handloom": "Handloom",
}


def festival_intensity(woy: np.ndarray) -> np.ndarray:
    """Smooth national demand curve: Diwali (~w43), wedding seasons, Holi, Eid, Pongal."""
    peaks = [(43, 3.0, 1.00), (46, 2.0, 0.45), (10, 1.5, 0.30), (17, 2.5, 0.35),
             (2, 1.5, 0.25), (28, 1.5, 0.15)]
    out = np.zeros_like(woy, dtype=float)
    for centre, width, amp in peaks:
        d = np.minimum(np.abs(woy - centre), 52 - np.abs(woy - centre))
        out += amp * np.exp(-0.5 * (d / width) ** 2)
    return out


def segment_seasonality(seg: str, woy: np.ndarray) -> np.ndarray:
    """Multiplicative seasonal curve per segment (1.0 = neutral)."""
    s = np.ones_like(woy, dtype=float)
    if seg == "dairy":  # flush season Nov-Feb, lean Apr-Jun
        s += 0.18 * np.cos((woy - 50) / 52 * 2 * np.pi)
    elif seg == "agri_inputs":  # kharif sowing (Jun-Jul) + rabi sowing (Oct-Nov)
        for centre, width, amp in [(25, 3.0, 0.55), (43, 3.0, 0.40), (14, 2.5, 0.15)]:
            d = np.minimum(np.abs(woy - centre), 52 - np.abs(woy - centre))
            s += amp * np.exp(-0.5 * (d / width) ** 2)
    elif seg == "food_processing":  # post-harvest gluts
        for centre, width, amp in [(47, 4.0, 0.35), (15, 3.0, 0.25)]:
            d = np.minimum(np.abs(woy - centre), 52 - np.abs(woy - centre))
            s += amp * np.exp(-0.5 * (d / width) ** 2)
    elif seg == "tailoring":  # school reopen + pre-wedding stitching
        for centre, width, amp in [(23, 2.5, 0.20), (40, 3.0, 0.25)]:
            d = np.minimum(np.abs(woy - centre), 52 - np.abs(woy - centre))
            s += amp * np.exp(-0.5 * (d / width) ** 2)
    return s


def rainfall_curve(woy: np.ndarray, anomaly: float) -> np.ndarray:
    """Weekly rainfall mm: monsoon Jun-Sep (w23-39), district-year anomaly."""
    d = np.minimum(np.abs(woy - 30), 52 - np.abs(woy - 30))
    base = 85 * np.exp(-0.5 * (d / 6.5) ** 2)
    return np.maximum(0, base * (1 + anomaly) + RNG.normal(0, 6, size=len(woy)))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    weeks = pd.date_range(end=END_MONDAY, periods=N_WEEKS, freq="W-MON")
    woy = weeks.isocalendar().week.to_numpy().astype(float)
    fest = festival_intensity(woy)

    # District-level series: mandi price index (random walk + seasonality), rainfall anomaly per year
    district_series = {}
    for dist, _state in DISTRICTS:
        drift = RNG.normal(0.0008, 0.0004)
        shocks = RNG.normal(0, 0.012, N_WEEKS)
        mandi = 100 * np.exp(np.cumsum(drift + shocks))
        mandi *= 1 + 0.06 * np.cos((woy - 47) / 52 * 2 * np.pi)  # post-harvest softening
        anomaly = {yr: RNG.normal(0, 0.25) for yr in weeks.year.unique()}
        rain = np.concatenate([
            rainfall_curve(woy[weeks.year == yr], anomaly[yr]) for yr in sorted(weeks.year.unique())
        ])
        district_series[dist] = (mandi, rain)

    # --- Enterprise registry ------------------------------------------------
    seg_names = list(SEGMENTS)
    registry, name_count = [], {}
    for i in range(N_ENT):
        seg = seg_names[i % len(seg_names)]
        cfg = SEGMENTS[seg]
        dist, state = DISTRICTS[RNG.integers(len(DISTRICTS))]
        base = f"{RNG.choice(FIRST)} {KIND[seg]}"
        n = name_count.get(base, 0) + 1
        name_count[base] = n
        nm = base if n == 1 else f"{base} {n}"
        lo, hi = cfg["rev"]
        registry.append(dict(
            enterprise_id=f"ENT{i+1:04d}", name=nm, segment=seg, district=dist, state=state,
            base_rev=float(np.exp(RNG.uniform(np.log(lo), np.log(hi)))),
            trend=float(RNG.normal(0.0012, 0.0015)),           # weekly growth
            noise=float(RNG.uniform(0.10, 0.22)),              # idiosyncratic CV
            upi0=float(RNG.uniform(0.15, 0.45)),               # UPI share at t0
            upi1=float(RNG.uniform(0.45, 0.90)),               # UPI share at t_end
            fest_amp=float(cfg["festival"] * RNG.uniform(0.7, 1.3)),
            monsoon_beta=float(cfg["monsoon"] * RNG.uniform(0.6, 1.4)),
            inv_share=float(RNG.uniform(0.52, 0.68)),          # inventory/raw material cost
            fixed_cost=float(RNG.uniform(0.10, 0.18)),         # of base revenue
            has_loan=bool(RNG.random() < 0.6),
            emi_ratio=float(RNG.uniform(0.06, 0.22)),          # of median inflow
            # ~8% have an idiosyncratic anchor buyer (school/hostel/wholesaler)
            top_share=float(RNG.uniform(0.62, 0.85) if RNG.random() < 0.08
                            else RNG.uniform(*cfg["top_share"])),
            cp_lo=int(cfg["cp"][0]), cp_hi=int(cfg["cp"][1]),
            open_runway=float(RNG.uniform(1.5, 6.0)),          # weeks of outflow as opening balance
            buffer_weeks=float(RNG.uniform(1.0, 5.0)),         # cash buffer the household tries to keep
            draw_rate=float(RNG.uniform(0.35, 0.65)),          # share of excess drawn for household use
        ))
    ents = pd.DataFrame(registry)

    # --- Distress episodes ---------------------------------------------------
    # ~15% resolved/past events (visible in history), ~6% ramping RIGHT NOW
    # (event just beyond the observation window -> the demo's true positives).
    n_past, n_now = int(N_ENT * 0.25), int(N_ENT * 0.06)
    idx = RNG.permutation(N_ENT)
    events = []
    for j in idx[:n_past]:
        ev = int(RNG.integers(60, 100))
        events.append(dict(enterprise_id=ents.enterprise_id[j], event_week=ev,
                           ramp_len=int(RNG.integers(8, 16)), depth=float(RNG.uniform(0.35, 0.60)),
                           kind=str(RNG.choice(["demand_loss", "input_cost_spike", "buyer_default"]))))
    for j in idx[n_past:n_past + n_now]:
        ev = int(RNG.integers(N_WEEKS + 2, N_WEEKS + 7))      # 2-7 weeks after data ends
        events.append(dict(enterprise_id=ents.enterprise_id[j], event_week=ev,
                           ramp_len=int(RNG.integers(8, 14)), depth=float(RNG.uniform(0.40, 0.60)),
                           kind=str(RNG.choice(["demand_loss", "input_cost_spike", "health_shock"]))))
    events = pd.DataFrame(events)
    ev_map = {r.enterprise_id: r for r in events.itertuples()}

    # Mild wobble (non-distress noise) for another 10% to keep the task honest
    wobble_ids = set(ents.enterprise_id[idx[n_past + n_now: n_past + n_now + int(N_ENT * 0.10)]])

    # --- Weekly panel ---------------------------------------------------------
    rows = []
    t = np.arange(N_WEEKS, dtype=float)
    for e in ents.itertuples():
        mandi, rain = district_series[e.district]
        seas = segment_seasonality(e.segment, woy)
        rain_norm = rain / 90.0
        monsoon_effect = 1 + e.monsoon_beta * (rain_norm - rain_norm.mean())
        mandi_effect = (mandi / 100.0) ** (0.35 if e.segment in ("agri_inputs", "food_processing", "dairy") else 0.08)

        stress = np.ones(N_WEEKS)
        ev = ev_map.get(e.enterprise_id)
        if ev is not None:
            ramp_start = ev.event_week - ev.ramp_len
            for w in range(N_WEEKS):
                if w >= ramp_start:
                    frac = min(1.0, (w - ramp_start) / ev.ramp_len)
                    stress[w] = 1 - (1 - ev.depth) * frac
                # partial recovery 6+ weeks after a past event
                if w > ev.event_week + 6:
                    rec = min(1.0, (w - ev.event_week - 6) / 20)
                    stress[w] = stress[w] + (0.85 - stress[w]) * rec
        if e.enterprise_id in wobble_ids:
            wob_c = RNG.integers(55, 95)
            d = np.abs(t - wob_c)
            stress *= 1 - 0.18 * np.exp(-0.5 * (d / 5.0) ** 2)

        level = e.base_rev * np.exp(e.trend * t) * seas * monsoon_effect * mandi_effect \
                * (1 + e.fest_amp * fest) * stress
        inflow = level * np.exp(RNG.normal(0, e.noise, N_WEEKS))
        upi_share = np.clip(e.upi0 + (e.upi1 - e.upi0) * t / N_WEEKS + RNG.normal(0, 0.03, N_WEEKS), 0.05, 0.97)
        if ev is not None:  # stressed units often slide back toward cash
            upi_share = np.clip(upi_share - 0.10 * (1 - stress), 0.05, 0.97)

        inv_cost = e.inv_share * inflow * (mandi / 100.0) ** (0.25 if e.segment != "kirana" else 0.10)
        fixed = np.full(N_WEEKS, e.fixed_cost * e.base_rev) * np.exp(RNG.normal(0, 0.05, N_WEEKS))
        emi = np.full(N_WEEKS, e.emi_ratio * np.median(inflow) if e.has_loan else 0.0)
        outflow = inv_cost + fixed + emi
        net = inflow - outflow

        bal = np.empty(N_WEEKS)
        b = e.open_runway * outflow[:8].mean()
        for w in range(N_WEEKS):
            b = b + net[w]
            # owner's draw: household consumes most surplus above a target buffer
            # (business and household finances blur in micro enterprises)
            target = e.buffer_weeks * outflow[max(0, w - 7): w + 1].mean()
            if b > target:
                b -= e.draw_rate * (b - target)
            # informal smoothing: deep negatives get partially papered over by borrowing
            if b < -1.2 * outflow[w]:
                b = -1.2 * outflow[w]
            bal[w] = b

        cp_base = RNG.integers(e.cp_lo, e.cp_hi + 1)
        cp = np.maximum(1, (cp_base * (inflow / inflow.mean()) ** 0.5 * stress ** 0.8
                            + RNG.normal(0, 1.5, N_WEEKS))).astype(int)
        top_share = np.clip(e.top_share + 0.15 * (1 - stress) + RNG.normal(0, 0.02, N_WEEKS), 0.02, 0.98)
        txn = np.maximum(1, (inflow / RNG.uniform(120, 600) + RNG.normal(0, 4, N_WEEKS))).astype(int)

        for w in range(N_WEEKS):
            rows.append((
                e.enterprise_id, weeks[w].date().isoformat(), int(woy[w]),
                round(float(inflow[w]), 2), round(float(inflow[w] * upi_share[w]), 2),
                round(float(inflow[w] * (1 - upi_share[w])), 2), int(txn[w]), int(cp[w]),
                round(float(top_share[w]), 4),
                round(float(inv_cost[w]), 2), round(float(fixed[w]), 2), round(float(emi[w]), 2),
                round(float(outflow[w]), 2), round(float(net[w]), 2), round(float(bal[w]), 2),
                round(float(mandi[w]), 2), round(float(rain[w]), 1), round(float(fest[w]), 3),
            ))

    weekly = pd.DataFrame(rows, columns=[
        "enterprise_id", "week_start", "week_of_year",
        "inflow_total", "inflow_upi", "inflow_cash", "txn_count", "counterparty_count",
        "top_cp_share", "outflow_inventory", "outflow_fixed", "outflow_emi",
        "outflow_total", "net_cash_flow", "closing_balance",
        "mandi_price_index", "rainfall_mm", "festival_intensity",
    ])

    ents_pub = ents[["enterprise_id", "name", "segment", "district", "state", "has_loan"]]
    ents_pub.to_csv(OUT / "enterprises.csv", index=False)
    weekly.to_csv(OUT / "weekly.csv", index=False)
    events.to_csv(OUT / "events.csv", index=False)
    print(f"enterprises: {len(ents_pub)}  weekly rows: {len(weekly)}  events: {len(events)}")
    print(f"  past events: {n_past}  ramping-now: {n_now}  wobble-only: {len(wobble_ids)}")
    print(f"written to {OUT}")


if __name__ == "__main__":
    main()
