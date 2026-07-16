/* DhanDrishti dashboard — zero dependencies, hand-rolled SVG + animation engine.
   Night-ledger observatory edition. */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NOANIM = new URLSearchParams(location.search).has("noanim");
if (NOANIM) document.documentElement.classList.add("noanim");
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches || NOANIM;

const S = {
  portfolio: [], meta: null, current: null,
  filters: { q: "", segment: "", district: "", tier: "" },
  sort: { key: "risk_score", dir: -1 },
  lang: "en",
};

/* ---------------- i18n ---------------- */
const T = {
  en: {
    flags: "Early-warning flags", reasons: "Why this score — top drivers",
    forecast: "Weekly net cash flow — 12-week forecast",
    balance: "Projected cash balance — stress scenario",
    score: "risk score", noflags: "No early-warning flags. Cash-flow pattern looks healthy.",
    action: "Action", enterprises: "Enterprises monitored",
    watchlist: "On watchlist", runway: "Median cash runway", inflow: "Portfolio weekly inflow",
    lead: "Early-warning lead", skill: "Forecast skill",
    weeks: "weeks", week: "wk", high: "High", watch: "Watch", stable: "Stable",
    hist: "History", p50: "P50 forecast", band: "80% band (conformal)",
    stress: "Stress path (P10)", central: "Central path (P50)",
    zeroCross: "stress path < ₹0",
    scenario: "Scenario studio — what if?", shock: "Inflow shock",
    emiPause: "EMI moratorium · 8 wk", inject: "Working-capital line",
    crunchLbl: "Stress-path ₹0 crossing", averted: "averted ✓", never: "none",
    scNote: "Instant client-side what-if on the P10/P50 paths — for triage, not underwriting.",
    smsBtn: "SMS nudge preview", printBtn: "Print field brief",
    smsSub: "simulated · nothing is sent", justNow: "just now",
    healthySms: "Cash flow looks healthy this week. Keep collections digital and stock for the festival season.",
    tiers: { HIGH: "HIGH", WATCH: "WATCH", STABLE: "STABLE" },
    segs: { kirana: "Kirana", dairy: "Dairy", tailoring: "Tailoring", agri_inputs: "Agri inputs", food_processing: "Food processing", handloom: "Handloom" },
    flagNames: {
      LIQUIDITY_CRUNCH_AHEAD: "Liquidity crunch ahead", NEGATIVE_TREND: "Declining cash flow",
      EMI_STRESS: "EMI stress", REVENUE_CONCENTRATION: "Buyer concentration",
      PAYMENT_IRREGULARITY: "Irregular payments", SEASONAL_DIP_AHEAD: "Seasonal dip ahead",
    },
  },
  hi: {
    flags: "पूर्व-चेतावनी संकेत", reasons: "यह स्कोर क्यों — मुख्य कारण",
    forecast: "साप्ताहिक शुद्ध नकदी प्रवाह — 12 सप्ताह का पूर्वानुमान",
    balance: "अनुमानित नकद शेष — तनाव परिदृश्य",
    score: "जोखिम स्कोर", noflags: "कोई पूर्व-चेतावनी संकेत नहीं। नकदी प्रवाह स्वस्थ दिखता है।",
    action: "कार्रवाई", enterprises: "निगरानी में उद्यम",
    watchlist: "निगरानी सूची में", runway: "औसत नकद अवधि", inflow: "पोर्टफोलियो साप्ताहिक आय",
    lead: "पूर्व-चेतावनी बढ़त", skill: "पूर्वानुमान कौशल",
    weeks: "सप्ताह", week: "सप्ताह", high: "उच्च", watch: "निगरानी", stable: "स्थिर",
    hist: "इतिहास", p50: "P50 पूर्वानुमान", band: "80% बैंड",
    stress: "तनाव पथ (P10)", central: "केंद्रीय पथ (P50)",
    zeroCross: "तनाव पथ < ₹0",
    scenario: "परिदृश्य स्टूडियो — क्या-अगर?", shock: "आय में झटका",
    emiPause: "EMI स्थगन · 8 सप्ताह", inject: "कार्यशील-पूंजी सीमा",
    crunchLbl: "तनाव-पथ ₹0 पार", averted: "टल गया ✓", never: "कोई नहीं",
    scNote: "P10/P50 पथों पर त्वरित क्या-अगर — त्वरित आकलन हेतु, ऋण-निर्णय हेतु नहीं।",
    smsBtn: "SMS संदेश पूर्वावलोकन", printBtn: "फ़ील्ड ब्रीफ़ प्रिंट करें",
    smsSub: "सिम्युलेटेड · कुछ भेजा नहीं गया", justNow: "अभी",
    healthySms: "इस सप्ताह नकदी प्रवाह ठीक है। वसूली डिजिटल रखें और त्योहार के लिए स्टॉक तैयार करें।",
    tiers: { HIGH: "उच्च", WATCH: "निगरानी", STABLE: "स्थिर" },
    segs: { kirana: "किराना", dairy: "डेयरी", tailoring: "सिलाई", agri_inputs: "कृषि-इनपुट", food_processing: "खाद्य प्रसंस्करण", handloom: "हथकरघा" },
    flagNames: {
      LIQUIDITY_CRUNCH_AHEAD: "नकदी संकट की आशंका", NEGATIVE_TREND: "घटता नकदी प्रवाह",
      EMI_STRESS: "किस्त का बोझ", REVENUE_CONCENTRATION: "खरीदार पर निर्भरता",
      PAYMENT_IRREGULARITY: "अनियमित भुगतान", SEASONAL_DIP_AHEAD: "मौसमी गिरावट आगे",
    },
  },
};
const t = (k) => T[S.lang][k];

/* ---------------- formatting ---------------- */
const inr = (v) => "₹" + Math.round(v).toLocaleString("en-IN");
function inrC(v) {
  const a = Math.abs(v), sign = v < 0 ? "−" : "";
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(1)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(1)} L`;
  if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(1)}k`;
  return `${sign}₹${Math.round(a)}`;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const wkLabel = (iso) => { const d = new Date(iso + "T00:00:00"); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

/* ---------------- animation utils ---------------- */
function countUp(el, target, fmt, dur = 1300) {
  if (REDUCED) { el.innerHTML = fmt(target); return; }
  const t0 = performance.now();
  let done = false;
  (function frame(now) {
    if (done) return;
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.innerHTML = fmt(target * e);
    if (p < 1) requestAnimationFrame(frame); else done = true;
  })(t0);
  // guarantee the final value even if rAF is throttled (hidden/battery-saver)
  setTimeout(() => { if (!done) { done = true; el.innerHTML = fmt(target); } }, dur + 500);
}

function animateStrokes(root, base = 0) {
  if (REDUCED) return;
  $$(".draw", root).forEach((el, i) => {
    const len = el.getTotalLength ? el.getTotalLength() : 0;
    if (!len) return;
    el.style.transition = "none";
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
    el.getBoundingClientRect(); // reflow
    el.style.transition = `stroke-dashoffset 1400ms cubic-bezier(0.16,1,0.3,1) ${base + i * 350}ms`;
    el.style.strokeDashoffset = "0";
  });
}

/* deterministic reveal-on-scroll (no IntersectionObserver — throttle-proof) */
function checkReveals() {
  const vh = innerHeight;
  $$(".reveal:not(.in), #segment-chart:not(.in)").forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add("in");
  });
}
addEventListener("scroll", checkReveals, { passive: true });
addEventListener("resize", checkReveals);

