from datetime import datetime
from typing import Optional

import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from lib.cache import get_cache, set_cache
from lib.fred import fred_series, n_days_ago
from lib.norgesbank import nb_fetch_yield
from lib.stats import align_by_date

router = APIRouter()
CACHE_KEY = "steepness"


def _direction(current: Optional[float], week_ago: Optional[float]) -> str:
    if current is None or week_ago is None:
        return "unavailable"
    diff = current - week_ago
    if abs(diff) < 0.01:
        return "unchanged"
    return "steeper" if diff > 0 else "flatter"


def _round2(v: Optional[float]) -> Optional[float]:
    return round(v, 2) if v is not None else None


@router.get("/steepness")
async def steepness():
    cached = get_cache(CACHE_KEY)
    if cached:
        return cached

    start = n_days_ago(22)

    try:
        us10_raw, us2_raw, no10_raw, no2_raw = await asyncio.gather(
            fred_series("DGS10", start),
            fred_series("DGS2",  start),
            nb_fetch_yield("10Y", start),
            nb_fetch_yield("2Y",  start),   # GOVT_ZEROCOUPON
            return_exceptions=True,
        )
        if isinstance(us10_raw, Exception): us10_raw = []
        if isinstance(us2_raw, Exception):  us2_raw = []
        if isinstance(no10_raw, Exception): no10_raw = []
        if isinstance(no2_raw, Exception):  no2_raw = []

        us_aligned = align_by_date(us10_raw, us2_raw)
        no_aligned = align_by_date(no10_raw, no2_raw)

        us_current = (us_aligned[-1]["a"] - us_aligned[-1]["b"]) if us_aligned else None
        us_week_ago = (us_aligned[-6]["a"] - us_aligned[-6]["b"]) if len(us_aligned) > 5 else None

        no_current = (no_aligned[-1]["a"] - no_aligned[-1]["b"]) if no_aligned else None
        no_week_ago = (no_aligned[-6]["a"] - no_aligned[-6]["b"]) if len(no_aligned) > 5 else None

        entries = [
            {
                "country": "Norway",
                "current": _round2(no_current),
                "weekAgo": _round2(no_week_ago),
                "direction": _direction(no_current, no_week_ago),
                "inverted": (no_current < 0) if no_current is not None else False,
            },
            {
                "country": "United States",
                "current": _round2(us_current),
                "weekAgo": _round2(us_week_ago),
                "direction": _direction(us_current, us_week_ago),
                "inverted": (us_current < 0) if us_current is not None else False,
            },
        ]

        result = {"entries": entries, "updatedAt": datetime.utcnow().isoformat() + "Z"}
        set_cache(CACHE_KEY, result)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
