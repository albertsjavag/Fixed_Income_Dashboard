from datetime import datetime

import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from lib.cache import get_cache, set_cache
from lib.fred import fred_series, fred_latest, n_days_ago

router = APIRouter()
CACHE_KEY = "breakeven"


@router.get("/breakeven")
async def breakeven():
    cached = get_cache(CACHE_KEY)
    if cached:
        return cached

    start = n_days_ago(365 * 2 + 30)

    try:
        us_raw, us_latest = await asyncio.gather(
            fred_series("T10YIE", start),
            fred_latest("T10YIE"),
            return_exceptions=True,
        )
        if isinstance(us_raw, Exception):
            us_raw = []
        if isinstance(us_latest, Exception):
            us_latest = None

        data = [{"date": p["date"], "us": p["value"]} for p in us_raw]
        current_us = us_latest["value"] if us_latest else None
        current_us_date = us_latest["date"] if us_latest else None

        result = {
            "data": data,
            "currentUS": current_us,
            "currentUSDate": current_us_date,
            "usAboveTarget": (current_us > 2.0) if current_us is not None else None,
            "norwayNote": (
                "Norwegian breakeven inflation: Norges Bank does not publish daily "
                "market-implied breakeven rates. Inflation-linked government bonds "
                "(NGB-IL) are thinly traded and not available via public API."
            ),
            "germanyNote": (
                "German breakeven inflation: ECB real yield data requires institutional "
                "access. No free daily series is available via FRED for German "
                "inflation-linked bonds."
            ),
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        }
        set_cache(CACHE_KEY, result)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