/* ---------------- data ---------------- */
async function boot() {
  const [pf, meta] = await Promise.all([
    fetch("/api/portfolio").then(r => r.json()),
    fetch("/api/meta").then(r => r.json()),
  ]);
  S.portfolio = pf; S.meta = meta;
  fillFilters();
  renderAll(true);
  buildPulse();
  initSpotlight();
  initParallax();
  startClock();
  checkReveals();
  setTimeout(checkReveals, 400);
  // deep link: /#ENT0042 opens that enterprise
  const hash = location.hash.slice(1);
  if (/^ENT\d+$/.test(hash)) openDrawer(hash);
}

function renderAll(first = false) {
  renderKPIs(first); renderTable(); renderSegmentChart(); renderModelCard(); renderTicker();
  if (S.current) renderDrawer(S.current);
}

/* ---------------- hero pulse (real data: top-risk enterprise) ---------------- */
function buildPulse() {
  const svg = $("#pulse-svg");
  const wrap = svg.parentElement;
  const top = S.portfolio[0];
  if (!top) return;
  const vals = top.spark;
  const W = Math.max(600, wrap.clientWidth), H = 150, padY = 18;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const min = Math.min(...vals, 0), max = Math.max(...vals, 0);
  const X = i => 4 + i * (W - 8) / (vals.length - 1);
  const Y = v => padY + (max - v) * (H - 2 * padY) / ((max - min) || 1);
  const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  const iMin = vals.indexOf(Math.min(...vals));
  const dipX = X(iMin), dipY = Y(vals[iMin]);
  svg.innerHTML = `
    <defs>
      <linearGradient id="pulse-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--gold-hi)"/><stop offset="0.55" stop-color="var(--gold)"/>
        <stop offset="1" stop-color="var(--blue)"/>
      </linearGradient>
      <linearGradient id="pulse-area-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(217,166,46,0.14)"/><stop offset="1" stop-color="rgba(217,166,46,0)"/>
      </linearGradient>
    </defs>
    <line class="pulse-zero" x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}"/>
    <polygon class="pulse-area" points="${X(0)},${Y(0)} ${pts.join(" ")} ${X(vals.length - 1)},${Y(0)}"/>
    <polyline class="pulse-line draw" points="${pts.join(" ")}"/>
    ${vals[iMin] < 0 ? `
      <circle class="pulse-dot-halo" cx="${dipX}" cy="${dipY}" r="6" style="transform-origin:${dipX}px ${dipY}px"/>
      <circle class="pulse-dot" cx="${dipX}" cy="${dipY}" r="4.5" style="transform-origin:${dipX}px ${dipY}px"/>
      <text class="pulse-label" x="${Math.min(dipX + 12, W - 190)}" y="${Math.min(dipY + 4, H - 6)}">▲ EARLY WARNING · ${top.name.toUpperCase()}</text>` : ""}
  `;
  if (!REDUCED) {
    const line = $(".pulse-line", svg);
    const len = line.getTotalLength();
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    line.getBoundingClientRect();
    line.style.transition = "stroke-dashoffset 2000ms cubic-bezier(0.16,1,0.3,1) 500ms";
    line.style.strokeDashoffset = "0";
  }
}
let rsz;
addEventListener("resize", () => { clearTimeout(rsz); rsz = setTimeout(buildPulse, 220); });

/* ---------------- ticker ---------------- */
function renderTicker() {
  const alerts = S.portfolio.filter(r => r.tier !== "STABLE");
  const items = (alerts.length ? alerts : S.portfolio.slice(0, 8)).map(r => {
    const flag = r.flags[0] ? (T[S.lang].flagNames[r.flags[0]] || r.flags[0]) : t("stable");
    return `<span class="tick" data-id="${r.id}">
      <span class="sev ${r.tier}">${r.tier === "HIGH" ? "▲" : r.tier === "WATCH" ? "●" : "○"} ${T[S.lang].tiers[r.tier]} ${r.risk_score.toFixed(0)}</span>
      <em>${r.name}</em><span class="sep">·</span>${r.district}<span class="sep">·</span>${flag}
      <span class="sep">◆</span></span>`;
  }).join("");
  $("#ticker-track").innerHTML = items + items; // duplicate for seamless loop
  $$("#ticker-track .tick").forEach(el => el.addEventListener("click", () => openDrawer(el.dataset.id)));
}

/* ---------------- KPI band ---------------- */
function renderKPIs(animate = false) {
  const pf = S.portfolio, m = S.meta;
  const high = pf.filter(r => r.tier === "HIGH").length;
  const watch = pf.filter(r => r.tier === "WATCH").length;
  const runways = pf.map(r => r.runway_weeks).sort((a, b) => a - b);
  const medRunway = runways[Math.floor(runways.length / 2)];
  const totInflow = pf.reduce((s, r) => s + r.inflow_ma4, 0);
  const districts = new Set(pf.map(r => r.district)).size;
  const unit = (u) => `<span class="unit">${u}</span>`;
  const tiles = [
    { label: t("enterprises"), num: pf.length, fmt: v => String(Math.round(v)), sub: `${districts} districts · 6 segments`, accent: "var(--blue)" },
    { label: t("watchlist"), num: high + watch, fmt: v => String(Math.round(v)), sub: `${high} ${t("high").toLowerCase()} · ${watch} ${t("watch").toLowerCase()}`, accent: "var(--crit)" },
    { label: t("runway"), num: medRunway, fmt: v => v.toFixed(1) + unit(" " + t("weeks")), sub: "of operating expenses", accent: "var(--gold)" },
    { label: t("inflow"), num: totInflow, fmt: v => inrC(v), sub: "4-week average", accent: "var(--gold)" },
    { label: t("lead"), num: m.classifier.median_lead_weeks, fmt: v => v.toFixed(1) + unit(" " + t("weeks")), sub: "median, temporal holdout", accent: "var(--good)" },
    { label: t("skill"), num: 100 * m.forecaster.skill_vs_naive, fmt: v => "+" + Math.round(v) + unit("%"), sub: "MAE vs seasonal-naive", accent: "var(--good)" },
  ];
  $("#kpi-band").innerHTML = tiles.map((k, i) => `
    <div class="kpi reveal" style="--kpi-accent:${k.accent};--i:${i}">
      <div class="k-label">${k.label}</div>
      <div class="k-value" id="kpi-v${i}">${k.fmt(animate && !REDUCED ? 0 : k.num)}</div>
      <div class="k-sub">${k.sub}</div>
    </div>`).join("");
  if (animate) tiles.forEach((k, i) => countUp($("#kpi-v" + i), k.num, k.fmt, 1200 + i * 120));
  initSpotlight();
  requestAnimationFrame(checkReveals);
  setTimeout(checkReveals, 60);
}

