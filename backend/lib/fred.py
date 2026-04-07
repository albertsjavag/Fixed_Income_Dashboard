"""FRED API helpers — mirrors fred.ts. Never called from the browser."""
import os
from datetime import date, timedelta
from typing import Optional

import httpx

FRED_BASE = "https://api.stlouisfed.org/fred"


def _api_key() -> str:
    key = os.getenv("FRED_API_KEY")
    if not key:
        raise RuntimeError("FRED_API_KEY is not set")
    return key


def n_days_ago(n: int) -> str:
    """Return YYYY-MM-DD for n days before today."""
    return (date.today() - timedelta(days=n)).isoformat()


async def fred_series(
    series_id: str,
    observation_start: Optional[str] = None,
    observation_end: Optional[str] = None,
) -> list[dict]:
    """Fetch all observations for a FRED series. Missing values ('.') are filtered out."""
    params = {
        "series_id": series_id,
        "api_key": _api_key(),
        "file_type": "json",
        "sort_order": "asc",
    }
    if observation_start:
        params["observation_start"] = observation_start
    if observation_end:
        params["observation_end"] = observation_end

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{FRED_BASE}/series/observations", params=params)
        r.raise_for_status()

    observations = r.json()["observations"]
    return [
        {"date": o["date"], "value": float(o["value"])}
        for o in observations
        if o["value"] != "."
    ]


async def fred_latest(series_id: str) -> Optional[dict]:
    """Return the most recent observation for a FRED series."""
    # Fetch 5 instead of 1 — FRED pre-publishes "." placeholders for the current
    # business day before the H.15 release (~3:30 PM ET). With limit=1 we'd get
    # only that placeholder and return None. Fetching 5 lets us fall back to the
    # previous trading day when the most recent observation is still missing.
    params = {
        "series_id": series_id,
        "api_key": _api_key(),
        "file_type": "json",
        "sort_order": "desc",
        "limit": "5",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{FRED_BASE}/series/observations", params=params)
        r.raise_for_status()

    observations = [o for o in r.json()["observations"] if o["value"] != "."]
    if not observations:
        return None
    o = observations[0]
    return {"date": o["date"], "value": float(o["value"])}
