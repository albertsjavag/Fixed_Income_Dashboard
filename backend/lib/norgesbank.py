"""Norges Bank SDMX-JSON API client — mirrors norgesbank.ts.

Datasets:
  GOVT_GENERIC_RATES  — TBIL (3M/6M/12M) and GBON (5Y/10Y), business daily
  GOVT_ZEROCOUPON     — zero-coupon yields (2Y), daily
"""
from typing import Optional

import httpx

NB_BASE = "https://data.norges-bank.no/api/data"

_MATURITY_SPECS: dict[str, dict] = {
    "3M":  {"dataset": "GOVT_GENERIC_RATES", "tenor": "3M",  "instrument": "TBIL"},
    "6M":  {"dataset": "GOVT_GENERIC_RATES", "tenor": "6M",  "instrument": "TBIL"},
    "1Y":  {"dataset": "GOVT_GENERIC_RATES", "tenor": "12M", "instrument": "TBIL"},
    "2Y":  {"dataset": "GOVT_ZEROCOUPON",    "tenor": "2Y"},
    "5Y":  {"dataset": "GOVT_GENERIC_RATES", "tenor": "5Y",  "instrument": "GBON"},
    "10Y": {"dataset": "GOVT_GENERIC_RATES", "tenor": "10Y", "instrument": "GBON"},
}


def _build_url(spec: dict, start_date: Optional[str] = None) -> str:
    if spec["dataset"] == "GOVT_GENERIC_RATES":
        key = f"B.{spec['tenor']}.{spec['instrument']}"
    else:
        key = f"B.{spec['tenor']}"
    params = "format=sdmx-json&locale=en"
    if start_date:
        params += f"&startPeriod={start_date}"
    return f"{NB_BASE}/{spec['dataset']}/{key}?{params}"


async def _fetch_sdmx(url: str) -> list[dict]:
    """Parse a Norges Bank SDMX-JSON response into [{date, value}] points."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url)
        r.raise_for_status()

    json = r.json()
    struct = json["data"]["structure"]
    ds = json["data"]["dataSets"][0]
    series: dict = ds["series"]

    # Find the TIME_PERIOD observation dimension
    obs_dims: list[dict] = struct["dimensions"]["observation"]
    time_dim = next((d for d in obs_dims if d["id"] == "TIME_PERIOD"), None)
    if time_dim is None:
        raise ValueError("TIME_PERIOD dimension not found in Norges Bank response")

    # There should be exactly one series key when fetching a single tenor
    series_key = next(iter(series), None)
    if series_key is None:
        return []

    observations: dict = series[series_key]["observations"]
    points = []
    for idx_str, vals in observations.items():
        # Norges Bank returns values as strings: ['4.172'] — must parseFloat
        raw = vals[0] if vals else None
        if raw is None:
            continue
        try:
            num = float(str(raw))
        except (ValueError, TypeError):
            continue
        if not (num == num) or num in (float("inf"), float("-inf")):  # NaN / Inf check
            continue
        date_str = time_dim["values"][int(idx_str)]["id"]
        points.append({"date": date_str, "value": num})

    return sorted(points, key=lambda p: p["date"])


async def nb_fetch_yield(maturity: str, start_date: Optional[str] = None) -> list[dict]:
    spec = _MATURITY_SPECS.get(maturity)
    if spec is None:
        raise ValueError(f"Unknown maturity: {maturity}")
    return await _fetch_sdmx(_build_url(spec, start_date))


async def nb_fetch_all(maturities: list[str], start_date: Optional[str] = None) -> list[dict]:
    """Fetch multiple maturities; returns flat list of {date, maturity, value}."""
    import asyncio

    async def fetch_one(m: str) -> list[dict]:
        try:
            pts = await nb_fetch_yield(m, start_date)
            return [{"date": p["date"], "maturity": m, "value": p["value"]} for p in pts]
        except Exception:
            return []

    results = await asyncio.gather(*[fetch_one(m) for m in maturities])
    return [item for sublist in results for item in sublist]
