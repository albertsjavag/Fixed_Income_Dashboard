from datetime import datetime
from typing import Optional

import asyncio
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from lib.cache import get_cache, set_cache
from lib.fred import fred_series, n_days_ago
from lib.norgesbank import nb_fetch_yield

router = APIRouter()

FRED_MAP: dict[str, str] = {
    "US_3M":  "DGS3MO",
    "US_6M":  "DGS6MO",
    "US_1Y":  "DGS1",
    "US_2Y":  "DGS2",
    "US_5Y":  "DGS5",
    "US_10Y": "DGS10",
    "DE_10Y": "IRLTLT01DEM156N",
}

NB_MAP: dict[str, str] = {
    "NO_3M":  "3M",
    "NO_6M":  "6M",
    "NO_1Y":  "1Y",
    "NO_2Y":  "2Y",
    "NO_5Y":  "5Y",
    "NO_10Y": "10Y",
}

ALL_SERIES = [
    {"id": "US_3M",   "label": "US  3M",  "group": "US"},
    {"id": "US_6M",   "label": "US  6M",  "group": "US"},
    {"id": "US_1Y",   "label": "US  1Y",  "group": "US"},
    {"id": "US_2Y",   "label": "US  2Y",  "group": "US"},
    {"id": "US_5Y",   "label": "US  5Y",  "group": "US"},
    {"id": "US_10Y",  "label": "US 10Y",  "group": "US"},
    {"id": "NO_3M",   "label": "NO  3M",  "group": "NO"},
    {"id": "NO_6M",   "label": "NO  6M",  "group": "NO"},
    {"id": "NO_1Y",   "label": "NO  1Y",  "group": "NO"},
    {"id": "NO_2Y",   "label": "NO  2Y",  "group": "NO"},
    {"id": "NO_5Y",   "label": "NO  5Y",  "group": "NO"},
    {"id": "NO_10Y",  "label": "NO 10Y",  "group": "NO"},
    {"id": "DE_10Y",  "label": "DE 10Y",  "group": "DE"},
]

_label_map = {s["id"]: s["label"] for s in ALL_SERIES}


async def _fetch_series(series_id: str, start: str) -> list[dict]:
    if series_id in FRED_MAP:
        return await fred_series(FRED_MAP[series_id], start)
    if series_id in NB_MAP:
        return await nb_fetch_yield(NB_MAP[series_id], start)
    raise ValueError(f"Unknown series ID: {series_id}")


@router.get("/series-data")
async def series_data(
    a: str = Query(...),
    b: str = Query(...),
    days: int = Query(730),
):
    cache_key = f"series-data:{a}:{b}:{days}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    start = n_days_ago(days + 60)
    label_a = _label_map.get(a, a)
    label_b = _label_map.get(b, b)

    try:
        series_a, series_b = await asyncio.gather(
            _fetch_series(a, start),
            _fetch_series(b, start),
            return_exceptions=True,
        )
        if isinstance(series_a, Exception):
            series_a = []
        if isinstance(series_b, Exception):
            series_b = []

        map_a = {p["date"]: p["value"] for p in series_a}
        map_b = {p["date"]: p["value"] for p in series_b}
        date_set = set(map_a) | set(map_b)

        cutoff = n_days_ago(days)
        points = []
        for d in sorted(date_set):
            if d < cutoff:
                continue
            av = map_a.get(d)
            bv = map_b.get(d)
            spread = round(av - bv, 3) if av is not None and bv is not None else None
            points.append({"date": d, "a": av, "b": bv, "spread": spread})

        last = next(
            (p for p in reversed(points) if p["a"] is not None and p["b"] is not None),
            None,
        )
        result = {
            "points": points,
            "labelA": label_a,
            "labelB": label_b,
            "currentA": last["a"] if last else None,
            "currentB": last["b"] if last else None,
            "currentSpread": last["spread"] if last else None,
            "updatedAt": datetime.utcnow().isoformat() + "Z",
        }
        set_cache(cache_key, result)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
