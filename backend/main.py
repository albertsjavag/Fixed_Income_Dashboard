"""Fixed Income Dashboard — FastAPI backend.

Serves all data endpoints previously handled by Next.js API routes.
Run with: uvicorn main:app --reload --port 8000
"""
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routers import (
    breakeven,
    correlation,
    forward_rates,
    history_10y,
    series_data,
    spreads,
    steepness,
    yield_changes,
    zscore,
)

app = FastAPI(title="Fixed Income Dashboard API", version="1.0.0")

# CORS — allow the Next.js frontend and any Render deployment URL
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
]
extra = os.getenv("ALLOWED_ORIGINS", "")
if extra:
    ALLOWED_ORIGINS.extend([o.strip() for o in extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Mount all routers under /api to match the existing frontend calls
for module in [
    breakeven,
    correlation,
    forward_rates,
    history_10y,
    series_data,
    spreads,
    steepness,
    yield_changes,
    zscore,
]:
    app.include_router(module.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
