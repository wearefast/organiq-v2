# Python Sidecar — Pulse OS Analysis Service

FastAPI service providing specialized analysis endpoints that are better suited to Python libraries.

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /analyze/citability` | Evaluate AI citability of HTML content |
| `POST /analyze/pagespeed` | Parse and score PageSpeed Insights data |
| `POST /analyze/gsc-performance` | Analyze Google Search Console data |
| `POST /analyze/brand-mentions` | Detect brand mentions in text corpus |
| `GET /health` | Health check |

## Setup

```bash
cd python-sidecar
pip install -r requirements.txt
uvicorn main:app --port 8000
```
