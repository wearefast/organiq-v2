"""Pulse OS Python Sidecar — Analysis Service"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import analyze
from routers import keywords
from routers import reports

app = FastAPI(
    title="Pulse OS Analysis Sidecar",
    version="1.0.0",
    docs_url="/docs",
)

_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3001,http://localhost:3002"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(keywords.router, prefix="/analyze", tags=["keywords"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])


@app.get("/health")
async def health():
    return {"status": "ok"}
