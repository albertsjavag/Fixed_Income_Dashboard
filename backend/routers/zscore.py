from datetime import datetime
from typing import Optional

import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from lib.cache import get_cache, set_cache
from lib.fred import fred_series, n_days_ago
from lib.norgesbank import nb_fetch_yield
from lib.stats import zscore, mean, stddev

router = APIRouter()
CACHE_KEY = "zscore"


def _interpret(z: Optional[float]) -> str:
    if z is None:
        return "Unavailable"
    if z >= 2:
        return "Historically high"
    if z <= -2:
        return "Historically low"
    if z >= 1:
        return "Slightly elevated"
    if z <= -1:
        return "Slightly depressed"
    return "Near average"


def _level(z: Optional[float]) -> str:
    if z is None:
        return "unavailable"
    if z >= 2:
        return "extreme-high"
    if z >= 1:
        return "elevated"
    if z <= -2:
        return "extreme-low"
    if z <= -1:
        return "depressed"
    return "normal"


def _build_entry(country: str, vals: list[dict], quality: str) -> dict:
    if not vals:
        return {
            "country": country, "currentYield": None, "zScore": None,
            "interpretation": "Unavailable", "level": "unavailable",
            "sparkline": [], "dataQuality": quality, "dataPoints": 0,
        }
    values = [p["value"] for p in vals]
    m = mean(values)
    s = stddev(values)
    current = vals[-1]["value"]
    z = round(zscore(current, values), 2)

    cutoff_90d = n_days_ago(90)
    sparkline = [
        {"date": p["date"], "z": round((p["value"] - m) / (s or 1), 3)}
        for p in vals
        if p["date"] >= cutoff_90d
    ]

    return {
        "country": country,
        "currentYield": round(current, 2),
        "zScore": z,
        "interpretation": _interpret(z),
        "level": _level(z),
        "sparkline": sparkline,
        "dataQuality": quality,
        "dataPoints": len(vals),
    }


@router.get("/zscore")
async def zscore_route():
    cached = get_cache(CACHE_KEY)
    if cached:
        return cached

    start_1y = n_days_ago(365 + 10)
    start_de = n_days_ago(365 * 5)  # monthly series — need many years for robust z-score

    try:
        us_raw, de_raw, no_raw = await asyncio.gather(
            fred_series("DGS10", start_1y),
            fred_series("IRLTLT01DEM156N", start_de),
            nb_fetch_yield("10Y", start_1y),
            return_exceptions=True,
        )
        if isinstance(us_raw, Exception): us_raw = []
        if isinstance(de_raw, Exception): de_raw = []
        if isinstance(no_raw, Exception): no_raw = []

        entries = [
            _build_entry("Norway",        no_raw, "daily"),
            _build_entry("Germany",       de_raw, "monthly"),
            _build_entry("United States", us_raw, "daily"),
        ]

        result = {"entries": entries, "updatedAt": datetime.utcnow().isoformat() + "Z"}
        set_cache(CACHE_KEY, result)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
