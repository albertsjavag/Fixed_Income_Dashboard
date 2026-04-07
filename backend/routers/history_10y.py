from datetime import datetime

import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from lib.cache import get_cache, set_cache
from lib.fred import fred_series, n_days_ago
from lib.norgesbank import nb_fetch_yield

router = APIRouter()
CACHE_KEY = "history-10y"


@router.get("/history-10y")
async def history_10y():
    cached = get_cache(CACHE_KEY)
    if cached:
        return cached

    start = n_days_ago(365 * 2 + 30)

    try:
        us_raw, de_raw, no_raw = await asyncio.gather(
            fred_series("DGS10", start),
            fred_series("IRLTLT01DEM156N", start),
            nb_fetch_yield("10Y", start),
            return_exceptions=True,
        )
        if isinstance(us_raw, Exception):
            us_raw = []
        if isinstance(de_raw, Exception):
            de_raw = []
        if isinstance(no_raw, Exception):
            no_raw = []

        us_map = {p["date"]: p["value"] for p in us_raw}
        de_map = {p["date"]: p["value"] for p in de_raw}
        no_map = {p["date"]: p["value"] for p in no_raw}

        date_set = set(us_map) | set(de_map) | set(no_map)

        data = [
            {
                "date": d,
                "norway":  no_map.get(d),
                "germany": de_map.get(d),
                "us":      us_map.get(d),
            }
            for d in sorted(date_set)
        ]

        result = {
            "data": data,
            "germanyNote": (
                "Germany 10Y sourced from FRED (IRLTLT01DEM156N) — monthly frequency. "
                "Gaps between data points are expected."
            ),
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        }
        set_cache(CACHE_KEY, result)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
