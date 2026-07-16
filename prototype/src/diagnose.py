"""Diagnostic: where do ramping-now enterprises land in the risk-score distribution?"""
import json
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parents[1] / "data"
scores = json.load(open(DATA / "scores.json", encoding="utf-8"))
events = pd.read_csv(DATA / "events.csv")

now = events[events.event_week >= 104]
past = events[events.event_week < 104]
s = pd.Series({k: v["risk_score"] for k, v in scores.items()})

print("score deciles:", s.quantile([0.5, 0.75, 0.9, 0.95, 0.99]).round(1).to_dict())
print("\nramping-now enterprises (event 2-7 wks after data end):")
for r in now.itertuples():
    v = scores[r.enterprise_id]
    print(f"  {r.enterprise_id} ev_wk={r.event_week} ramp={r.ramp_len} depth={r.depth:.2f} "
          f"score={v['risk_score']:5.1f} tier={v['tier']:6s} flags={[f['code'] for f in v['flags']]}")
print("\ntop 15 scores overall:")
for k in s.sort_values(ascending=False).head(15).index:
    v = scores[k]
    tag = "RAMPING" if k in set(now.enterprise_id) else ("PAST" if k in set(past.enterprise_id) else "")
    print(f"  {k} {v['risk_score']:5.1f} {v['tier']:6s} {tag:8s} flags={[f['code'] for f in v['flags']]}")
