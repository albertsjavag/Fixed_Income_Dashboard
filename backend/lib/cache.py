"""Simple in-memory cache with 1-hour TTL — mirrors cache.ts"""
from datetime import datetime, timedelta
from typing import Any, Optional

CACHE_TTL = timedelta(hours=1)

_store: dict[str, dict] = {}


def get_cache(key: str) -> Optional[Any]:
    entry = _store.get(key)
    if entry is None:
        return None
    if datetime.now() - entry["timestamp"] > CACHE_TTL:
        del _store[key]
        return None
    return entry["data"]


def set_cache(key: str, data: Any) -> None:
    _store[key] = {"data": data, "timestamp": datetime.now()}