/* ---------------- portfolio table ---------------- */
function fillFilters() {
  const segs = [...new Set(S.portfolio.map(r => r.segment))].sort();
  const dists = [...new Set(S.portfolio.map(r => r.district))].sort();
  $("#f-segment").innerHTML = `<option value="">All segments</option>` +
    segs.map(s => `<option value="${s}">${T.en.segs[s] || s}</option>`).join("");
  $("#f-district").innerHTML = `<option value="">All districts</option>` +
    dists.map(d => `<option value="${d}">${d}</option>`).join("");
}

function filtered() {
  const f = S.filters, q = f.q.trim().toLowerCase();
  let rows = S.portfolio.filter(r =>
    (!q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) &&
    (!f.segment || r.segment === f.segment) &&
    (!f.district || r.district === f.district) &&
    (!f.tier || r.tier === f.tier));
  const { key, dir } = S.sort;
  rows = rows.slice().sort((a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * dir);
  return rows;
}

function sparkline(vals, tier) {
  const w = 120, h = 26, pad = 2;
  const min = Math.min(...vals, 0), max = Math.max(...vals, 0);
  const x = i => pad + i * (w - 2 * pad) / (vals.length - 1);
  const y = v => h - pad - (v - min) * (h - 2 * pad) / ((max - min) || 1);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const zero = y(0);
  const dotColor = tier === "HIGH" ? "var(--crit)" : tier === "WATCH" ? "var(--warn)" : "var(--good)";
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <line x1="${pad}" x2="${w - pad}" y1="${zero}" y2="${zero}" stroke="var(--grid)" stroke-width="1"/>
    <polyline points="${pts}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="${x(vals.length - 1)}" cy="${y(vals[vals.length - 1])}" r="2.6" fill="${dotColor}"/>
  </svg>`;
}

function chipHTML(tier) {
  return `<span class="chip ${tier}"><span class="dot"></span>${T[S.lang].tiers[tier]}</span>`;
}

const tierColor = (tier) => tier === "HIGH" ? "var(--crit)" : tier === "WATCH" ? "var(--warn)" : "var(--good)";

function renderTable() {
  const rows = filtered();
  const cnt = $("#portfolio-count");
  cnt.textContent = `${rows.length} / ${S.portfolio.length}`;
  cnt.classList.remove("pop"); void cnt.offsetWidth; cnt.classList.add("pop");
  $("#portfolio-body").innerHTML = rows.map((r, i) => `
    <tr tabindex="0" data-id="${r.id}" class="${i < 18 ? "row-in" : ""}" style="--i:${Math.min(i, 18)}" aria-label="${r.name}, risk ${r.risk_score}">
      <td><div class="ent-name">${r.name}</div><div class="ent-id">${r.id}</div></td>
      <td class="seg-cell">${T[S.lang].segs[r.segment] || r.segment}<br>${r.district}, ${r.state}</td>
      <td class="num"><div class="risk-cell">
        <span class="risk-num" style="color:${tierColor(r.tier)}">${r.risk_score.toFixed(0)}</span>
        <span class="risk-bar"><i style="width:${Math.max(3, r.risk_score)}%;background:${tierColor(r.tier)}"></i></span>
        ${chipHTML(r.tier)}
      </div></td>
      <td class="spark-col">${sparkline(r.spark, r.tier)}</td>
      <td class="num">${r.runway_weeks.toFixed(1)} ${t("week")}</td>
      <td class="num">${inrC(r.inflow_ma4)}</td>
      <td><span class="sig-icons">${r.flags.map(c =>
        `<span class="sig" title="${T[S.lang].flagNames[c] || c}">${(T[S.lang].flagNames[c] || c).split(" ")[0]}</span>`).join("")}</span></td>
    </tr>`).join("");
  $$("#portfolio-body tr").forEach(tr => {
    tr.addEventListener("click", () => openDrawer(tr.dataset.id));
    tr.addEventListener("keydown", e => { if (e.key === "Enter") openDrawer(tr.dataset.id); });
  });
}

/* ---------------- segment chart (stacked status bars) ---------------- */
function renderSegmentChart() {
  const segs = {};
  for (const r of S.portfolio) {
    segs[r.segment] ??= { HIGH: 0, WATCH: 0 };
    if (r.tier !== "STABLE") segs[r.segment][r.tier]++;
  }
  const items = Object.entries(segs)
    .map(([s, v]) => ({ s, ...v, tot: v.HIGH + v.WATCH }))
    .sort((a, b) => b.tot - a.tot);
  const max = Math.max(...items.map(i => i.tot), 1);
  const W = 300, BAR = 16, GAP = 13, LBL = 104;
  const H = items.length * (BAR + GAP);
  let y = 0, out = "";
  items.forEach((it, idx) => {
    const wH = (it.HIGH / max) * (W - LBL - 34);
    const wW = (it.WATCH / max) * (W - LBL - 34);
    out += `<text x="${LBL - 8}" y="${y + BAR / 2 + 4}" text-anchor="end" font-size="12" fill="var(--ink2)">${T[S.lang].segs[it.s] || it.s}</text>`;
    if (it.HIGH) out += `<rect class="bar" style="--i:${idx}" x="${LBL}" y="${y}" width="${Math.max(wH, 2)}" height="${BAR}" rx="3" fill="var(--crit)"/>`;
    if (it.WATCH) out += `<rect class="bar" style="--i:${idx}" x="${LBL + wH + (it.HIGH ? 2 : 0)}" y="${y}" width="${Math.max(wW, 2)}" height="${BAR}" rx="3" fill="var(--warn)"/>`;
    out += `<text x="${LBL + wH + wW + (it.HIGH ? 2 : 0) + 6}" y="${y + BAR / 2 + 4}" font-size="12" font-weight="700" fill="var(--ink)">${it.tot || "0"}</text>`;
    y += BAR + GAP;
  });
  const chart = $("#segment-chart");
  const wasIn = chart.classList.contains("in");
  chart.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Watchlist enterprises by segment">${out}</svg>
    <div class="chart-legend">
      <span class="li"><span class="swatch band" style="background:var(--crit)"></span>▲ ${t("high")}</span>
      <span class="li"><span class="swatch band" style="background:var(--warn)"></span>● ${t("watch")}</span>
    </div>`;
  if (wasIn) chart.classList.add("in");
}

/* ---------------- model card ---------------- */
function renderModelCard() {
  const m = S.meta, c = m.classifier, f = m.forecaster;
  const lift = (c.avg_precision / c.base_rate).toFixed(0);
  $("#model-card-body").innerHTML = `
    <dt>Early-warning AUC</dt><dd>${c.auc}</dd>
    <dt>Precision lift vs base rate</dt><dd>${lift}×</dd>
    <dt>Median warning lead</dt><dd>${c.median_lead_weeks} wk</dd>
    <dt>Forecast MAE vs naive</dt><dd>−${Math.round(100 * f.skill_vs_naive)}%</dd>
    <dt>P10–P90 coverage</dt><dd>${Math.round(100 * f.p10_p90_coverage_conformal)}%</dd>
    <dt>Panel</dt><dd>${m.data.n_enterprises} ents · ${m.data.n_weeks} wks</dd>`;
}

/* ---------------- drawer ---------------- */
async function openDrawer(id) {
  const r = await fetch(`/api/enterprise/${id}`);
  if (!r.ok) return;
  const d = await r.json();
  S.current = d;
  S.scenario = { shock: 0, emiPause: false, inject: 0 };
  S.smsOpen = false;
  $("#drawer").hidden = false; $("#drawer-scrim").hidden = false;
  document.body.style.overflow = "hidden";
  renderDrawer(d);
  $("#drawer").scrollTop = 0;
  history.replaceState(null, "", location.search + "#" + id);
}
function closeDrawer() {
  $("#drawer").hidden = true; $("#drawer-scrim").hidden = true;
  document.body.style.overflow = ""; S.current = null;
  history.replaceState(null, "", location.pathname + location.search);
}

function setDial(score, tier) {
  const arc = $("#dial-arc");
  const C = 2 * Math.PI * 40;
  arc.style.stroke = tierColor(tier);
  arc.style.strokeDasharray = C;
  arc.style.strokeDashoffset = C;
  arc.getBoundingClientRect();
  arc.style.strokeDashoffset = C * (1 - Math.max(0.02, score / 100));
  const numEl = $("#d-score");
  numEl.style.color = tierColor(tier);
  countUp(numEl, score, v => String(Math.round(v)), 1100);
}

function renderDrawer(d) {
  const L = S.lang, sfx = L === "hi" ? "hi" : "en";
  $("#d-name").textContent = d.name;
  $("#d-sub").innerHTML = `${T[L].segs[d.segment] || d.segment} · ${d.district}, ${d.state} · ${d.id} &nbsp;${chipHTML(d.tier)}`;
  setDial(d.risk_score, d.tier);
  $("#d-score-label").textContent = t("score");
  $("#t-flags").textContent = t("flags");
  $("#t-reasons").textContent = t("reasons");
  $("#t-forecast").textContent = t("forecast");
  $("#t-balance").textContent = t("balance");

  const k = d.kpis;
  const kpis = [
    [S.lang === "hi" ? "नकद अवधि" : "Cash runway", `${k.runway_weeks.toFixed(1)} ${t("weeks")}`],
    ["Weekly inflow (4w)", inrC(k.inflow_ma4)],
    ["Net cash flow (4w)", inrC(k.net_cf_ma4)],
    ["Cash balance", inrC(k.closing_balance)],
    ["UPI share", `${Math.round(100 * k.upi_share)}%`],
    ["Top buyer share", `${Math.round(100 * k.top_cp_share)}%`],
  ];
  $("#d-kpis").innerHTML = kpis.map(([l, v]) =>
    `<div class="d-kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div></div>`).join("");

  const icons = { 3: "▲", 2: "◆", 1: "●" };
  $("#d-flags").innerHTML = d.flags.length ? d.flags.map(f => `
    <div class="flag-card sev${f.severity}">
      <div class="flag-icon">${icons[f.severity]}</div>
      <div>
        <div class="flag-title">${T[L].flagNames[f.code] || f.code}</div>
        <div class="flag-detail">${f["detail_" + sfx]}</div>
        <div class="flag-action"><b>${t("action")}</b> — ${f["action_" + sfx]}</div>
      </div>
    </div>`).join("") : `<div class="no-flags">✓ ${t("noflags")}</div>`;

  $("#d-reasons").innerHTML = d.reasons.length ? d.reasons.map(r => `
    <li>
      <div class="reason-row">
        <span class="reason-text">${r["text_" + sfx]}</span>
        <span class="reason-w">${Math.round(100 * r.weight)}%</span>
      </div>
      <div class="reason-bar"><i style="width:${Math.round(100 * r.weight)}%"></i></div>
    </li>`).join("") : `<li><span class="reason-text">${t("noflags")}</span></li>`;

  $("#t-scenario").textContent = t("scenario");
  $("#t-sms").textContent = t("smsBtn");
  $("#t-print").textContent = t("printBtn");
  renderScenario(d);
  renderSms(d);
  drawForecast(d, $("#fc-table-btn").getAttribute("aria-pressed") === "true");
  applyScenario();
}

/* ---------------- scenario studio (client-side what-if) ---------------- */
function crunchWeek(bp) {
  const i = bp.findIndex(f => f.p10 < 0);
  return i < 0 ? null : i + 1;
}

function scenarioBP(d) {
  const { shock, emiPause, inject } = S.scenario;
  const emiW = d.kpis.emi_to_inflow * d.kpis.inflow_ma4;
  let cum = 0;
  return d.balance_path.map((f, h) => {
    cum += (shock / 100) * d.kpis.inflow_ma4 + (emiPause && h < 8 ? emiW : 0);
    const add = cum + inject;
    return { week: f.week, p10: f.p10 + add, p50: f.p50 + add, p90: f.p90 + add };
  });
}

function renderScenario(d) {
  const sc = S.scenario;
  const emiW = d.kpis.emi_to_inflow * d.kpis.inflow_ma4;
  $("#d-scenario").innerHTML = `
    <div class="sc-row">
      <span class="sc-label">${t("shock")}</span>
      <input type="range" class="sc-slider" id="sc-shock" min="-30" max="30" step="5" value="${sc.shock}" aria-label="${t("shock")}">
      <span class="sc-val" id="sc-shock-val">${sc.shock > 0 ? "+" : ""}${sc.shock}%</span>
    </div>
    <div class="sc-row">
      <span class="sc-label">${t("inject")}</span>
      <input type="range" class="sc-slider" id="sc-inject" min="0" max="100000" step="25000" value="${sc.inject}" aria-label="${t("inject")}">
      <span class="sc-val" id="sc-inject-val">${inrC(sc.inject)}</span>
    </div>
    <div class="sc-row">
      <span class="sc-label">${t("emiPause")}</span>
      <span class="sc-chip ${sc.emiPause ? "on" : ""}" id="sc-emi" role="switch" aria-checked="${sc.emiPause}"
        ${emiW < 1 ? "disabled" : ""} tabindex="0">${emiW < 1 ? "— no EMI —" : (sc.emiPause ? "ON" : "OFF")}</span>
      <span class="sc-note">${t("scNote")}</span>
    </div>
    <div class="sc-verdict" id="sc-verdict"></div>`;
  $("#sc-shock").addEventListener("input", e => {
    S.scenario.shock = +e.target.value;
    $("#sc-shock-val").textContent = (S.scenario.shock > 0 ? "+" : "") + S.scenario.shock + "%";
    applyScenario();
  });
  $("#sc-inject").addEventListener("input", e => {
    S.scenario.inject = +e.target.value;
    $("#sc-inject-val").textContent = inrC(S.scenario.inject);
    applyScenario();
  });
  const emiChip = $("#sc-emi");
  const toggleEmi = () => {
    if (emiW < 1) return;
    S.scenario.emiPause = !S.scenario.emiPause;
    emiChip.classList.toggle("on", S.scenario.emiPause);
    emiChip.setAttribute("aria-checked", String(S.scenario.emiPause));
    emiChip.textContent = S.scenario.emiPause ? "ON" : "OFF";
    applyScenario();
  };
  emiChip.addEventListener("click", toggleEmi);
  emiChip.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleEmi(); } });
}

