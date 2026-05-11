"""Pulse OS Python Sidecar — Analysis Service"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import analyze
from routers import keywords

app = FastAPI(
    title="Pulse OS Analysis Sidecar",
    version="1.0.0",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3002"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(keywords.router, prefix="/analyze", tags=["keywords"])


@app.get("/health")
async def health():
    return {"status": "ok"}
