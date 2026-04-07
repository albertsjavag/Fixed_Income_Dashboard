from datetime import datetime

import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from lib.cache import get_cache, set_cache
from lib.fred import fred_series, n_days_ago
from lib.norgesbank import nb_fetch_yield
from lib.stats import align_by_date, rolling_correlation

router = APIRouter()
CACHE_KEY = "correlation"


@router.get("/correlation")
async def correlation():
    cached = get_cache(CACHE_KEY)
    if cached:
        return cached

    # Need 2 years + 90d window buffer
    start = n_days_ago(365 * 2 + 120)

    try:
        us_raw, no_raw = await asyncio.gather(
            fred_series("DGS10", start),
            nb_fetch_yield("10Y", start),
            return_exceptions=True,
        )
        if isinstance(us_raw, Exception):
            us_raw = []
        if isinstance(no_raw, Exception):
            no_raw = []

        aligned = align_by_date(no_raw, us_raw)

        if len(aligned) < 30:
            return {
                "data30d": [],
                "data90d": [],
                "updatedAt": datetime.utcnow().isoformat() + "Z",
                "note": "Insufficient data",
            }

        no_vals = [p["a"] for p in aligned]
        us_vals = [p["b"] for p in aligned]

        def build_series(window: int) -> list[dict]:
            corrs = rolling_correlation(no_vals, us_vals, window)
            return [
                {
                    "date": p["date"],
                    "noUsCorr": round(corrs[i], 3) if corrs[i] is not None else None,
                }
                for i, p in enumerate(aligned)
            ]

        cutoff = n_days_ago(365 * 2)

        def trim(pts: list[dict]) -> list[dict]:
            return [p for p in pts if p["date"] >= cutoff]

        result = {
            "data30d": trim(build_series(30)),
            "data90d": trim(build_series(90)),
            "updatedAt": datetime.utcnow().isoformat() + "Z",
            "note": (
                "Germany excluded: monthly frequency (FRED IRLTLT01DEM156N) is "
                "incompatible with 30d/90d rolling windows on daily data."
            ),
        }
        set_cache(CACHE_KEY, result)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