function applyScenario() {
  const d = S.current;
  if (!d) return;
  const bp2 = scenarioBP(d);
  const before = crunchWeek(d.balance_path), after = crunchWeek(bp2);
  const v = $("#sc-verdict");
  if (v) {
    const wkTxt = w => w === null ? t("never") : `${t("week")} ${w}`;
    const isDefault = S.scenario.shock === 0 && !S.scenario.emiPause && S.scenario.inject === 0;
    const body = isDefault
      ? ` <b>${wkTxt(before)}</b>`
      : ` <b>${wkTxt(before)} → ${after === null && before !== null ? t("averted") : wkTxt(after)}</b>`;
    v.className = "sc-verdict " + (after === null ? "ok" : "bad");
    v.innerHTML = `${after === null ? "✓" : "▲"} ${t("crunchLbl")}:${body}`;
  }
  drawBalance(d, $("#bal-table-btn").getAttribute("aria-pressed") === "true", { bp: bp2 });
}

/* ---------------- SMS nudge preview ---------------- */
function renderSms(d) {
  const box = $("#sms-preview");
  if (!S.smsOpen) { box.innerHTML = ""; return; }
  const sfx = S.lang === "hi" ? "hi" : "en";
  const f = d.flags[0];
  const msg = f
    ? `▲ ${T[S.lang].flagNames[f.code] || f.code}\n${f["detail_" + sfx]}\n→ ${f["action_" + sfx]}`
    : `✓ ${t("healthySms")}`;
  box.innerHTML = `
    <div class="sms-wrap"><div class="sms-phone">
      <div class="sms-head">
        <div class="sms-ava">ध</div>
        <div><div class="sms-name">DhanDrishti · ${d.name}</div><div class="sms-sub">${t("smsSub")}</div></div>
      </div>
      <div class="sms-bubble">${msg}</div>
      <div class="sms-time">${t("justNow")} · SMS/WhatsApp/IVR</div>
    </div></div>`;
}

