"""Analysis endpoints for Pulse OS sidecar."""

import re
from typing import Optional

from bs4 import BeautifulSoup
from fastapi import APIRouter
from pydantic import BaseModel
import textstat

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


# --- Readability & Content Scoring Models ---


class ReadabilityRequest(BaseModel):
    text: str
    content_type: str = "article"


class ReadabilityResponse(BaseModel):
    flesch_reading_ease: float
    flesch_kincaid_grade: float
    gunning_fog: float
    avg_sentence_length: float
    avg_word_length: float
    sentence_count: int
    word_count: int
    paragraph_count: int
    passive_voice_percent: float
    transition_word_percent: float
    readability_score: int  # 0-100
    grade_label: str


class ContentScoreRequest(BaseModel):
    text: str
    target_keyword: str
    secondary_keywords: list[str] = []
    target_word_count: int = 1500
    content_type: str = "article"


class ContentScoreResponse(BaseModel):
    readability: int  # 0-100
    seo_quality: int  # 0-100
    citability: int  # 0-100
    content_length: int  # 0-100
    opportunity: int  # 0-100
    overall: int  # 0-100
    details: dict
    recommendations: list[str]


# --- Readability Endpoint ---


@router.post("/readability", response_model=ReadabilityResponse)
async def analyze_readability(req: ReadabilityRequest):
    """Analyze text readability using textstat metrics."""
    text = req.text.strip()
    if not text:
        return ReadabilityResponse(
            flesch_reading_ease=0, flesch_kincaid_grade=0, gunning_fog=0,
            avg_sentence_length=0, avg_word_length=0, sentence_count=0,
            word_count=0, paragraph_count=0, passive_voice_percent=0,
            transition_word_percent=0, readability_score=0, grade_label="N/A",
        )

    fre = textstat.flesch_reading_ease(text)
    fkg = textstat.flesch_kincaid_grade(text)
    fog = textstat.gunning_fog(text)

    sentences = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    sentence_count = len(sentences)
    words = text.split()
    word_count = len(words)
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    paragraph_count = len(paragraphs) if paragraphs else 1

    avg_sentence_length = word_count / max(sentence_count, 1)
    avg_word_length = sum(len(w) for w in words) / max(word_count, 1)

    # Passive voice detection (simple heuristic)
    passive_patterns = re.compile(
        r"\b(is|are|was|were|been|being|be)\s+\w+ed\b", re.IGNORECASE
    )
    passive_count = len(passive_patterns.findall(text))
    passive_pct = (passive_count / max(sentence_count, 1)) * 100

    # Transition words detection
    transition_words = {
        "however", "therefore", "furthermore", "moreover", "additionally",
        "consequently", "meanwhile", "nevertheless", "nonetheless", "although",
        "because", "since", "while", "whereas", "thus", "hence", "accordingly",
        "similarly", "likewise", "conversely", "instead", "otherwise",
        "specifically", "particularly", "notably", "for example", "for instance",
        "in addition", "on the other hand", "as a result", "in contrast",
        "in conclusion", "to summarize", "first", "second", "third", "finally",
    }
    transition_count = sum(
        1 for s in sentences
        if any(tw in s.lower() for tw in transition_words)
    )
    transition_pct = (transition_count / max(sentence_count, 1)) * 100

    # Compute composite readability score (0-100)
    # Flesch Reading Ease is already 0-100 (higher = easier)
    fre_score = max(0, min(100, fre))

    # Sentence length score
    if 15 <= avg_sentence_length <= 20:
        sl_score = 100
    elif 12 <= avg_sentence_length < 15 or 20 < avg_sentence_length <= 25:
        sl_score = 75
    elif 10 <= avg_sentence_length < 12 or 25 < avg_sentence_length <= 30:
        sl_score = 50
    else:
        sl_score = 25

    # Passive voice score (less is better)
    if passive_pct < 5:
        pv_score = 100
    elif passive_pct < 10:
        pv_score = 75
    elif passive_pct < 15:
        pv_score = 50
    else:
        pv_score = 25

    # Transition word score
    if transition_pct > 30:
        tw_score = 100
    elif transition_pct > 20:
        tw_score = 75
    elif transition_pct > 10:
        tw_score = 50
    else:
        tw_score = 25

    readability_score = int(
        fre_score * 0.35 + sl_score * 0.25 + pv_score * 0.20 + tw_score * 0.20
    )
    readability_score = max(0, min(100, readability_score))

    if readability_score >= 90:
        grade_label = "Excellent"
    elif readability_score >= 75:
        grade_label = "Good"
    elif readability_score >= 60:
        grade_label = "Needs Improvement"
    else:
        grade_label = "Poor"

    return ReadabilityResponse(
        flesch_reading_ease=round(fre, 1),
        flesch_kincaid_grade=round(fkg, 1),
        gunning_fog=round(fog, 1),
        avg_sentence_length=round(avg_sentence_length, 1),
        avg_word_length=round(avg_word_length, 1),
        sentence_count=sentence_count,
        word_count=word_count,
        paragraph_count=paragraph_count,
        passive_voice_percent=round(passive_pct, 1),
        transition_word_percent=round(transition_pct, 1),
        readability_score=readability_score,
        grade_label=grade_label,
    )


# --- Content Score Endpoint ---


