from datetime import datetime
from typing import Optional

import asyncio
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from lib.cache import get_cache, set_cache
from lib.fred import fred_latest
from lib.norgesbank import nb_fetch_yield

router = APIRouter()
CACHE_KEY = "forward-rates"

US_MATURITIES = [
    {"maturity": "3M",  "years": 0.25, "fred": "DGS3MO"},
    {"maturity": "6M",  "years": 0.5,  "fred": "DGS6MO"},
    {"maturity": "1Y",  "years": 1.0,  "fred": "DGS1"},
    {"maturity": "2Y",  "years": 2.0,  "fred": "DGS2"},
    {"maturity": "5Y",  "years": 5.0,  "fred": "DGS5"},
    {"maturity": "10Y", "years": 10.0, "fred": "DGS10"},
]

NO_MATURITIES = [
    {"maturity": "3M",  "years": 0.25},
    {"maturity": "6M",  "years": 0.5},
    {"maturity": "1Y",  "years": 1.0},
    {"maturity": "2Y",  "years": 2.0},
    {"maturity": "5Y",  "years": 5.0},
    {"maturity": "10Y", "years": 10.0},
]

FORWARD_PAIRS = [
    {"label": "3M→6M",  "description": "3M rate expected in 3 months",       "from": "3M",  "to": "6M"},
    {"label": "6M→1Y",  "description": "6M rate expected in 6 months",       "from": "6M",  "to": "1Y"},
    {"label": "1Y→2Y",  "description": "1Y rate in 1Y (key policy horizon)", "from": "1Y",  "to": "2Y"},
    {"label": "2Y→5Y",  "description": "3Y rate starting in 2Y (medium term)", "from": "2Y", "to": "5Y"},
    {"label": "5Y→10Y", "description": "5Y5Y — long-run rate anchor",        "from": "5Y",  "to": "10Y"},
]


def _fwd(r1: Optional[float], t1: float, r2: Optional[float], t2: float) -> Optional[float]:
    if r1 is None or r2 is None:
        return None
    return round((r2 * t2 - r1 * t1) / (t2 - t1), 3)


def _compute_forwards(spot: list[dict]) -> list[dict]:
    spot_map = {p["maturity"]: p for p in spot}

    forwards = []
    for pair in FORWARD_PAIRS:
        a = spot_map.get(pair["from"])
        b = spot_map.get(pair["to"])
        forwards.append({
            "label": pair["label"],
            "description": pair["description"],
            "fromYears": a["years"] if a else 0,
            "toYears": b["years"] if b else 0,
            "rate": _fwd(
                a["rate"] if a else None, a["years"] if a else 0,
                b["rate"] if b else None, b["years"] if b else 0,
            ),
        })
    return forwards


@router.get("/forward-rates")
async def forward_rates():
    cached = get_cache(CACHE_KEY)
    if cached:
        return cached

    try:
        us_promises = [fred_latest(m["fred"]) for m in US_MATURITIES]
        no_promises = [nb_fetch_yield(m["maturity"]) for m in NO_MATURITIES]

        us_results, no_results = await asyncio.gather(
            asyncio.gather(*us_promises, return_exceptions=True),
            asyncio.gather(*no_promises, return_exceptions=True),
        )

        us_spot = [
            {
                "maturity": US_MATURITIES[i]["maturity"],
                "years": US_MATURITIES[i]["years"],
                "rate": (res["value"] if isinstance(res, dict) and res else None),
            }
            for i, res in enumerate(us_results)
        ]

        no_spot = []
        for i, res in enumerate(no_results):
            pts = res if isinstance(res, list) else []
            rate = pts[-1]["value"] if pts else None
            no_spot.append({
                "maturity": NO_MATURITIES[i]["maturity"],
                "years": NO_MATURITIES[i]["years"],
                "rate": rate,
            })

        result = {
            "us": {"spot": us_spot, "forwards": _compute_forwards(us_spot)},
            "norway": {"spot": no_spot, "forwards": _compute_forwards(no_spot)},
            "updatedAt": datetime.utcnow().isoformat() + "Z",
            "note": (
                "Germany excluded: implied forward rates require daily multi-maturity data. "
                "Only monthly 10Y available via FRED."
            ),
        }
        set_cache(CACHE_KEY, result)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