/* ---------------- printable field brief ---------------- */
function printBrief() {
  const d = S.current;
  if (!d) return;
  const sfx = S.lang === "hi" ? "hi" : "en";
  const L = S.lang;
  const k = d.kpis;
  $("#print-brief").innerHTML = `
    <h1>DhanDrishti — ${d.name}</h1>
    <div class="pb-sub">${T[L].segs[d.segment] || d.segment} · ${d.district}, ${d.state} · ${d.id} · ${new Date().toLocaleDateString("en-IN")}</div>
    <div class="pb-score">${t("score").toUpperCase()}: ${d.risk_score.toFixed(0)}/100 · ${T[L].tiers[d.tier]}</div>
    <h2>${t("flags")}</h2>
    <ul>${d.flags.length ? d.flags.map(f =>
      `<li><b>${T[L].flagNames[f.code] || f.code}</b> — ${f["detail_" + sfx]}<br><i>${t("action")}: ${f["action_" + sfx]}</i></li>`).join("")
      : `<li>${t("noflags")}</li>`}</ul>
    <h2>${t("reasons")}</h2>
    <ul>${d.reasons.map(r => `<li>${r["text_" + sfx]} (${Math.round(100 * r.weight)}%)</li>`).join("")}</ul>
    <h2>KPI</h2>
    <table><tr><th>Cash runway</th><th>Inflow (4w)</th><th>Net CF (4w)</th><th>Balance</th><th>UPI</th><th>EMI/inflow</th></tr>
    <tr><td>${k.runway_weeks.toFixed(1)} wk</td><td>${inr(k.inflow_ma4)}</td><td>${inr(k.net_cf_ma4)}</td>
    <td>${inr(k.closing_balance)}</td><td>${Math.round(100 * k.upi_share)}%</td><td>${Math.round(100 * k.emi_to_inflow)}%</td></tr></table>
    <h2>${t("forecast")}</h2>
    <table><tr><th>Week</th><th>P10</th><th>P50</th><th>P90</th></tr>
    ${d.forecast.slice(0, 4).map(f => `<tr><td>${wkLabel(f.week)}</td><td>${inr(f.p10)}</td><td>${inr(f.p50)}</td><td>${inr(f.p90)}</td></tr>`).join("")}</table>
    <div class="pb-foot">Generated by DhanDrishti · synthetic demonstration data · consent-first (AA) · DPDP-aligned</div>`;
  window.print();
}

/* ---------------- chart engine ---------------- */
function niceTicks(min, max, n = 4) {
  const span = max - min || 1;
  const step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= n + 0.5) || mag * 10;
  const lo = Math.floor(min / step) * step, ticks = [];
  for (let v = lo; v <= max + step * 0.01; v += step) ticks.push(v);
  return ticks;
}

function monthTicks(dates) {
  const out = [];
  let prev = -1;
  dates.forEach((iso, i) => {
    const d = new Date(iso + "T00:00:00");
    if (d.getMonth() !== prev) { prev = d.getMonth(); out.push([i, `${MONTHS[d.getMonth()]}${d.getMonth() === 0 ? " ’" + String(d.getFullYear()).slice(2) : ""}`]); }
  });
  return out.filter((_, j) => j % 2 === 0);
}

