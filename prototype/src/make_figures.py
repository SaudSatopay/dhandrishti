"""Render deck/README figures from actual model outputs (scores.json).

Style follows the dataviz method: thin marks, hairline grid, direct labels,
validated palette, no chartjunk.
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / "docs" / "assets"
OUT.mkdir(parents=True, exist_ok=True)

BLUE, BLUE_WASH = "#2a78d6", (42 / 255, 120 / 255, 214 / 255, 0.16)
INK, INK2, MUTED, GRID = "#0b0b0b", "#52514e", "#898781", "#e1e0d9"
CRIT, WARN, GOOD = "#d03b3b", "#fab219", "#0ca30c"

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 11,
    "axes.edgecolor": GRID, "axes.linewidth": 0.8,
    "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.7,
    "axes.axisbelow": True, "figure.facecolor": "white", "axes.facecolor": "white",
    "text.color": INK, "axes.labelcolor": INK2, "xtick.color": MUTED, "ytick.color": MUTED,
})

scores = json.load(open(ROOT / "data" / "scores.json", encoding="utf-8"))
metrics = json.load(open(ROOT / "data" / "metrics.json", encoding="utf-8"))

# pick the top HIGH-risk enterprise with a liquidity flag for the story figures
story = next(v for v in sorted(scores.values(), key=lambda v: -v["risk_score"])
             if any(f["code"] == "LIQUIDITY_CRUNCH_AHEAD" for f in v["flags"]))
print("story enterprise:", story["id"], story["name"], story["risk_score"])


def lakh(x, _pos=None):
    if abs(x) >= 100000:
        return f"₹{x/100000:.1f}L"
    return f"₹{x/1000:.0f}k"


def despine(ax):
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)


# ---------------------------------------------------------------- fig 1
def fig_forecast():
    h = story["history"][-40:]
    fc = story["forecast"]
    hd = pd.to_datetime([r["week"] for r in h])
    fd = pd.to_datetime([r["week"] for r in fc])
    fig, ax = plt.subplots(figsize=(8.6, 3.4), dpi=200)
    ax.plot(hd, [r["net"] for r in h], color=INK2, lw=1.8, label="History")
    ax.plot([hd[-1], *fd], [h[-1]["net"], *[r["p50"] for r in fc]], color=BLUE, lw=2.4, label="P50 forecast")
    ax.fill_between(fd, [r["p10"] for r in fc], [r["p90"] for r in fc],
                    color=BLUE_WASH, linewidth=0, label="80% band (conformal)")
    ax.axvline(hd[-1], color=MUTED, lw=0.9, ls=(0, (3, 3)))
    ax.text(hd[-1], ax.get_ylim()[1], " today", color=MUTED, fontsize=9, va="top")
    ax.axhline(0, color="#c3c2b7", lw=1.1)
    ax.yaxis.set_major_formatter(lakh)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
    seg_name = dict(kirana="Kirana", dairy="Dairy", tailoring="Tailoring", agri_inputs="Agri inputs",
                    food_processing="Food processing", handloom="Handloom")[story["segment"]]
    ax.set_title(f"Weekly net cash flow — 12-week probabilistic forecast · {story['name']} ({seg_name})",
                 fontsize=11.5, loc="left", color=INK, pad=10)
    ax.legend(loc="lower left", frameon=False, fontsize=9, ncols=3)
    despine(ax)
    fig.tight_layout()
    fig.savefig(OUT / "fig_forecast.png", bbox_inches="tight")
    plt.close(fig)


# ---------------------------------------------------------------- fig 2
def fig_balance():
    h = story["history"][-20:]
    bp = story["balance_path"]
    hd = pd.to_datetime([r["week"] for r in h])
    fd = pd.to_datetime([r["week"] for r in bp])
    fig, ax = plt.subplots(figsize=(8.6, 3.4), dpi=200)
    ax.plot(hd, [r["balance"] for r in h], color=INK2, lw=1.8, label="Balance history")
    ax.plot([hd[-1], *fd], [h[-1]["balance"], *[r["p50"] for r in bp]], color=BLUE, lw=2.4, label="Central path (P50)")
    ax.plot([hd[-1], *fd], [h[-1]["balance"], *[r["p10"] for r in bp]], color=BLUE, lw=1.6,
            ls=(0, (5, 4)), alpha=0.8, label="Stress path (P10)")
    ax.fill_between(fd, [r["p10"] for r in bp], [r["p90"] for r in bp], color=BLUE_WASH, linewidth=0)
    ax.axhline(0, color="#c3c2b7", lw=1.1)
    ax.axvline(hd[-1], color=MUTED, lw=0.9, ls=(0, (3, 3)))
    cross = next((i for i, r in enumerate(bp) if r["p10"] < 0), None)
    if cross is not None:
        ax.plot([fd[cross]], [0], "o", ms=8, color=CRIT, mec="white", mew=1.5, zorder=5)
        ax.annotate(f"▲ stress path < ₹0 · week {cross+1}\n→ pre-approve working capital now",
                    (fd[cross], 0), textcoords="offset points", xytext=(10, 14),
                    fontsize=9.5, color=CRIT, fontweight="bold")
    ax.yaxis.set_major_formatter(lakh)
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b"))
    ax.set_title(f"Projected cash balance & early warning · {story['name']} — risk {story['risk_score']:.0f}/100",
                 fontsize=11.5, loc="left", color=INK, pad=10)
    ax.legend(loc="upper right", frameon=False, fontsize=9)
    despine(ax)
    fig.tight_layout()
    fig.savefig(OUT / "fig_balance.png", bbox_inches="tight")
    plt.close(fig)


# ---------------------------------------------------------------- fig 3
def fig_portfolio():
    segs = {}
    for v in scores.values():
        segs.setdefault(v["segment"], [0, 0])
        if v["tier"] == "HIGH":
            segs[v["segment"]][0] += 1
        elif v["tier"] == "WATCH":
            segs[v["segment"]][1] += 1
    name = dict(kirana="Kirana", dairy="Dairy", tailoring="Tailoring", agri_inputs="Agri inputs",
                food_processing="Food processing", handloom="Handloom")
    items = sorted(segs.items(), key=lambda kv: -(kv[1][0] + kv[1][1]))
    labels = [name[k] for k, _ in items]
    high = np.array([v[0] for _, v in items])
    watch = np.array([v[1] for _, v in items])
    fig, ax = plt.subplots(figsize=(6.4, 3.0), dpi=200)
    y = np.arange(len(items))[::-1]
    ax.barh(y, high, height=0.55, color=CRIT, label="High")
    ax.barh(y, watch, height=0.55, left=high + 0.06, color=WARN, label="Watch")
    for yi, h_, w_ in zip(y, high, watch):
        ax.text(h_ + w_ + 0.25, yi, str(h_ + w_), va="center", fontsize=10, fontweight="bold", color=INK)
    ax.set_yticks(y, labels)
    ax.xaxis.set_major_locator(plt.MaxNLocator(integer=True))
    ax.set_xlabel("Enterprises on watchlist")
    ax.grid(axis="y", visible=False)
    ax.set_title("Early-warning watchlist by segment — 200-enterprise demo portfolio",
                 fontsize=11.5, loc="left", color=INK, pad=10)
    ax.legend(frameon=False, fontsize=9, loc="lower right")
    despine(ax)
    fig.tight_layout()
    fig.savefig(OUT / "fig_portfolio.png", bbox_inches="tight")
    plt.close(fig)


fig_forecast()
fig_balance()
fig_portfolio()
print("figures written to", OUT)
