"""Statistical utilities — mirrors stats.ts, implemented with numpy."""
from typing import Optional

import numpy as np


def mean(values: list[float]) -> float:
    return float(np.mean(values))


def stddev(values: list[float]) -> float:
    return float(np.std(values))


def zscore(value: float, values: list[float]) -> float:
    arr = np.array(values, dtype=float)
    s = arr.std()
    if s == 0:
        return 0.0
    return float((value - arr.mean()) / s)


def rolling_correlation(
    a: list[float], b: list[float], window: int
) -> list[Optional[float]]:
    """Pearson correlation over a sliding window. Returns None for positions < window."""
    result: list[Optional[float]] = []
    arr_a = np.array(a, dtype=float)
    arr_b = np.array(b, dtype=float)
    n = len(arr_a)
    for i in range(n):
        if i < window - 1:
            result.append(None)
            continue
        sa = arr_a[i - window + 1 : i + 1]
        sb = arr_b[i - window + 1 : i + 1]
        result.append(_pearson(sa, sb))
    return result


def _pearson(a: np.ndarray, b: np.ndarray) -> Optional[float]:
    ma, mb = a.mean(), b.mean()
    num = float(((a - ma) * (b - mb)).sum())
    denom = float(np.sqrt(((a - ma) ** 2).sum() * ((b - mb) ** 2).sum()))
    if denom == 0:
        return 0.0
    return num / denom


def align_by_date(
    series_a: list[dict], series_b: list[dict]
) -> list[dict]:
    """Inner join two [{date, value}] series on date."""
    map_b = {p["date"]: p["value"] for p in series_b}
    return [
        {"date": p["date"], "a": p["value"], "b": map_b[p["date"]]}
        for p in series_a
        if p["date"] in map_b
    ]


def align_three(
    a: list[dict], b: list[dict], c: list[dict]
) -> list[dict]:
    """Inner join three [{date, value}] series on date."""
    map_b = {p["date"]: p["value"] for p in b}
    map_c = {p["date"]: p["value"] for p in c}
    return [
        {"date": p["date"], "a": p["value"], "b": map_b[p["date"]], "c": map_c[p["date"]]}
        for p in a
        if p["date"] in map_b and p["date"] in map_c
    ]