/* Weekly net cash flow: 52w history line + forecast P50 + conformal band */
function drawForecast(d, asTable) {
  const box = $("#d-forecast");
  const hist = d.history.slice(-52), fc = d.forecast;
  if (asTable) {
    box.innerHTML = `<div class="chart-box table-wrap"><table class="chart-table"><thead>
      <tr><th>Week</th><th class="num">P10</th><th class="num">P50</th><th class="num">P90</th></tr></thead><tbody>` +
      fc.map(f => `<tr><td>${wkLabel(f.week)}</td><td class="num">${inr(f.p10)}</td><td class="num">${inr(f.p50)}</td><td class="num">${inr(f.p90)}</td></tr>`).join("") +
      `</tbody></table></div>`;
    return;
  }
  const W = 660, H = 240, M = { l: 56, r: 76, t: 14, b: 26 };
  const n = hist.length + fc.length;
  const allVals = [...hist.map(h => h.net), ...fc.flatMap(f => [f.p10, f.p90]), 0];
  const yMin = Math.min(...allVals), yMax = Math.max(...allVals);
  const ticks = niceTicks(yMin, yMax);
  const X = i => M.l + i * (W - M.l - M.r) / (n - 1);
  const Y = v => M.t + (Math.max(...ticks) - v) * (H - M.t - M.b) / ((Math.max(...ticks) - Math.min(...ticks)) || 1);
  const dates = [...hist.map(h => h.week), ...fc.map(f => f.week)];
  const iToday = hist.length - 1;

  let g = `<defs>
    <linearGradient id="fc-hist-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(188,194,220,0.10)"/><stop offset="1" stop-color="rgba(188,194,220,0)"/>
    </linearGradient>
  </defs>`;
  for (const tv of ticks)
    g += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(tv)}" y2="${Y(tv)}" stroke="var(--grid)" stroke-width="1"/>
          <text x="${M.l - 8}" y="${Y(tv) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${inrC(tv)}</text>`;
  g += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--baseline)" stroke-width="1.5"/>`;
  for (const [i, lbl] of monthTicks(dates))
    g += `<text x="${X(i)}" y="${H - 8}" font-size="11" fill="var(--muted)">${lbl}</text>`;

  // band
  const bandPts = fc.map((f, j) => `${X(iToday + 1 + j)},${Y(f.p90)}`).join(" ") + " " +
    fc.slice().reverse().map((f, j) => `${X(iToday + fc.length - j)},${Y(f.p10)}`).join(" ");
  g += `<polygon class="band-anim" points="${bandPts}" fill="var(--blue-wash)"/>`;
  // history area + line
  g += `<polygon points="${X(0)},${Y(0)} ${hist.map((h, i) => `${X(i)},${Y(h.net)}`).join(" ")} ${X(iToday)},${Y(0)}" fill="url(#fc-hist-grad)"/>`;
  g += `<polyline class="draw" points="${hist.map((h, i) => `${X(i)},${Y(h.net)}`).join(" ")}" fill="none" stroke="var(--ink2)" stroke-width="2" stroke-linejoin="round"/>`;
  // p50 line
  const p50pts = [`${X(iToday)},${Y(hist[iToday].net)}`, ...fc.map((f, j) => `${X(iToday + 1 + j)},${Y(f.p50)}`)].join(" ");
  g += `<polyline class="draw" points="${p50pts}" fill="none" stroke="var(--blue-hi)" stroke-width="2.5" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(57,135,229,0.5))"/>`;
  // today divider
  g += `<line x1="${X(iToday)}" x2="${X(iToday)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--baseline)" stroke-dasharray="3 4"/>
        <text x="${X(iToday)}" y="${M.t - 2}" font-size="10.5" fill="var(--muted)" text-anchor="middle">today</text>`;
  // direct labels
  const lastF = fc[fc.length - 1];
  g += `<text x="${X(n - 1) + 5}" y="${Y(lastF.p50) + 4}" font-size="11" font-weight="700" fill="var(--blue-hi)">${t("p50")}</text>
        <text x="${X(n - 1) + 5}" y="${Y(lastF.p90) + 4}" font-size="10.5" fill="var(--muted)">P90</text>
        <text x="${X(n - 1) + 5}" y="${Y(lastF.p10) + 4}" font-size="10.5" fill="var(--muted)">P10</text>`;

  box.innerHTML = `<div class="chart-box">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net cash flow history and forecast">${g}
      <rect class="hover-rect" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent"/>
      <line class="xhair" y1="${M.t}" y2="${H - M.b}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/>
    </svg>
    <div class="chart-legend">
      <span class="li"><span class="swatch" style="background:var(--ink2)"></span>${t("hist")}</span>
      <span class="li"><span class="swatch" style="background:var(--blue-hi)"></span>${t("p50")}</span>
      <span class="li"><span class="swatch band" style="background:var(--blue-wash)"></span>${t("band")}</span>
    </div></div>`;

  animateStrokes(box, 150);
  hoverize(box, X, n, i => {
    if (i <= iToday) {
      const h = hist[i];
      return `<b>${wkLabel(h.week)}</b><br>Net: <b>${inr(h.net)}</b><br>In ${inrC(h.inflow)} · Out ${inrC(h.outflow)}`;
    }
    const f = fc[i - iToday - 1];
    return `<b>${wkLabel(f.week)}</b> · forecast<br>P50: <b>${inr(f.p50)}</b><br>P10 ${inrC(f.p10)} · P90 ${inrC(f.p90)}`;
  }, i => i <= iToday ? Y(hist[i].net) : Y(fc[i - iToday - 1].p50));
}

