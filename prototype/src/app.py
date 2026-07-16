"""DhanDrishti API + dashboard server.

Serves precomputed scores/forecasts (data/scores.json) and the static
single-page dashboard. Zero external network calls — works fully offline.

Run:  python -m uvicorn app:app --port 8765   (from prototype/src)
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parent / "data"

app = FastAPI(title="DhanDrishti", version="0.1.0")

with open(DATA / "scores.json", encoding="utf-8") as f:
    SCORES: dict = json.load(f)
with open(DATA / "metrics.json", encoding="utf-8") as f:
    METRICS: dict = json.load(f)

TIER_ORDER = {"HIGH": 0, "WATCH": 1, "STABLE": 2}


@app.get("/api/portfolio")
def portfolio():
    rows = []
    for v in SCORES.values():
        rows.append(dict(
            id=v["id"], name=v["name"], segment=v["segment"],
            district=v["district"], state=v["state"],
            risk_score=v["risk_score"], tier=v["tier"],
            flags=[f["code"] for f in v["flags"]],
            runway_weeks=v["kpis"]["runway_weeks"],
            inflow_ma4=v["kpis"]["inflow_ma4"],
            net_cf_ma4=v["kpis"]["net_cf_ma4"],
            upi_share=v["kpis"]["upi_share"],
            spark=[h["net"] for h in v["history"][-26:]],
        ))
    rows.sort(key=lambda r: (TIER_ORDER[r["tier"]], -r["risk_score"]))
    return rows


@app.get("/api/enterprise/{eid}")
def enterprise(eid: str):
    if eid not in SCORES:
        raise HTTPException(404, f"unknown enterprise {eid}")
    return SCORES[eid]


@app.get("/api/meta")
def meta():
    return METRICS


app.mount("/", StaticFiles(directory=ROOT / "static", html=True), name="static")
