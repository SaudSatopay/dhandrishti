"""Feature engineering: weekly panel -> per-(enterprise, week) model features.

All features use only information available at week t (no leakage).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

SEGMENTS = ["kirana", "dairy", "tailoring", "agri_inputs", "food_processing", "handloom"]

FEATURES = [
    "net_cf_ma4", "net_cf_ma8", "net_cf_ma12", "net_cf_std8", "net_cf_trend8",
    "inflow_ma4", "inflow_std8", "inflow_cv8", "inflow_yoy",
    "upi_share", "upi_share_chg8", "top_cp_share", "cp_count_chg8",
    "runway_weeks", "balance_chg8", "emi_to_inflow",
    "mandi_mom8", "rain_anom", "festival_now", "festival_next6",
    "woy_sin", "woy_cos",
] + [f"seg_{s}" for s in SEGMENTS]


def _slope(y: pd.Series) -> float:
    x = np.arange(len(y), dtype=float)
    if len(y) < 3 or y.std() == 0:
        return 0.0
    return float(np.polyfit(x, y.to_numpy(dtype=float), 1)[0])


def _fwd_max(s: pd.Series, k: int = 6) -> pd.Series:
    """Max over the NEXT k values (t+1 .. t+k). Calendar lookahead, not leakage."""
    return s[::-1].rolling(k, min_periods=1).max()[::-1].shift(-1)


def build_features(weekly: pd.DataFrame, ents: pd.DataFrame) -> pd.DataFrame:
    df = weekly.merge(ents[["enterprise_id", "segment", "district", "state"]],
                      on="enterprise_id", how="left")
    df = df.sort_values(["enterprise_id", "week_start"]).reset_index(drop=True)
    g = df.groupby("enterprise_id", sort=False)

    df["net_cf_ma4"] = g["net_cash_flow"].transform(lambda s: s.rolling(4, min_periods=2).mean())
    df["net_cf_ma8"] = g["net_cash_flow"].transform(lambda s: s.rolling(8, min_periods=4).mean())
    df["net_cf_ma12"] = g["net_cash_flow"].transform(lambda s: s.rolling(12, min_periods=6).mean())
    df["net_cf_std8"] = g["net_cash_flow"].transform(lambda s: s.rolling(8, min_periods=4).std())
    df["net_cf_trend8"] = g["net_cash_flow"].transform(
        lambda s: s.rolling(8, min_periods=5).apply(_slope, raw=False))

    df["inflow_ma4"] = g["inflow_total"].transform(lambda s: s.rolling(4, min_periods=2).mean())
    df["inflow_std8"] = g["inflow_total"].transform(lambda s: s.rolling(8, min_periods=4).std())
    df["inflow_cv8"] = df["inflow_std8"] / df["inflow_ma4"].abs().clip(lower=1.0)
    df["inflow_yoy"] = g["inflow_total"].transform(
        lambda s: s.rolling(4, min_periods=2).mean() / s.shift(52).rolling(4, min_periods=2).mean() - 1.0)

    df["upi_share"] = (df["inflow_upi"] / df["inflow_total"].clip(lower=1.0)).clip(0, 1)
    g = df.groupby("enterprise_id", sort=False)  # re-group: new column added
    df["upi_share_chg8"] = g["upi_share"].transform(lambda s: s - s.shift(8))
    df["cp_count_chg8"] = g["counterparty_count"].transform(
        lambda s: s.rolling(4, min_periods=2).mean() / s.shift(8).rolling(4, min_periods=2).mean() - 1.0)

    out_ma4 = g["outflow_total"].transform(lambda s: s.rolling(4, min_periods=2).mean())
    df["runway_weeks"] = (df["closing_balance"] / out_ma4.clip(lower=1.0)).clip(-8, 26)
    df["balance_chg8"] = g["closing_balance"].transform(
        lambda s: (s - s.shift(8)) / s.shift(8).abs().clip(lower=1.0)).clip(-5, 5)
    df["emi_to_inflow"] = (df["outflow_emi"] / df["inflow_ma4"].clip(lower=1.0)).clip(0, 2)

    df["mandi_mom8"] = g["mandi_price_index"].transform(lambda s: s / s.shift(8) - 1.0)
    rain_ma = g["rainfall_mm"].transform(lambda s: s.rolling(4, min_periods=2).mean())
    df["rain_anom"] = rain_ma - df.groupby("week_of_year")["rainfall_mm"].transform("mean")

    df["festival_now"] = df["festival_intensity"]
    # forward-looking calendar features are known in advance (not leakage)
    df["festival_next6"] = g["festival_intensity"].transform(_fwd_max)
    df["woy_sin"] = np.sin(2 * np.pi * df["week_of_year"] / 52)
    df["woy_cos"] = np.cos(2 * np.pi * df["week_of_year"] / 52)

    for s in SEGMENTS:
        df[f"seg_{s}"] = (df["segment"] == s).astype(int)

    df["week_idx"] = g.cumcount()
    return df