/* Balance projection: history + three quantile paths (ov.bp = scenario override) */
function drawBalance(d, asTable, ov) {
  const box = $("#d-balance");
  const hist = d.history.slice(-26), bp = (ov && ov.bp) || d.balance_path;
  if (asTable) {
    box.innerHTML = `<div class="chart-box table-wrap"><table class="chart-table"><thead>
      <tr><th>Week</th><th class="num">${t("stress")}</th><th class="num">P50</th><th class="num">P90</th></tr></thead><tbody>` +
      bp.map(f => `<tr><td>${wkLabel(f.week)}</td><td class="num">${inr(f.p10)}</td><td class="num">${inr(f.p50)}</td><td class="num">${inr(f.p90)}</td></tr>`).join("") +
      `</tbody></table></div>`;
    return;
  }
  const W = 660, H = 220, M = { l: 56, r: 76, t: 14, b: 26 };
  const n = hist.length + bp.length;
  const allVals = [...hist.map(h => h.balance), ...bp.flatMap(f => [f.p10, f.p90]), 0];
  const ticks = niceTicks(Math.min(...allVals), Math.max(...allVals));
  const X = i => M.l + i * (W - M.l - M.r) / (n - 1);
  const Y = v => M.t + (Math.max(...ticks) - v) * (H - M.t - M.b) / ((Math.max(...ticks) - Math.min(...ticks)) || 1);
  const dates = [...hist.map(h => h.week), ...bp.map(f => f.week)];
  const iToday = hist.length - 1;

  let g = "";
  for (const tv of ticks)
    g += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(tv)}" y2="${Y(tv)}" stroke="var(--grid)" stroke-width="1"/>
          <text x="${M.l - 8}" y="${Y(tv) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${inrC(tv)}</text>`;
  g += `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--baseline)" stroke-width="1.5"/>`;
  for (const [i, lbl] of monthTicks(dates))
    g += `<text x="${X(i)}" y="${H - 8}" font-size="11" fill="var(--muted)">${lbl}</text>`;

  const bandPts = bp.map((f, j) => `${X(iToday + 1 + j)},${Y(f.p90)}`).join(" ") + " " +
    bp.slice().reverse().map((f, j) => `${X(iToday + bp.length - j)},${Y(f.p10)}`).join(" ");
  g += `<polygon class="band-anim" points="${bandPts}" fill="var(--blue-wash)"/>`;
  g += `<polyline class="draw" points="${hist.map((h, i) => `${X(i)},${Y(h.balance)}`).join(" ")}" fill="none" stroke="var(--ink2)" stroke-width="2" stroke-linejoin="round"/>`;
  const start = `${X(iToday)},${Y(hist[iToday].balance)}`;
  g += `<polyline class="draw" points="${[start, ...bp.map((f, j) => `${X(iToday + 1 + j)},${Y(f.p50)}`)].join(" ")}" fill="none" stroke="var(--blue-hi)" stroke-width="2.5" style="filter:drop-shadow(0 0 5px rgba(57,135,229,0.5))"/>`;
  g += `<polyline class="draw" points="${[start, ...bp.map((f, j) => `${X(iToday + 1 + j)},${Y(f.p10)}`)].join(" ")}" fill="none" stroke="var(--blue)" stroke-width="1.8" stroke-dasharray="5 4" opacity="0.8"/>`;
  g += `<line x1="${X(iToday)}" x2="${X(iToday)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--baseline)" stroke-dasharray="3 4"/>
        <text x="${X(iToday)}" y="${M.t - 2}" font-size="10.5" fill="var(--muted)" text-anchor="middle">today</text>`;

  // zero-crossing marker on stress path (status = icon + label, never color alone)
  const cross = bp.findIndex(f => f.p10 < 0);
  if (cross >= 0) {
    const cx = X(iToday + 1 + cross), cy = Y(0);
    g += `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="var(--crit)" stroke-width="1.2" opacity="0.55">
            <animate attributeName="r" values="5;13" dur="1.8s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="${cx}" cy="${cy}" r="5" fill="var(--crit)" stroke="var(--bg1)" stroke-width="2"/>
          <text x="${cx > W - 210 ? cx - 10 : cx + 9}" y="${cy - 9}" text-anchor="${cx > W - 210 ? "end" : "start"}" font-size="11" font-weight="700" fill="var(--crit)">▲ ${t("zeroCross")} · ${t("week")} ${cross + 1}</text>`;
  }
  const lastB = bp[bp.length - 1];
  g += `<text x="${X(n - 1) + 5}" y="${Y(lastB.p50) + 4}" font-size="11" font-weight="700" fill="var(--blue-hi)">P50</text>
        <text x="${X(n - 1) + 5}" y="${Y(lastB.p10) + 4}" font-size="10.5" fill="var(--muted)">P10</text>`;

  box.innerHTML = `<div class="chart-box">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cash balance projection">${g}
      <rect class="hover-rect" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent"/>
      <line class="xhair" y1="${M.t}" y2="${H - M.b}" stroke="var(--muted)" stroke-width="1" visibility="hidden"/>
    </svg>
    <div class="chart-legend">
      <span class="li"><span class="swatch" style="background:var(--ink2)"></span>${t("hist")}</span>
      <span class="li"><span class="swatch" style="background:var(--blue-hi)"></span>${t("central")}</span>
      <span class="li"><span class="swatch" style="background:var(--blue);height:2px;opacity:.8"></span>${t("stress")}</span>
    </div></div>`;

  animateStrokes(box, 250);
  hoverize(box, X, n, i => {
    if (i <= iToday) { const h = hist[i]; return `<b>${wkLabel(h.week)}</b><br>Balance: <b>${inr(h.balance)}</b>`; }
    const f = bp[i - iToday - 1];
    return `<b>${wkLabel(f.week)}</b> · projected<br>P50: <b>${inr(f.p50)}</b><br>${t("stress")}: ${inrC(f.p10)}`;
  }, i => i <= iToday ? Y(hist[i].balance) : Y(bp[i - iToday - 1].p50));
}

/* crosshair + tooltip + snap dot on an svg chart */
function hoverize(box, X, n, contentFor, yFor) {
  const svg = $("svg", box), rect = $(".hover-rect", box), xhair = $(".xhair", box), tip = $("#tooltip");
  svg.insertAdjacentHTML("beforeend",
    `<circle class="hover-dot" r="4.5" fill="var(--gold-hi)" stroke="var(--bg1)" stroke-width="1.5" opacity="0"/>`);
  const dot = $(".hover-dot", svg);
  const vb = svg.viewBox.baseVal;
  function move(ev) {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * vb.width / r.width;
    let best = 0, bd = 1e9;
    for (let i = 0; i < n; i++) { const d2 = Math.abs(X(i) - px); if (d2 < bd) { bd = d2; best = i; } }
    xhair.setAttribute("x1", X(best)); xhair.setAttribute("x2", X(best));
    xhair.setAttribute("visibility", "visible");
    if (yFor) {
      dot.setAttribute("cx", X(best)); dot.setAttribute("cy", yFor(best));
      dot.setAttribute("opacity", "1");
    }
    tip.hidden = false; tip.innerHTML = contentFor(best);
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let tx = ev.clientX + 14, ty = ev.clientY - th - 10;
    if (tx + tw > innerWidth - 8) tx = ev.clientX - tw - 14;
    if (ty < 8) ty = ev.clientY + 14;
    tip.style.left = tx + "px"; tip.style.top = ty + "px";
  }
  rect.addEventListener("pointermove", move);
  rect.addEventListener("pointerleave", () => {
    tip.hidden = true; xhair.setAttribute("visibility", "hidden"); dot.setAttribute("opacity", "0");
  });
}

