/* Build DhanDrishti_Concept_Note.docx — Round 1 idea submission. */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  LevelFormat, ImageRun, convertInchesToTwip,
} = require("docx");

const ASSETS = path.join(__dirname, "..", "assets");
const OUT = path.join(__dirname, "..", "DhanDrishti_Concept_Note.docx");

const INK = "1D2A52";      // deep indigo
const ACCENT = "B8860B";   // ledger gold
const BODY = "222222";
const MUTED = "666666";

const CONTENT_W = 9026;    // A4 minus 1" margins, in DXA

const p = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, size: opts.size || 21, color: opts.color || BODY, bold: opts.bold, italics: opts.italics })],
  spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
  alignment: opts.align,
});

const h = (text, level = HeadingLevel.HEADING_1) => new Paragraph({
  heading: level,
  spacing: { before: 260, after: 120 },
  children: [new TextRun({ text, bold: true, color: INK, size: level === HeadingLevel.HEADING_1 ? 26 : 23 })],
});

const bullets = (items, ref = "b1") => items.map(t => new Paragraph({
  children: [new TextRun({ text: t, size: 21, color: BODY })],
  numbering: { reference: ref, level: 0 },
  spacing: { after: 70 },
}));

function cell(text, { w, bold, shade, color, size } = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: shade ? { type: ShadingType.CLEAR, fill: shade } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold, size: size || 19, color: color || BODY })],
      spacing: { after: 0 },
    })],
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ children: headers.map((t, i) => cell(t, { w: widths[i], bold: true, shade: "EEF1F8", color: INK })) , tableHeader: true }),
      ...rows.map(r => new TableRow({ children: r.map((t, i) => cell(t, { w: widths[i] })) })),
    ],
  });
}

const img = (file, w, hh) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 120, after: 60 },
  children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(ASSETS, file)), transformation: { width: w, height: hh } })],
});

const caption = (text) => p(text, { size: 17, color: MUTED, align: AlignmentType.CENTER, after: 160 });

