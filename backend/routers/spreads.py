from datetime import datetime

import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from lib.cache import get_cache, set_cache
from lib.fred import fred_series, n_days_ago
from lib.norgesbank import nb_fetch_yield
from lib.stats import align_by_date

router = APIRouter()
CACHE_KEY = "spreads"


@router.get("/spreads")
async def spreads():
    cached = get_cache(CACHE_KEY)
    if cached:
        return cached

    start = n_days_ago(365 * 2 + 30)

    try:
        us10_raw, us2_raw, no10_raw, no2_raw = await asyncio.gather(
            fred_series("DGS10", start),
            fred_series("DGS2",  start),
            nb_fetch_yield("10Y", start),
            nb_fetch_yield("2Y",  start),   # GOVT_ZEROCOUPON — daily
            return_exceptions=True,
        )
        for name, val in [("us10", us10_raw), ("us2", us2_raw), ("no10", no10_raw), ("no2", no2_raw)]:
            if isinstance(val, Exception):
                val = []
        if isinstance(us10_raw, Exception): us10_raw = []
        if isinstance(us2_raw, Exception):  us2_raw = []
        if isinstance(no10_raw, Exception): no10_raw = []
        if isinstance(no2_raw, Exception):  no2_raw = []

        no_us   = align_by_date(no10_raw, us10_raw)   # NO 10Y − US 10Y
        us_sprd = align_by_date(us2_raw,  us10_raw)   # US 2Y − US 10Y
        no_sprd = align_by_date(no2_raw,  no10_raw)   # NO 2Y − NO 10Y

        no_us_map   = {p["date"]: p["a"] - p["b"] for p in no_us}
        us_sprd_map = {p["date"]: p["a"] - p["b"] for p in us_sprd}
        no_sprd_map = {p["date"]: p["a"] - p["b"] for p in no_sprd}

        date_set = set(no_us_map) | set(us_sprd_map) | set(no_sprd_map)
        data = [
            {
                "date": d,
                "noUsSpread":  no_us_map.get(d),
                "usInversion": us_sprd_map.get(d),
                "noInversion": no_sprd_map.get(d),
            }
            for d in sorted(date_set)
        ]

        result = {"data": data, "updatedAt": datetime.utcnow().isoformat() + "Z"}
        set_cache(CACHE_KEY, result)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
