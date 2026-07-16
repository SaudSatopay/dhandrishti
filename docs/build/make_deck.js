/* Build DhanDrishti_Pitch_Deck.pptx — 12 slides, 16:9 wide. */
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const Fi = require("react-icons/fi");

const ASSETS = path.join(__dirname, "..", "assets");
const OUT = path.join(__dirname, "..", "DhanDrishti_Pitch_Deck.pptx");

// palette
const INK = "1D2A52";     // deep indigo (dominant)
const INK2 = "3C4A78";
const GOLD = "C99617";    // ledger gold accent
const BLUE = "2A78D6";    // data blue
const RED = "D03B3B";
const GREEN = "0CA30C";
const PAPER = "FFFFFF";
const TINT = "F1F4FA";    // indigo 5% card tint
const GRAY = "5A5A5A";
const LIGHT = "8A8A8A";

const W = 13.333, H = 7.5, MX = 0.65;
const SERIF = "Cambria", SANS = "Calibri";

async function iconPng(name, hex, size = 256) {
  const el = React.createElement(Fi[name], { color: "#" + hex, size });
  const svg = ReactDOMServer.renderToStaticMarkup(el);
  const buf = await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function markPng(hex, size = 512) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="17" fill="none" stroke="#${hex}" stroke-width="2.4"/>
    <path d="M6 22 Q13 12 20 20 T34 18" fill="none" stroke="#${hex}" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="20" cy="20" r="3" fill="#${hex}"/></svg>`;
  const buf = await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const I = {};
  const need = [
    ["forecast", "FiTrendingUp"], ["alert", "FiAlertTriangle"], ["chat", "FiMessageSquare"],
    ["compass", "FiCompass"], ["db", "FiDatabase"], ["shield", "FiShield"],
    ["wifi", "FiWifiOff"], ["cpu", "FiCpu"], ["users", "FiUsers"], ["map", "FiMap"],
    ["check", "FiCheckCircle"], ["zap", "FiZap"], ["layers", "FiLayers"], ["globe", "FiGlobe"],
    ["eye", "FiEye"], ["bank", "FiHome"], ["rupee", "FiCreditCard"], ["flag", "FiFlag"],
  ];
  for (const [k, n] of need) I[k] = await iconPng(n, "FFFFFF");
  const Idark = {};
  for (const [k, n] of need) Idark[k] = await iconPng(n, INK);
  const MARK_GOLD = await markPng(GOLD);

  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE";
  p.author = "Team DhanDrishti";
  p.title = "DhanDrishti — NABARD Hackathon @ GFF 2026";

  const footer = (s, n) => {
    s.addText([{ text: "DhanDrishti ", options: { bold: true, color: LIGHT } },
               { text: "· NABARD Hackathon @ GFF 2026", options: { color: LIGHT } }],
      { x: MX, y: H - 0.42, w: 6, h: 0.3, fontSize: 9, fontFace: SANS, margin: 0 });
    s.addText(String(n), { x: W - 1.0, y: H - 0.42, w: 0.4, h: 0.3, fontSize: 9, color: LIGHT, align: "right", margin: 0 });
  };

  const title = (s, kicker, main, dark = false) => {
    s.addText(kicker.toUpperCase(), { x: MX, y: 0.42, w: W - 2 * MX, h: 0.3, fontSize: 12, charSpacing: 2,
      color: dark ? GOLD : GOLD, bold: true, fontFace: SANS, margin: 0 });
    s.addText(main, { x: MX, y: 0.68, w: W - 2 * MX, h: 0.75, fontSize: 30, bold: true,
      color: dark ? "FFFFFF" : INK, fontFace: SERIF, margin: 0 });
  };

  const iconCircle = (s, icon, x, y, d = 0.52, fill = INK) => {
    s.addShape("ellipse", { x, y, w: d, h: d, fill: { color: fill } });
    s.addImage({ data: icon, x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56 });
  };

  /* ---------------- 1 · title (dark) ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: INK };
    // concentric foresight rings, top-right
    s.addShape("ellipse", { x: 9.4, y: -2.4, w: 6.4, h: 6.4, fill: { type: "none" }, line: { color: INK2, width: 1 } });
    s.addShape("ellipse", { x: 10.4, y: -1.4, w: 4.4, h: 4.4, fill: { type: "none" }, line: { color: INK2, width: 1 } });
    s.addShape("ellipse", { x: 11.4, y: -0.4, w: 2.4, h: 2.4, fill: { type: "none" }, line: { color: GOLD, width: 1.2 } });
    s.addImage({ data: MARK_GOLD, x: MX, y: 1.15, w: 1.05, h: 1.05 });
    s.addText([
      { text: "DhanDrishti", options: { fontSize: 60, bold: true, color: "FFFFFF", fontFace: SERIF } },
      { text: "   धन-दृष्टि", options: { fontSize: 40, color: GOLD, fontFace: SERIF } },
    ], { x: MX - 0.05, y: 2.35, w: 11.5, h: 1.15, margin: 0 });
    s.addText("Cash-flow foresight & early-warning intelligence\nfor rural micro enterprises",
      { x: MX, y: 3.55, w: 10.5, h: 1.0, fontSize: 22, color: "E8ECF6", fontFace: SERIF, italic: true, margin: 0 });
    s.addText("AI-Driven Cash Flow Prediction & Risk Flagging System for Rural Micro Enterprises",
      { x: MX, y: 4.85, w: 9.5, h: 0.35, fontSize: 13, color: "9FB0D8", fontFace: SANS, margin: 0 });
    s.addShape("roundRect", { x: MX, y: 5.6, w: 5.55, h: 0.5, rectRadius: 0.25, fill: { type: "none" }, line: { color: GOLD, width: 1 } });
    s.addText("NABARD HACKATHON  ·  GLOBAL FINTECH FEST 2026  ·  ROUND 1", { x: MX + 0.2, y: 5.6, w: 5.35, h: 0.5,
      fontSize: 11, charSpacing: 1.5, color: GOLD, fontFace: SANS, valign: "middle", margin: 0 });
    s.addText("Working prototype included — every number in this deck is measured output.",
      { x: MX, y: 6.55, w: 9, h: 0.3, fontSize: 12, color: "9FB0D8", italic: true, fontFace: SANS, margin: 0 });
    s.addNotes("DhanDrishti = 'wealth-sight'. One line: we give rural lenders and field officers three months of cash-flow foresight per micro enterprise, with explanations in Hindi. Working prototype exists.");
  }

  /* ---------------- 2 · problem ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: PAPER };
    title(s, "The problem", "Bharat's micro enterprises are credit-invisible");
    const stats = [
      ["14%", "of India's 6.3 crore MSMEs\nhave formal credit access", "Deloitte, 2025"],
      ["₹25L Cr+", "MSME financing gap —\nworst in rural districts", "≈ rural 32% vs urban 20%"],
      ["Too late", "lenders learn of stress only\nafter an EMI is missed", "no forward-looking tooling"],
    ];
    stats.forEach(([big, sub, src], i) => {
      const x = MX + i * 4.12;
      s.addShape("roundRect", { x, y: 1.85, w: 3.82, h: 2.6, rectRadius: 0.09, fill: { color: TINT } });
      s.addText(big, { x: x + 0.25, y: 2.05, w: 3.3, h: 0.95, fontSize: 48, bold: true, color: INK, fontFace: SERIF, margin: 0 });
      s.addText(sub, { x: x + 0.25, y: 3.05, w: 3.35, h: 0.85, fontSize: 13.5, color: GRAY, fontFace: SANS, margin: 0 });
      s.addText(src, { x: x + 0.25, y: 3.95, w: 3.3, h: 0.3, fontSize: 10, italic: true, color: LIGHT, fontFace: SANS, margin: 0 });
    });
    s.addText([
      { text: "Kirana stores, dairy units, tailors, agri-input dealers, food processors, handloom weavers — ", options: { color: GRAY } },
      { text: "cash-heavy, seasonal, no audited books, thin bureau files. ", options: { color: GRAY } },
      { text: "Field officers cover hundreds of accounts with no early-warning system: by the time stress is visible, the intervention window has closed.", options: { bold: true, color: INK } },
    ], { x: MX, y: 4.95, w: W - 2 * MX, h: 1.1, fontSize: 15, fontFace: SANS, margin: 0 });
    footer(s, 2);
    s.addNotes("Anchor the size of the problem, then the operational failure: detection happens at default, not before.");
  }

  /* ---------------- 3 · the signal exists ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: PAPER };
    title(s, "The opening", "The signal now exists — nobody has stitched it together");
    const rows = [
      [I.zap, "UPI", "≈ 21.7 billion transactions a month — rural merchants included", "digital revenue rhythm, counterparty mix"],
      [I.db, "Account Aggregator", "₹1.67 lakh crore disbursed on AA rails in FY25, with user consent", "bank-statement cash flows, on tap"],
      [I.globe, "Open public data", "Agmarknet mandi prices · eNAM · IMD rainfall · crop calendars", "the context that drives rural cash cycles"],
    ];
    rows.forEach(([ic, h1, h2, h3], i) => {
      const y = 1.95 + i * 1.28;
      iconCircle(s, ic, MX, y + 0.08, 0.56);
      s.addText(h1, { x: MX + 0.8, y, w: 2.6, h: 0.45, fontSize: 19, bold: true, color: INK, fontFace: SERIF, margin: 0 });
      s.addText(h2, { x: MX + 0.8, y: y + 0.42, w: 8.6, h: 0.35, fontSize: 13.5, color: GRAY, fontFace: SANS, margin: 0 });
      s.addText("→ " + h3, { x: 9.05, y: y + 0.05, w: 3.6, h: 0.75, fontSize: 12, italic: true, color: BLUE, fontFace: SANS, margin: 0 });
    });
    s.addShape("roundRect", { x: MX, y: 5.95, w: W - 2 * MX, h: 0.75, rectRadius: 0.09, fill: { color: INK } });
    s.addText([
      { text: "The gap: ", options: { bold: true, color: GOLD } },
      { text: "these signals have never been fused into enterprise-level cash-flow foresight for rural Bharat. That is exactly what DhanDrishti does.", options: { color: "FFFFFF" } },
    ], { x: MX + 0.25, y: 5.95, w: W - 2 * MX - 0.5, h: 0.75, fontSize: 14.5, fontFace: SANS, valign: "middle", margin: 0 });
    footer(s, 3);
    s.addNotes("DPI rails make the data legally and technically reachable — consent-first. Our contribution is the fusion + foresight layer.");
  }

  /* ---------------- 4 · what it does ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: PAPER };
    title(s, "The product", "Four outputs, one loop: foresee → flag → explain → act");
    const cards = [
      [I.forecast, "Probabilistic forecast", "12-week net cash-flow bands (P10/P50/P90), conformally calibrated — honest uncertainty, not a point guess."],
      [I.alert, "Risk score + flags", "Calibrated 0–100 score with discrete early warnings: liquidity crunch ahead, EMI stress, buyer concentration, seasonal dip…"],
      [I.chat, "Bilingual reason codes", "Every alert explained in English + Hindi from SHAP attributions: “Revenue is down ~58% vs the same season last year.”"],
      [I.compass, "Recommended action", "One concrete intervention per flag: pre-approve working capital, restructure EMI post-harvest, diversify buyers."],
    ];
    cards.forEach(([ic, h1, body], i) => {
      const x = MX + (i % 2) * 6.12, y = 1.9 + Math.floor(i / 2) * 2.34;
      s.addShape("roundRect", { x, y, w: 5.9, h: 2.1, rectRadius: 0.09, fill: { color: TINT } });
      iconCircle(s, ic, x + 0.25, y + 0.28, 0.52);
      s.addText(h1, { x: x + 0.95, y: y + 0.22, w: 4.8, h: 0.4, fontSize: 17, bold: true, color: INK, fontFace: SERIF, margin: 0 });
      s.addText(body, { x: x + 0.95, y: y + 0.66, w: 4.75, h: 1.3, fontSize: 12.5, color: GRAY, fontFace: SANS, margin: 0 });
    });
    s.addText("Surfaces: offline-capable dashboard (EN/हिंदी) · scoring API for bank LOS/LMS · SMS/WhatsApp nudges (roadmap)",
      { x: MX, y: 6.55, w: W - 2 * MX, h: 0.35, fontSize: 12.5, italic: true, color: GRAY, fontFace: SANS, align: "center", margin: 0 });
    footer(s, 4);
    s.addNotes("The loop matters: prediction alone doesn't change outcomes; explained, actionable prediction does.");
  }

  /* ---------------- 5 · prototype: command deck (dark) ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: "0A0D1C" };
    title(s, "Live prototype", "The command deck — running, offline, bilingual", true);
    s.addImage({ path: path.join(ASSETS, "ui_overview.png"), x: 0.65, y: 1.68, w: 6.4, h: 5.33 });
    const feats = [
      ["Live alert ticker", "Every HIGH/WATCH enterprise scrolls past with its top flag — click any alert to drill straight in."],
      ["Risk-ranked watchlist", "200 enterprises, calibrated 0–100 scores, sparklines and signal chips; search, filter, sort in place."],
      ["Bilingual & offline", "EN/हिंदी toggle on every reason and action; zero external assets — the demo runs with the internet off."],
    ];
    feats.forEach(([h1, body], i) => {
      const y = 1.95 + i * 1.55;
      s.addShape("roundRect", { x: 7.45, y, w: 5.25, h: 1.35, rectRadius: 0.08, fill: { color: "141A35" }, line: { color: "2A335C", width: 0.75 } });
      s.addText(h1.toUpperCase(), { x: 7.7, y: y + 0.12, w: 4.8, h: 0.3, fontSize: 11, charSpacing: 1.5, bold: true, color: GOLD, fontFace: SANS, margin: 0 });
      s.addText(body, { x: 7.7, y: y + 0.44, w: 4.8, h: 0.85, fontSize: 12, color: "C9D3EC", fontFace: SANS, margin: 0 });
    });
    s.addText("Deep-link any enterprise for the jury: localhost:8765/#ENT0178",
      { x: 7.45, y: 6.62, w: 5.25, h: 0.3, fontSize: 11, italic: true, color: "7C8BB8", fontFace: SANS, margin: 0 });
    footer(s, 5);
    s.addNotes("Everything on this slide is the running product, not a mockup. The hero pulse line is the top-risk enterprise's actual cash-flow history drawing itself.");
  }

  /* ---------------- 6 · prototype: drill-down story (dark) ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: "0A0D1C" };
    title(s, "Live prototype — the drill-down", "Nine weeks of warning before the balance hits zero", true);
    s.addImage({ path: path.join(ASSETS, "ui_drawer_story.png"), x: 0.65, y: 1.72, w: 6.0, h: 5.08 });
    s.addText([
      { text: "Risk 79/100 — flagged today. ", options: { bold: true, color: "FFFFFF" } },
      { text: "The stress path crosses ₹0 in week 9. The field officer sees two flags, four plain-language reasons, and one concrete action: pre-approve a working-capital line now — in Hindi if she prefers. A missed EMI would have surfaced this ~2 months later.", options: { color: "C9D3EC" } },
    ], { x: 7.1, y: 1.85, w: 5.55, h: 2.15, fontSize: 14, fontFace: SANS, margin: 0 });
    s.addImage({ path: path.join(ASSETS, "ui_stress_chart.png"), x: 7.1, y: 4.35, w: 5.55, h: 2.2 });
    footer(s, 6);
    s.addNotes("Walk the eye: risk dial, flags with suggested actions, then the stress chart — the pulsing red dot is the projected ₹0 crossing in week 9.");
  }

  /* ---------------- 6 · engine ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: PAPER };
    title(s, "Under the hood", "Boring where it should be, clever where it counts");
    const rows = [
      [I.layers, "Feature store", "28 weekly signals per enterprise: cash-flow trend & volatility, runway, UPI share drift, buyer concentration, EMI burden, mandi & rainfall context, festival calendar."],
      [I.forecast, "Quantile forecaster", "Gradient-boosted P10/P50/P90, direct multi-horizon (12 wk), conformalized on a temporal holdout — the 80% band actually covers 80%."],
      [I.alert, "Early-warning classifier", "Predicts distress within 8 weeks. Domain monotonicity constraints (risk ↑ as runway ↓, EMI ↑, volatility ↑) + Platt calibration = smooth, defensible probabilities."],
      [I.eye, "Explainability layer", "TreeSHAP → curated bilingual reason codes. Transparent rules overlay generates flags; a noisy-OR blend guarantees the score and flags never contradict."],
    ];
    rows.forEach(([ic, h1, body], i) => {
      const y = 1.8 + i * 1.22;
      iconCircle(s, ic, MX, y + 0.06, 0.5);
      s.addText(h1, { x: MX + 0.75, y, w: 3.1, h: 0.5, fontSize: 16, bold: true, color: INK, fontFace: SERIF, margin: 0 });
      s.addText(body, { x: 4.55, y, w: 8.15, h: 1.1, fontSize: 12.5, color: GRAY, fontFace: SANS, margin: 0 });
      if (i < rows.length - 1) s.addShape("line", { x: 4.55, y: y + 1.06, w: 8.15, h: 0, line: { color: "E3E3E3", width: 0.75 } });
    });
    s.addText("CPU-only (LightGBM) · retrains weekly in minutes · runs on-prem at an RRB data centre",
      { x: MX, y: 6.75, w: W - 2 * MX, h: 0.3, fontSize: 12, italic: true, color: BLUE, fontFace: SANS, margin: 0 });
    footer(s, 7);
    s.addNotes("Judges' trust: no exotic infra. Monotone constraints + calibration + conformal = the rigor story. Roadmap: temporal fusion transformers once history deepens.");
  }

  /* ---------------- 7 · measured results ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: PAPER };
    title(s, "Measured, not promised", "Prototype results on a 200-enterprise simulated panel");
    const stats = [
      ["−25%", "forecast MAE vs\nseasonal-naive baseline"],
      ["80%", "band coverage after\nconformal calibration"],
      ["0.83", "early-warning AUC\n(13× precision lift)"],
      ["3 wks", "median warning lead\nbefore distress"],
    ];
    stats.forEach(([big, sub], i) => {
      const x = MX + i * 3.08;
      s.addShape("roundRect", { x, y: 1.85, w: 2.86, h: 1.95, rectRadius: 0.09, fill: { color: TINT } });
      s.addText(big, { x: x + 0.2, y: 2.0, w: 2.5, h: 0.8, fontSize: 40, bold: true, color: BLUE, fontFace: SERIF, margin: 0 });
      s.addText(sub, { x: x + 0.2, y: 2.85, w: 2.5, h: 0.8, fontSize: 12, color: GRAY, fontFace: SANS, margin: 0 });
    });
    s.addImage({ path: path.join(ASSETS, "fig_portfolio.png"), x: 0.95, y: 4.05, w: 6.1, h: 2.65 });
    s.addText([
      { text: "Every top-10 alert on the demo panel corresponds to a genuine engineered distress ramp. ", options: { bold: true, color: INK } },
      { text: "Data is synthetic-but-realistic: harvest & festival seasonality, monsoon shocks, UPI adoption drift, household draws, and ground-truth distress episodes — so accuracy is measurable, honestly.", options: { color: GRAY } },
    ], { x: 7.35, y: 4.25, w: 5.3, h: 2.3, fontSize: 13, fontFace: SANS, margin: 0 });
    footer(s, 8);
    s.addNotes("Temporal holdout = last 16 weeks unseen in training. Simulated panel is the honest Round-1 posture; AA sandbox integration is the Round-2 plan.");
  }

  /* ---------------- 8 · data strategy ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: PAPER };
    title(s, "Data strategy", "Consent-first and DPI-native by design");
    const rows = [
      [I.db, "Account Aggregator", "bank/UPI statements — inflow rhythm, balances, counterparties (consented pull)"],
      [I.zap, "UPI / QR payments", "daily revenue proxy, customer count, ticket size"],
      [I.users, "SHG / JLG ledgers · Udyam", "group repayment history, enterprise vintage & segment"],
      [I.map, "Agmarknet · eNAM · IMD", "mandi prices, rainfall, crop calendar — the rural context layer"],
    ];
    rows.forEach(([ic, h1, body], i) => {
      const y = 1.85 + i * 1.06;
      iconCircle(s, ic, MX, y + 0.02, 0.5);
      s.addText(h1, { x: MX + 0.75, y, w: 3.65, h: 0.5, fontSize: 15.5, bold: true, color: INK, fontFace: SERIF, margin: 0 });
      s.addText(body, { x: 5.0, y: y + 0.02, w: 7.6, h: 0.95, fontSize: 12.5, color: GRAY, fontFace: SANS, margin: 0 });
    });
    s.addShape("roundRect", { x: MX, y: 6.15, w: W - 2 * MX, h: 0.72, rectRadius: 0.09, fill: { color: "EAF6EA" } });
    s.addImage({ data: Idark.shield, x: MX + 0.22, y: 6.32, w: 0.38, h: 0.38 });
    s.addText([
      { text: "No Aadhaar numbers · no location tracking · no scraping. ", options: { bold: true, color: INK } },
      { text: "Pseudonymous features, logged consent artefacts, DPDP-aligned. Cold start via segment seasonality priors.", options: { color: GRAY } },
    ], { x: MX + 0.75, y: 6.15, w: 11.2, h: 0.72, fontSize: 12.5, fontFace: SANS, valign: "middle", margin: 0 });
    footer(s, 9);
    s.addNotes("Consent-first isn't compliance theater — AA is the reason this is deployable by public institutions without a proprietary data moat.");
  }

  /* ---------------- 9 · built for the field ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: PAPER };
    title(s, "Built for the field", "If a BC sakhi can't use it, it doesn't count");
    const cards = [
      [I.wifi, "Works where the network doesn't", "Offline-capable PWA, zero external assets, SMS fallback on the roadmap. Demo runs with the internet switched off."],
      [I.chat, "Speaks the field officer's language", "Every reason and action in English + Hindi (extensible to Marathi, Telugu, Bangla…). Not a score — a sentence someone can act on."],
      [I.cpu, "Runs on what banks already have", "CPU-only models, one server per district pilot, on-prem deployable at an RRB — no cloud dependency, no GPUs."],
    ];
    cards.forEach(([ic, h1, body], i) => {
      const x = MX + i * 4.12;
      s.addShape("roundRect", { x, y: 1.9, w: 3.85, h: 3.0, rectRadius: 0.09, fill: { color: TINT } });
      iconCircle(s, ic, x + 0.28, y = 2.2, 0.56);
      s.addText(h1, { x: x + 0.28, y: 2.95, w: 3.3, h: 0.75, fontSize: 15.5, bold: true, color: INK, fontFace: SERIF, margin: 0 });
      s.addText(body, { x: x + 0.28, y: 3.7, w: 3.3, h: 1.1, fontSize: 12, color: GRAY, fontFace: SANS, margin: 0 });
    });
    // bilingual sample strip
    s.addShape("roundRect", { x: MX, y: 5.25, w: W - 2 * MX, h: 1.35, rectRadius: 0.09, fill: { color: INK } });
    s.addText("SAMPLE ALERT — AS THE FIELD OFFICER SEES IT", { x: MX + 0.25, y: 5.38, w: 8, h: 0.28, fontSize: 9.5, charSpacing: 1.5, bold: true, color: GOLD, fontFace: SANS, margin: 0 });
    s.addText([
      { text: "▲ Liquidity crunch ahead — stress-case balance dips below zero in 9 weeks.  →  Pre-approve a short-term working-capital line; schedule a field visit this week.", options: { color: "FFFFFF", breakLine: true } },
      { text: "▲ नकदी संकट की आशंका — तनाव-परिदृश्य में 9 सप्ताह में शेष राशि शून्य से नीचे जा सकती है।  →  अभी अल्पकालिक कार्यशील-पूंजी सीमा स्वीकृत करें; इसी सप्ताह क्षेत्र भ्रमण तय करें।", options: { color: "E8ECF6" } },
    ], { x: MX + 0.25, y: 5.68, w: W - 2 * MX - 0.5, h: 0.85, fontSize: 12, fontFace: SANS, margin: 0 });
    footer(s, 10);
    s.addNotes("The Hindi line is generated by the system (templated reason codes), not marketing copy — it's in the live demo.");
  }

  /* ---------------- 10 · impact ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: PAPER };
    title(s, "Impact", "One rail, three winners");
    const cols = [
      [I.bank, "Lenders (RRBs, DCCBs, MFIs)", ["Weeks of early warning → intervene before slippage, cut micro-book NPAs", "Explainable, auditable basis for cash-flow-based lending", "Portfolio heatmaps by district & segment"]],
      [I.rupee, "Rural entrepreneurs", ["A bankable, consent-based cash-flow record — the on-ramp from moneylenders to formal credit", "Vernacular nudges to plan for lean seasons", "Credit priced on evidence, not absence of it"]],
      [I.flag, "NABARD & policy", ["District-level early-warning view across the rural portfolio", "Evidence base for scheme design & timing", "A reusable public-good scoring rail for the SHG/RRB ecosystem"]],
    ];
    cols.forEach(([ic, h1, items], i) => {
      const x = MX + i * 4.12;
      iconCircle(s, ic, x, 1.85, 0.54);
      s.addText(h1, { x, y: 2.55, w: 3.85, h: 0.65, fontSize: 15.5, bold: true, color: INK, fontFace: SERIF, margin: 0 });
      s.addText(items.map((tx, j) => ({ text: tx, options: { bullet: { characterCode: "2013", indent: 12 }, breakLine: j < items.length - 1, paraSpaceAfter: 8 } })),
        { x, y: 3.25, w: 3.85, h: 3.0, fontSize: 12, color: GRAY, fontFace: SANS, margin: 0 });
    });
    footer(s, 11);
    s.addNotes("Framing: not another fintech credit score — an early-warning public rail aligned with NABARD's institutional mandate.");
  }

  /* ---------------- 11 · roadmap ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: PAPER };
    title(s, "Roadmap", "From working prototype to district pilot");
    const steps = [
      ["NOW · DONE", "Working prototype", "Full pipeline: data → models → bilingual dashboard. Measured: −25% MAE, AUC 0.83, 3-wk lead.", GREEN],
      ["JUL–AUG 2026", "Round 2 build", "AA-sandbox integration demo, SMS nudge prototype, hardening, demo video + deployment guide.", BLUE],
      ["POST-GFF", "District pilot", "One RRB/DCCB partner, 500–1,000 consented enterprises. Measure lead time, intervention uptake, repayment outcomes vs control.", INK],
      ["THEN", "Scale via NABARD", "State roll-out through the RRB/SHG ecosystem, OCEN-integrated scoring API, more languages.", GOLD],
    ];
    const y0 = 3.15;
    s.addShape("line", { x: MX + 0.55, y: y0 + 0.27, w: W - 2 * MX - 1.1, h: 0, line: { color: "D8D8D8", width: 1.5 } });
    steps.forEach(([when, h1, body, col], i) => {
      const x = MX + i * 3.08;
      s.addShape("ellipse", { x: x + 0.35, y: y0, w: 0.54, h: 0.54, fill: { color: col } });
      s.addText(String(i + 1), { x: x + 0.35, y: y0, w: 0.54, h: 0.54, fontSize: 16, bold: true, color: "FFFFFF", align: "center", valign: "middle", fontFace: SANS, margin: 0 });
      s.addText(when, { x, y: y0 - 0.75, w: 2.9, h: 0.3, fontSize: 10.5, charSpacing: 1, bold: true, color: col, fontFace: SANS, margin: 0 });
      s.addText(h1, { x, y: y0 + 0.75, w: 2.9, h: 0.4, fontSize: 15.5, bold: true, color: INK, fontFace: SERIF, margin: 0 });
      s.addText(body, { x, y: y0 + 1.2, w: 2.85, h: 1.6, fontSize: 11.5, color: GRAY, fontFace: SANS, margin: 0 });
    });
    footer(s, 12);
    s.addNotes("Pilot success metric is not model AUC — it's intervention uptake and repayment outcomes vs control branches.");
  }

  /* ---------------- 12 · close (dark) ---------------- */
  {
    const s = p.addSlide();
    s.background = { color: INK };
    s.addShape("ellipse", { x: -2.4, y: 3.9, w: 6.4, h: 6.4, fill: { type: "none" }, line: { color: INK2, width: 1 } });
    s.addShape("ellipse", { x: -1.4, y: 4.9, w: 4.4, h: 4.4, fill: { type: "none" }, line: { color: GOLD, width: 1 } });
    s.addImage({ data: MARK_GOLD, x: MX, y: 0.9, w: 0.85, h: 0.85 });
    s.addText("Seeing cash-flow stress\nbefore it strikes.", { x: MX, y: 2.0, w: 11, h: 2.0, fontSize: 44, bold: true, color: "FFFFFF", fontFace: SERIF, margin: 0 });
    s.addText([
      { text: "DhanDrishti ", options: { bold: true, color: GOLD } },
      { text: "· cash-flow foresight & early warning for rural micro enterprises", options: { color: "C9D3EC" } },
    ], { x: MX, y: 4.15, w: 11.5, h: 0.4, fontSize: 16, fontFace: SANS, margin: 0 });
    s.addText("Team «name» — «members & roles»   ·   «email»   ·   «phone»",
      { x: MX, y: 5.15, w: 11.5, h: 0.4, fontSize: 14, italic: true, color: "9FB0D8", fontFace: SANS, margin: 0 });
    s.addText("Prototype: runs offline on a laptop · synthetic data only · no real enterprise or personal data",
      { x: MX, y: 6.6, w: 11.5, h: 0.35, fontSize: 11, color: "7C8BB8", fontFace: SANS, margin: 0 });
    s.addNotes("Close with the pilot ask: one district, one RRB partner, 500 consented enterprises.");
  }

  await p.writeFile({ fileName: OUT });
  console.log("written", OUT);
})();
