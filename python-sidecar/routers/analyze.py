"""Analysis endpoints for Pulse OS sidecar."""

import re
from typing import Optional

from bs4 import BeautifulSoup
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


# --- Models ---


class CitabilityRequest(BaseModel):
    html: str
    url: Optional[str] = None


class CitabilityResponse(BaseModel):
    score: int  # 0-100
    signals: dict
    recommendations: list[str]


class PageSpeedRequest(BaseModel):
    raw_data: dict
    strategy: str = "mobile"


class PageSpeedResponse(BaseModel):
    performance_score: int
    metrics: dict
    opportunities: list[dict]


class GscPerformanceRequest(BaseModel):
    rows: list[dict]
    domain: str


class GscPerformanceResponse(BaseModel):
    total_clicks: int
    total_impressions: int
    avg_ctr: float
    avg_position: float
    top_queries: list[dict]
    top_pages: list[dict]
    trends: dict


class BrandMentionsRequest(BaseModel):
    brand_name: str
    texts: list[str]
    sources: Optional[list[str]] = None


class BrandMentionsResponse(BaseModel):
    total_mentions: int
    sentiment_breakdown: dict
    contexts: list[dict]


# --- Endpoints ---


@router.post("/citability", response_model=CitabilityResponse)
async def analyze_citability(req: CitabilityRequest):
    """Evaluate how citable a page is by AI systems."""
    soup = BeautifulSoup(req.html, "html.parser")

    signals = {
        "has_schema": _has_schema(soup),
        "has_faq": _has_faq(soup),
        "has_tables": len(soup.find_all("table")) > 0,
        "has_lists": len(soup.find_all(["ul", "ol"])) >= 3,
        "has_headings": len(soup.find_all(["h1", "h2", "h3"])) >= 3,
        "has_definitions": _has_definitions(soup),
        "has_author": _has_author(soup),
        "short_paragraphs": _avg_paragraph_length(soup) < 150,
        "has_stats": _has_statistics(soup),
    }

    score = sum(
        weight
        for signal, weight in [
            ("has_schema", 15),
            ("has_faq", 15),
            ("has_tables", 10),
            ("has_lists", 10),
            ("has_headings", 10),
            ("has_definitions", 10),
            ("has_author", 10),
            ("short_paragraphs", 10),
            ("has_stats", 10),
        ]
        if signals.get(signal)
    )

    recommendations = []
    if not signals["has_schema"]:
        recommendations.append("Add structured data (JSON-LD) for key entities")
    if not signals["has_faq"]:
        recommendations.append("Add an FAQ section with clear Q&A pairs")
    if not signals["has_tables"]:
        recommendations.append("Include comparison tables or data tables")
    if not signals["has_definitions"]:
        recommendations.append("Add clear definitions for key terms")
    if not signals["has_author"]:
        recommendations.append("Add author byline with credentials (E-E-A-T)")
    if not signals["short_paragraphs"]:
        recommendations.append("Break long paragraphs into shorter, scannable chunks")

    return CitabilityResponse(score=score, signals=signals, recommendations=recommendations)


@router.post("/pagespeed", response_model=PageSpeedResponse)
async def analyze_pagespeed(req: PageSpeedRequest):
    """Parse and normalize PageSpeed Insights raw data."""
    lighthouse = req.raw_data.get("lighthouseResult", {})
    categories = lighthouse.get("categories", {})
    audits = lighthouse.get("audits", {})

    perf_score = int((categories.get("performance", {}).get("score", 0)) * 100)

    metrics = {
        "lcp": audits.get("largest-contentful-paint", {}).get("displayValue", "N/A"),
        "fid": audits.get("max-potential-fid", {}).get("displayValue", "N/A"),
        "cls": audits.get("cumulative-layout-shift", {}).get("displayValue", "N/A"),
        "inp": audits.get("interaction-to-next-paint", {}).get("displayValue", "N/A"),
        "ttfb": audits.get("server-response-time", {}).get("displayValue", "N/A"),
        "fcp": audits.get("first-contentful-paint", {}).get("displayValue", "N/A"),
    }

    opportunities = []
    for key, audit in audits.items():
        if audit.get("details", {}).get("type") == "opportunity":
            savings = audit.get("details", {}).get("overallSavingsMs", 0)
            if savings > 100:
                opportunities.append(
                    {
                        "audit": key,
                        "title": audit.get("title", key),
                        "savings_ms": savings,
                        "description": audit.get("description", ""),
                    }
                )

    opportunities.sort(key=lambda x: x["savings_ms"], reverse=True)

    return PageSpeedResponse(
        performance_score=perf_score,
        metrics=metrics,
        opportunities=opportunities[:10],
    )


