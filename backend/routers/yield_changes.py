from datetime import datetime
from typing import Optional

import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from lib.cache import get_cache, set_cache
from lib.fred import fred_series, n_days_ago
from lib.norgesbank import nb_fetch_yield

router = APIRouter()
CACHE_KEY = "yield-changes"

US_SERIES = [
    {"id": "US_3M",  "label": "US  3M",  "fred": "DGS3MO"},
    {"id": "US_6M",  "label": "US  6M",  "fred": "DGS6MO"},
    {"id": "US_1Y",  "label": "US  1Y",  "fred": "DGS1"},
    {"id": "US_2Y",  "label": "US  2Y",  "fred": "DGS2"},
    {"id": "US_5Y",  "label": "US  5Y",  "fred": "DGS5"},
    {"id": "US_10Y", "label": "US 10Y",  "fred": "DGS10"},
]

NO_MATURITIES = ["3M", "6M", "1Y", "2Y", "5Y", "10Y"]
NO_LABELS = {
    "3M": "NO  3M", "6M": "NO  6M", "1Y": "NO  1Y",
    "2Y": "NO  2Y", "5Y": "NO  5Y", "10Y": "NO 10Y",
}


def _at_index(s: list[dict], offset: int) -> Optional[float]:
    idx = len(s) - 1 - offset
    return s[idx]["value"] if idx >= 0 else None


def _value_at_date(s: list[dict], target: str) -> Optional[float]:
    for p in reversed(s):
        if p["date"] <= target:
            return p["value"]
    return None


def _bps(current: Optional[float], past: Optional[float]) -> Optional[float]:
    if current is None or past is None:
        return None
    return round((current - past) * 100, 1)


def _build_row(row_id: str, label: str, series: list[dict], is_monthly: bool = False) -> dict:
    if not series:
        return {
            "id": row_id, "label": label, "current": None,
            "dataFrequency": "monthly" if is_monthly else "daily",
            "changes": {"1D": None, "1W": None, "1M": None, "3M": None, "6M": None, "1Y": None},
        }
    current = series[-1]["value"]
    return {
        "id": row_id,
        "label": label,
        "current": round(current, 3),
        "dataFrequency": "monthly" if is_monthly else "daily",
        "changes": {
            "1D": None if is_monthly else _bps(current, _at_index(series, 1)),
            "1W": None if is_monthly else _bps(current, _at_index(series, 5)),
            "1M": _bps(current, _value_at_date(series, n_days_ago(30))),
            "3M": _bps(current, _value_at_date(series, n_days_ago(91))),
            "6M": _bps(current, _value_at_date(series, n_days_ago(182))),
            "1Y": _bps(current, _value_at_date(series, n_days_ago(365))),
        },
    }


@router.get("/yield-changes")
async def yield_changes():
    cached = get_cache(CACHE_KEY)
    if cached:
        return cached

    start = n_days_ago(380)
    start_de = n_days_ago(380 * 3)  # monthly needs more history for 1Y lookback

    try:
        us_results, no_results, de_raw = await asyncio.gather(
            asyncio.gather(*[
                fred_series(m["fred"], start) for m in US_SERIES
            ], return_exceptions=True),
            asyncio.gather(*[
                nb_fetch_yield(m, start) for m in NO_MATURITIES
            ], return_exceptions=True),
            fred_series("IRLTLT01DEM156N", start_de),
            return_exceptions=True,
        )

        if isinstance(us_results, Exception): us_results = [[] for _ in US_SERIES]
        if isinstance(no_results, Exception): no_results = [[] for _ in NO_MATURITIES]
        if isinstance(de_raw, Exception): de_raw = []

        rows = []
        for i, m in enumerate(US_SERIES):
            series = us_results[i] if not isinstance(us_results[i], Exception) else []
            rows.append(_build_row(m["id"], m["label"], series))

        for i, m in enumerate(NO_MATURITIES):
            series = no_results[i] if not isinstance(no_results[i], Exception) else []
            rows.append(_build_row(f"NO_{m}", NO_LABELS[m], series))

        rows.append(_build_row("DE_10Y", "DE 10Y", de_raw, is_monthly=True))

        result = {"rows": rows, "updatedAt": datetime.utcnow().isoformat() + "Z"}
        set_cache(CACHE_KEY, result)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