const doc = new Document({
  numbering: {
    config: [{
      reference: "b1",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
                 style: { paragraph: { indent: { left: 360, hanging: 200 } } } }],
    }],
  },
  styles: {
    default: { document: { run: { font: "Calibri", size: 21, color: BODY } } },
  },
  sections: [{
    properties: {},
    children: [
      // ---------- title block ----------
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: "NABARD Hackathon @ Global FinTech Fest 2026 — Round 1 Idea Submission", size: 18, color: MUTED, allCaps: true })],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: "DhanDrishti", bold: true, size: 56, color: INK, font: "Georgia" }),
          new TextRun({ text: "  धन-दृष्टि", size: 40, color: ACCENT, font: "Georgia" }),
        ],
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: "Cash-flow foresight and early-warning intelligence for rural micro enterprises", size: 26, color: BODY, italics: true, font: "Georgia" })],
      }),
      new Paragraph({
        spacing: { after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT } },
        children: [new TextRun({ text: "Theme: AI-Driven Cash Flow Prediction & Risk Flagging System for Rural Micro Enterprises", size: 19, color: MUTED })],
      }),

      // ---------- executive summary ----------
      h("1. Executive summary"),
      p("DhanDrishti is an AI platform that gives lenders, NABARD field teams and rural entrepreneurs the same thing city CFOs take for granted: knowing what their cash position will look like three months from now. For every enrolled micro enterprise, it produces a probabilistic 12-week cash-flow forecast, a calibrated 0–100 risk score with discrete early-warning flags, plain-language bilingual (English/Hindi) reason codes explaining every alert, and a concrete recommended intervention for the field officer — weeks before a missed EMI would reveal the problem."),
      p("We are not submitting only an idea: a working prototype already exists. On a realistic 200-enterprise simulated panel it forecasts weekly net cash flow 25% more accurately than a seasonal-naive baseline, detects engineered distress episodes with AUC 0.83, and raises its first alert a median of 3 weeks before the distress event — with every alert carrying human-readable reasons and a suggested action.", { bold: false }),

      // ---------- problem ----------
      h("2. The problem"),
      ...bullets([
        "Only ~14% of India's 6.3 crore MSMEs have access to formal credit (Deloitte, 2025); the financing gap is ≥ ₹25 lakh crore and worst in rural districts (~32% vs ~20% urban).",
        "Rural micro enterprises — kirana stores, dairy units, tailoring shops, agri-input dealers, food processors, handloom weavers — are credit-invisible: cash-heavy, seasonal, with no audited books and thin bureau files.",
        "Lenders (RRBs, DCCBs, MFIs, SFBs) discover stress only after a missed instalment; field officers have no forward-looking tooling, so interventions come too late and NPAs crystallise.",
        "Meanwhile the raw signal now exists at national scale — UPI (~21.7 billion transactions/month), the Account Aggregator framework (₹1.67 lakh crore disbursed on AA rails in FY25), open mandi price and weather feeds — but nobody has stitched it into enterprise-level cash-flow foresight for Bharat.",
      ]),

      // ---------- solution ----------
      h("3. What DhanDrishti delivers"),
      table(
        ["Output", "What it answers", "For whom"],
        [
          ["12-week probabilistic cash-flow forecast (P10/P50/P90, conformally calibrated)", "“Will this enterprise face a liquidity crunch before Diwali?”", "Lenders, field officers"],
          ["Risk score (0–100) + early-warning flags (liquidity crunch ahead, EMI stress, buyer concentration, payment irregularity, seasonal dip, negative trend)", "“Who in my portfolio needs attention this week — and why?”", "Portfolio & branch managers"],
          ["Bilingual reason codes (TreeSHAP → curated English + Hindi templates)", "“Explain this alert so I can act on it”", "Field officers, BC sakhis"],
          ["Recommended interventions", "“What should I do — restructure the EMI, advance working capital, diversify buyers?”", "Field officers, entrepreneurs"],
        ],
        [3300, 3300, 2426],
      ),
      p("", { after: 60 }),
      p("Surfaces: a lender/field dashboard (offline-capable PWA, English/Hindi toggle), a scoring API for bank LOS/LMS integration via OCEN-style rails, and (roadmap) SMS/WhatsApp/IVR vernacular nudges directly to the entrepreneur.", { after: 160 }),

      // ---------- how it works ----------
      h("4. How it works"),
      h("4.1 Data strategy — consent-first, DPI-native", HeadingLevel.HEADING_2),
      table(
        ["Source", "Signal", "Access rail"],
        [
          ["Bank / UPI statements", "Inflow-outflow rhythm, counterparty diversity, balance trajectory", "Account Aggregator (consented)"],
          ["QR / UPI merchant payments", "Daily revenue proxy, customer count, ticket size", "PSP APIs / AA"],
          ["SHG/JLG ledgers, Udyam registry", "Group repayment history, enterprise vintage & segment", "NABARD / SHG federation MoUs"],
          ["Mandi & commodity prices", "Input-cost and realisation trends", "Agmarknet / eNAM open data"],
          ["Weather & crop calendar", "Monsoon risk, harvest timing", "IMD open data"],
          ["Festival / event calendar", "Demand seasonality", "Curated"],
        ],
        [2600, 4000, 2426],
      ),
      p("", { after: 60 }),
      p("No Aadhaar numbers, no location tracking, no social-media scraping. Consent artefacts are logged per the AA framework; features are pseudonymous — aligned with the DPDP Act from day one. Cold start is handled with segment-level seasonality priors that refine as history accrues.", { after: 160 }),
      h("4.2 AI engine", HeadingLevel.HEADING_2),
      ...bullets([
        "Probabilistic forecaster: gradient-boosted quantile regression (P10/P50/P90) over ~28 engineered weekly features, direct multi-horizon to 12 weeks, conformalized on a temporal holdout so the 80% band actually covers 80%.",
        "Early-warning classifier: gradient-boosted model predicting distress within 8 weeks, with domain monotonicity constraints (risk can only rise as runway falls, as EMI burden rises, as volatility rises …) and Platt calibration — smooth, defensible probabilities, not black-box spikes.",
        "Explainability as a feature: TreeSHAP attributions are mapped to a curated vocabulary of ~10 reason codes rendered from bilingual templates — e.g. “Revenue is down ~58% vs the same season last year” / “आय पिछले वर्ष की इसी अवधि से लगभग 58% कम है”.",
        "Rules overlay: transparent domain rules (stress-path balance projection, EMI-to-inflow, segment-relative concentration and volatility) generate discrete flags; the final score blends model probability with rule severity so the score and the flags can never contradict each other.",
        "Segment-aware by design: six enterprise archetypes (kirana, dairy, tailoring, agri-inputs, food processing, handloom) with distinct seasonality priors — a dairy unit's single-cooperative concentration is normal; a kirana store's is not.",
      ]),

      // ---------- prototype ----------
      h("5. Already built: working prototype and measured results"),
      p("We built the full pipeline — synthetic-but-realistic data generator (200 enterprises × 104 weeks with harvest/festival/monsoon seasonality, UPI adoption drift, owner household draws, and ground-truth distress episodes), feature store, both models, and an offline-capable bilingual dashboard (FastAPI + zero-dependency SVG frontend; runs on a laptop, deployable on-prem at an RRB)."),
      table(
        ["Metric (temporal holdout)", "Result"],
        [
          ["Forecast MAE vs seasonal-naive baseline", "−25% (skill 0.25)"],
          ["P10–P90 band coverage after conformal calibration", "80% (nominal 80%)"],
          ["Early-warning AUC / average precision", "0.83 / 0.51 (13× lift over 3.9% base rate)"],
          ["Median warning lead time before distress event", "3 weeks"],
          ["Portfolio triage on demo panel", "10 HIGH · 4 WATCH of 200 — every top-10 alert corresponds to a genuine engineered distress ramp"],
        ],
        [5800, 3226],
      ),
      img("ui_drawer_story.png", 440, 372),
      caption("The working dashboard drill-down: calibrated risk dial, early-warning flags with recommended actions, SMS-nudge and printable field-brief tools, bilingual (EN/हिंदी) throughout — fully offline-capable."),
      img("fig_balance.png", 600, 237),
      caption("Actual prototype output: projected balance with conformal stress path — flagged 9 weeks before the projected ₹0 crossing, with a concrete recommended action."),
      img("fig_forecast.png", 600, 236),
      caption("Actual prototype output: 12-week probabilistic net cash-flow forecast for the same enterprise."),

      // ---------- innovation ----------
      h("6. Why this is different"),
      ...bullets([
        "Probabilistic, not point estimates: lending decisions ride on the stress path (P10), not an average that hides tail risk — and the bands are honest (conformalized).",
        "Explainable in the field officer's language: every alert ships with Hindi/English reason codes and one recommended action — adoption lives or dies on this, and it anticipates RBI's digital-lending transparency expectations.",
        "Score and flags can never disagree: a noisy-OR blend of calibrated model probability and transparent rules — auditors and field staff see the same story.",
        "Low-network by design: offline-capable PWA, zero external assets, CPU-only models (LightGBM) that run on-prem at an RRB data centre; SMS fallback on the roadmap.",
        "DPI-native: designed around Account Aggregator consent, OCEN-style APIs, Agmarknet/IMD open data — no proprietary data moats, which is exactly what makes it deployable by public institutions.",
      ]),

      // ---------- feasibility ----------
      h("7. Feasibility and deployment path"),
      p("The stack is deliberately boring where it should be: Python, LightGBM, FastAPI — no GPUs, no exotic infrastructure. A district pilot needs one server (or a NABARD/partner-bank VM), AA consent journeys for enrolled enterprises, and field-officer onboarding. The models retrain weekly in minutes on CPU. Because the entire demo runs offline on synthetic data, the same artefact doubles as a training simulator for field staff."),

      // ---------- impact ----------
      h("8. Impact"),
      ...bullets([
        "For lenders: earlier intervention → lower slippage and NPAs on micro-enterprise books; a defensible, explainable basis for cash-flow-based lending to the credit-invisible.",
        "For entrepreneurs: a bankable, consent-based cash-flow record — the on-ramp from informal moneylenders to formal working capital; vernacular nudges that help them plan for lean seasons.",
        "For NABARD: portfolio-level early-warning heatmaps across districts and segments; evidence for policy design; a reusable public-good scoring rail for RRBs, DCCBs and SHG federations.",
      ]),

      // ---------- roadmap ----------
      h("9. Roadmap"),
      table(
        ["Phase", "Scope"],
        [
          ["Prototype (done)", "Full pipeline on simulated panel: forecaster + early-warning + bilingual explainability + dashboard"],
          ["Round 2 (Jul–Aug 2026)", "Hardening, live AA-sandbox integration demo, SMS nudge prototype, demo video and deployment guide"],
          ["Pilot (post-GFF)", "One district, one RRB/DCCB partner, 500–1,000 consented enterprises; measure lead time, intervention uptake, repayment outcomes vs control"],
          ["Scale", "State roll-out via NABARD ecosystem; OCEN-integrated scoring API; multilingual expansion (Marathi, Telugu, Bangla …)"],
        ],
        [2600, 6426],
      ),

      // ---------- tech stack ----------
      h("10. Technology stack"),
      p("Python 3.10 · LightGBM (quantile + monotone-constrained classifiers) · scikit-learn (calibration) · TreeSHAP · conformal prediction · FastAPI · zero-dependency SVG dashboard (PWA-ready, EN/HI) · Account Aggregator & OCEN-style APIs (integration path) · Agmarknet / eNAM / IMD open data. Optional GenAI layer (LLM) for free-form vernacular advisory over structured outputs — roadmap, not a dependency."),

      // ---------- team ----------
      h("11. Team"),
      p("«Team name» — «member 1, role» · «member 2, role» · «member 3, role»  |  Contact: «email / phone»", { italics: true, color: MUTED }),
      p("Note: all data in this submission is synthetic; no real enterprise or personal data was used. The prototype avoids sensitive personal information by design and supports low-network environments.", { size: 17, color: MUTED, before: 200 }),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("written", OUT);
});