@router.post("/gsc-performance", response_model=GscPerformanceResponse)
async def analyze_gsc_performance(req: GscPerformanceRequest):
    """Analyze Google Search Console performance data."""
    rows = req.rows

    total_clicks = sum(r.get("clicks", 0) for r in rows)
    total_impressions = sum(r.get("impressions", 0) for r in rows)
    avg_ctr = total_clicks / max(total_impressions, 1)
    avg_position = (
        sum(r.get("position", 0) * r.get("impressions", 1) for r in rows)
        / max(total_impressions, 1)
    )

    # Top queries by clicks
    query_rows = [r for r in rows if "query" in r.get("keys", r)]
    query_rows.sort(key=lambda r: r.get("clicks", 0), reverse=True)
    top_queries = [
        {
            "query": r.get("keys", [r.get("query", "")])[0] if isinstance(r.get("keys"), list) else r.get("query", ""),
            "clicks": r.get("clicks", 0),
            "impressions": r.get("impressions", 0),
            "ctr": r.get("ctr", 0),
            "position": round(r.get("position", 0), 1),
        }
        for r in query_rows[:20]
    ]

    # Top pages by clicks
    page_rows = [r for r in rows if "page" in str(r.get("keys", r))]
    page_rows.sort(key=lambda r: r.get("clicks", 0), reverse=True)
    top_pages = [
        {
            "page": r.get("keys", [r.get("page", "")])[0] if isinstance(r.get("keys"), list) else r.get("page", ""),
            "clicks": r.get("clicks", 0),
            "impressions": r.get("impressions", 0),
        }
        for r in page_rows[:20]
    ]

    return GscPerformanceResponse(
        total_clicks=total_clicks,
        total_impressions=total_impressions,
        avg_ctr=round(avg_ctr, 4),
        avg_position=round(avg_position, 1),
        top_queries=top_queries,
        top_pages=top_pages,
        trends={},
    )


@router.post("/brand-mentions", response_model=BrandMentionsResponse)
async def analyze_brand_mentions(req: BrandMentionsRequest):
    """Detect brand mentions in a text corpus."""
    brand = req.brand_name.lower()
    brand_pattern = re.compile(re.escape(brand), re.IGNORECASE)

    total_mentions = 0
    contexts = []

    for i, text in enumerate(req.texts):
        matches = list(brand_pattern.finditer(text))
        total_mentions += len(matches)

        for match in matches[:3]:  # Max 3 contexts per text
            start = max(0, match.start() - 100)
            end = min(len(text), match.end() + 100)
            context_text = text[start:end].strip()

            source = req.sources[i] if req.sources and i < len(req.sources) else f"text_{i}"
            contexts.append(
                {
                    "source": source,
                    "context": f"...{context_text}...",
                    "sentiment": "neutral",  # Basic — would use NLP model in production
                }
            )

    sentiment_breakdown = {
        "positive": 0,
        "neutral": total_mentions,
        "negative": 0,
    }

    return BrandMentionsResponse(
        total_mentions=total_mentions,
        sentiment_breakdown=sentiment_breakdown,
        contexts=contexts[:20],
    )


# --- Helper functions ---


def _has_schema(soup: BeautifulSoup) -> bool:
    """Check for JSON-LD structured data."""
    scripts = soup.find_all("script", {"type": "application/ld+json"})
    return len(scripts) > 0


def _has_faq(soup: BeautifulSoup) -> bool:
    """Check for FAQ-like patterns."""
    # Check for FAQ schema
    for script in soup.find_all("script", {"type": "application/ld+json"}):
        if "FAQPage" in script.get_text():
            return True
    # Check for FAQ headings
    for heading in soup.find_all(["h2", "h3"]):
        text = heading.get_text().lower()
        if "faq" in text or "frequently asked" in text:
            return True
    return False


def _has_definitions(soup: BeautifulSoup) -> bool:
    """Check for definition-like patterns (dl/dt/dd or 'X is Y' patterns)."""
    if soup.find("dl"):
        return True
    text = soup.get_text()
    definition_pattern = re.compile(r"\b\w+\s+is\s+(a|an|the)\s+", re.IGNORECASE)
    return len(definition_pattern.findall(text)) >= 3


def _has_author(soup: BeautifulSoup) -> bool:
    """Check for author attribution."""
    author_patterns = [
        soup.find(class_=re.compile(r"author", re.IGNORECASE)),
        soup.find(attrs={"rel": "author"}),
        soup.find(attrs={"itemprop": "author"}),
    ]
    return any(author_patterns)


def _avg_paragraph_length(soup: BeautifulSoup) -> float:
    """Calculate average paragraph length in characters."""
    paragraphs = [p.get_text().strip() for p in soup.find_all("p") if p.get_text().strip()]
    if not paragraphs:
        return 0
    return sum(len(p) for p in paragraphs) / len(paragraphs)


def _has_statistics(soup: BeautifulSoup) -> bool:
    """Check for statistical content (numbers, percentages)."""
    text = soup.get_text()
    stat_pattern = re.compile(r"\d+%|\$\d+|\d+\.\d+x|\d{1,3}(,\d{3})+")
    return len(stat_pattern.findall(text)) >= 3