/* ---------------- ambience ---------------- */
function initSpotlight() {
  $$(".panel, .kpi").forEach(el => {
    if (el.dataset.spot) return;
    el.dataset.spot = "1";
    const isKpi = el.classList.contains("kpi");
    el.addEventListener("pointermove", ev => {
      const r = el.getBoundingClientRect();
      const nx = (ev.clientX - r.left) / r.width, ny = (ev.clientY - r.top) / r.height;
      el.style.setProperty("--mx", (nx * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (ny * 100).toFixed(1) + "%");
      if (isKpi && !REDUCED) {  // 3D tilt follows the cursor
        el.classList.add("tilting");
        el.style.transform = `translateY(-5px) perspective(720px) rotateX(${((0.5 - ny) * 6).toFixed(2)}deg) rotateY(${((nx - 0.5) * 8).toFixed(2)}deg)`;
      }
    });
    el.addEventListener("pointerleave", () => {
      if (isKpi) { el.classList.remove("tilting"); el.style.transform = ""; }
    });
  });
}

/* hero parallax (title + pulse drift toward the cursor) */
function initParallax() {
  if (REDUCED) return;
  const hero = $(".hero"), title = $(".hero-title"), pulse = $(".pulse-wrap");
  hero.addEventListener("pointermove", ev => {
    const r = hero.getBoundingClientRect();
    const nx = (ev.clientX - r.left) / r.width - 0.5, ny = (ev.clientY - r.top) / r.height - 0.5;
    title.style.transform = `translate(${(nx * 8).toFixed(1)}px, ${(ny * 5).toFixed(1)}px)`;
    pulse.style.transform = `translate(${(nx * -12).toFixed(1)}px, 0)`;
  });
  hero.addEventListener("pointerleave", () => { title.style.transform = ""; pulse.style.transform = ""; });
}

/* ---------------- command palette (Ctrl+K) ---------------- */
const PAL = { sel: 0, items: [] };
function openPalette() {
  $("#palette").hidden = false; $("#palette-scrim").hidden = false;
  const inp = $("#palette-input");
  inp.value = ""; PAL.sel = 0;
  renderPalette("");
  setTimeout(() => inp.focus(), 30);
}
function closePalette() {
  $("#palette").hidden = true; $("#palette-scrim").hidden = true;
}
function renderPalette(q) {
  q = q.trim().toLowerCase();
  PAL.items = S.portfolio.filter(r =>
    !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) ||
    r.district.toLowerCase().includes(q) || r.segment.toLowerCase().includes(q)
  ).slice(0, 12);
  PAL.sel = Math.min(PAL.sel, Math.max(0, PAL.items.length - 1));
  $("#palette-list").innerHTML = PAL.items.length ? PAL.items.map((r, i) => `
    <div class="p-item ${i === PAL.sel ? "sel" : ""}" data-id="${r.id}">
      <span class="p-name">${r.name} <b>${r.risk_score.toFixed(0)}</b></span>
      <span class="p-meta">${T[S.lang].tiers[r.tier]} · ${r.district} · ${T[S.lang].segs[r.segment] || r.segment}</span>
    </div>`).join("") : `<div class="p-empty">No matches.</div>`;
  $$("#palette-list .p-item").forEach(el => el.addEventListener("click", () => {
    closePalette(); openDrawer(el.dataset.id);
  }));
}

/* ---------------- CSV export ---------------- */
function exportCSV() {
  const rows = filtered();
  const head = "id,name,segment,district,state,risk_score,tier,runway_weeks,weekly_inflow,flags";
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map(r => [r.id, esc(r.name), r.segment, r.district, r.state,
    r.risk_score, r.tier, r.runway_weeks, Math.round(r.inflow_ma4), esc(r.flags.join("|"))].join(","));
  const blob = new Blob(["﻿" + head + "\n" + body.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "dhandrishti_watchlist.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function startClock() {
  const el = $("#clock");
  const tick = () => {
    const d = new Date();
    el.textContent = `LIVE · ${d.getDate()} ${MONTHS[d.getMonth()]} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };
  tick(); setInterval(tick, 15000);
}

addEventListener("scroll", () => {
  $("#minibar").classList.toggle("scrolled", scrollY > 40);
  const max = document.documentElement.scrollHeight - innerHeight;
  $("#progress").style.transform = `scaleX(${max > 0 ? (scrollY / max).toFixed(4) : 0})`;
}, { passive: true });

/* ---------------- events ---------------- */
$("#f-search").addEventListener("input", e => { S.filters.q = e.target.value; renderTable(); });
$("#f-segment").addEventListener("change", e => { S.filters.segment = e.target.value; renderTable(); });
$("#f-district").addEventListener("change", e => { S.filters.district = e.target.value; renderTable(); });
$$(".tier-filter button").forEach(b => b.addEventListener("click", () => {
  $$(".tier-filter button").forEach(x => x.classList.toggle("active", x === b));
  S.filters.tier = b.dataset.tier; renderTable();
}));
$$("th.sortable").forEach(th => th.addEventListener("click", () => {
  const key = th.dataset.sort;
  if (S.sort.key === key) S.sort.dir *= -1; else { S.sort.key = key; S.sort.dir = -1; }
  $$("th.sortable").forEach(x => x.removeAttribute("aria-sort"));
  th.setAttribute("aria-sort", S.sort.dir === -1 ? "descending" : "ascending");
  renderTable();
}));
$("#drawer-close").addEventListener("click", closeDrawer);
$("#drawer-scrim").addEventListener("click", closeDrawer);
addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!$("#palette").hidden) closePalette();
    else if (!$("#drawer").hidden) closeDrawer();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    $("#palette").hidden ? openPalette() : closePalette();
  }
});
$("#palette-hint").addEventListener("click", openPalette);
$("#palette-scrim").addEventListener("click", closePalette);
$("#palette-input").addEventListener("input", e => { PAL.sel = 0; renderPalette(e.target.value); });
$("#palette-input").addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { e.preventDefault(); PAL.sel = Math.min(PAL.sel + 1, PAL.items.length - 1); renderPalette(e.target.value); }
  else if (e.key === "ArrowUp") { e.preventDefault(); PAL.sel = Math.max(PAL.sel - 1, 0); renderPalette(e.target.value); }
  else if (e.key === "Enter" && PAL.items[PAL.sel]) { const id = PAL.items[PAL.sel].id; closePalette(); openDrawer(id); }
});
$("#csv-btn").addEventListener("click", exportCSV);
$("#sms-btn").addEventListener("click", () => { if (!S.current) return; S.smsOpen = !S.smsOpen; renderSms(S.current); });
$("#print-btn").addEventListener("click", printBrief);
$("#fc-table-btn").addEventListener("click", e => {
  const p = e.target.getAttribute("aria-pressed") === "true";
  e.target.setAttribute("aria-pressed", String(!p));
  if (S.current) drawForecast(S.current, !p);
});
$("#bal-table-btn").addEventListener("click", e => {
  const p = e.target.getAttribute("aria-pressed") === "true";
  e.target.setAttribute("aria-pressed", String(!p));
  if (S.current) applyScenario();
});
$("#lang-en").addEventListener("click", () => setLang("en"));
$("#lang-hi").addEventListener("click", () => setLang("hi"));
function setLang(l) {
  S.lang = l; document.body.dataset.lang = l;
  $("#lang-en").classList.toggle("active", l === "en");
  $("#lang-hi").classList.toggle("active", l === "hi");
  $("#lang-en").setAttribute("aria-pressed", String(l === "en"));
  $("#lang-hi").setAttribute("aria-pressed", String(l === "hi"));
  renderAll();
}

boot();