@router.post("/content-score", response_model=ContentScoreResponse)
async def analyze_content_score(req: ContentScoreRequest):
    """Compute a multi-dimensional content quality score."""
    text = req.text.strip()
    words = text.split()
    word_count = len(words)
    text_lower = text.lower()

    # --- Readability score ---
    fre = textstat.flesch_reading_ease(text) if text else 0
    readability = max(0, min(100, int(fre)))

    # --- SEO Quality score ---
    seo_factors = {}
    # Keyword density
    primary_kw = req.target_keyword.lower()
    primary_count = text_lower.count(primary_kw)
    primary_density = (primary_count / max(word_count, 1)) * 100
    if 1 <= primary_density <= 2:
        seo_factors["keyword_density"] = 100
    elif 0.5 <= primary_density < 1 or 2 < primary_density <= 3:
        seo_factors["keyword_density"] = 70
    else:
        seo_factors["keyword_density"] = 30

    # Secondary keyword coverage
    secondary_found = sum(
        1 for kw in req.secondary_keywords if kw.lower() in text_lower
    )
    secondary_total = max(len(req.secondary_keywords), 1)
    seo_factors["secondary_coverage"] = int((secondary_found / secondary_total) * 100)

    # Heading structure (check for markdown headings)
    h2_count = len(re.findall(r"^##\s", text, re.MULTILINE))
    h3_count = len(re.findall(r"^###\s", text, re.MULTILINE))
    if h2_count >= 3 and h3_count >= 2:
        seo_factors["heading_structure"] = 100
    elif h2_count >= 2:
        seo_factors["heading_structure"] = 70
    else:
        seo_factors["heading_structure"] = 30

    # Lists and tables
    list_count = len(re.findall(r"^[-*]\s", text, re.MULTILINE))
    table_count = len(re.findall(r"^\|", text, re.MULTILINE))
    if list_count >= 3 and table_count >= 1:
        seo_factors["formatting"] = 100
    elif list_count >= 2 or table_count >= 1:
        seo_factors["formatting"] = 70
    else:
        seo_factors["formatting"] = 30

    seo_quality = int(
        seo_factors.get("keyword_density", 0) * 0.30
        + seo_factors.get("secondary_coverage", 0) * 0.25
        + seo_factors.get("heading_structure", 0) * 0.25
        + seo_factors.get("formatting", 0) * 0.20
    )

    # --- Citability score ---
    citability_factors = {}
    # Definition patterns
    definition_count = len(re.findall(r"\b\w+\s+is\s+(a|an|the)\s+", text, re.IGNORECASE))
    citability_factors["definitions"] = min(100, definition_count * 20)

    # FAQ / Q&A patterns
    question_count = len(re.findall(r"\?", text))
    citability_factors["qa_patterns"] = min(100, question_count * 15)

    # List usage
    citability_factors["list_usage"] = min(100, list_count * 15)

    # Statistics / data points
    stat_count = len(re.findall(r"\d+%|\$[\d,.]+|\d+\.\d+x", text))
    citability_factors["data_points"] = min(100, stat_count * 20)

    citability = int(
        citability_factors.get("definitions", 0) * 0.25
        + citability_factors.get("qa_patterns", 0) * 0.25
        + citability_factors.get("list_usage", 0) * 0.25
        + citability_factors.get("data_points", 0) * 0.25
    )
    citability = min(100, citability)

    # --- Content Length score ---
    target = req.target_word_count
    if target > 0:
        ratio = word_count / target
        content_length = min(100, int(ratio * 100))
    else:
        content_length = 50  # default when no target

    # --- Opportunity (composite) ---
    opportunity = int(
        readability * 0.25 + seo_quality * 0.25 + citability * 0.25 + content_length * 0.25
    )

    # --- Overall score ---
    overall = int(
        readability * 0.20 + seo_quality * 0.30 + citability * 0.20 + content_length * 0.30
    )

    # --- Recommendations ---
    recommendations = []
    if readability < 60:
        recommendations.append("Simplify sentence structure — aim for 15-20 words per sentence")
    if seo_quality < 60:
        if seo_factors.get("keyword_density", 0) < 50:
            recommendations.append(f"Increase usage of primary keyword '{req.target_keyword}' (target 1-2% density)")
        if seo_factors.get("secondary_coverage", 0) < 50:
            recommendations.append("Include more secondary keywords naturally in the content")
        if seo_factors.get("heading_structure", 0) < 50:
            recommendations.append("Add more H2 and H3 subheadings (every 200-300 words)")
    if citability < 60:
        recommendations.append("Add clear definitions, Q&A pairs, and data points for AI citability")
    if content_length < 70:
        recommendations.append(f"Content is {word_count} words — target is {target} words. Add more depth.")
    elif content_length > 120:
        recommendations.append(f"Content is {word_count} words — significantly exceeds target of {target}. Consider trimming.")

    return ContentScoreResponse(
        readability=readability,
        seo_quality=seo_quality,
        citability=citability,
        content_length=content_length,
        opportunity=opportunity,
        overall=overall,
        details={
            "word_count": word_count,
            "primary_keyword_count": primary_count,
            "primary_keyword_density": round(primary_density, 2),
            "secondary_keywords_found": secondary_found,
            "secondary_keywords_total": len(req.secondary_keywords),
            "h2_count": h2_count,
            "h3_count": h3_count,
            "list_items": list_count,
            "tables": table_count,
            "seo_factors": seo_factors,
            "citability_factors": citability_factors,
        },
        recommendations=recommendations,
    )
