"""Keyword analysis endpoints for Pulse OS sidecar."""

import math
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


# --- Models ---


class KeywordMetrics(BaseModel):
    keyword: str
    volume: int = 0
    difficulty: int = 0
    cpc: float = 0.0
    intent: Optional[str] = None
    funnel_stage: Optional[str] = None
    current_position: Optional[int] = None


class KeywordAnalysisRequest(BaseModel):
    keywords: list[KeywordMetrics]
    domain: Optional[str] = None


class KeywordScore(BaseModel):
    keyword: str
    volume: int
    difficulty: int
    intent: str
    funnel_stage: str
    opportunity_score: float
    is_quick_win: bool
    parent_topic: Optional[str] = None


class KeywordAnalysisResponse(BaseModel):
    scored_keywords: list[KeywordScore]
    stats: dict
    intent_distribution: dict
    funnel_distribution: dict


class OpportunityRequest(BaseModel):
    keywords: list[KeywordMetrics]
    max_difficulty: int = 40
    min_volume: int = 100
    position_range: tuple[int, int] = (4, 20)


class OpportunityResponse(BaseModel):
    opportunities: list[dict]
    total_potential_traffic: int
    avg_difficulty: float
    by_action: dict


class CompetitorGapsRequest(BaseModel):
    our_keywords: list[str]
    competitor_keywords: list[KeywordMetrics]
    competitor_name: str


class CompetitorGapsResponse(BaseModel):
    gaps: list[KeywordScore]
    total_gap_volume: int
    gap_count: int
    by_intent: dict
    by_funnel: dict


# --- Endpoints ---


@router.post("/keywords", response_model=KeywordAnalysisResponse)
async def analyze_keywords(req: KeywordAnalysisRequest):
    """Score and classify a keyword set with opportunity analysis."""
    scored = []
    max_volume = max((kw.volume for kw in req.keywords), default=1) or 1

    for kw in req.keywords:
        intent = kw.intent or _classify_intent(kw.keyword)
        funnel = kw.funnel_stage or _classify_funnel(intent, kw.keyword)
        score = _calculate_opportunity(
            volume=kw.volume,
            difficulty=kw.difficulty,
            intent=intent,
            position=kw.current_position,
            max_volume=max_volume,
        )
        is_quick_win = (
            kw.current_position is not None
            and 4 <= kw.current_position <= 20
            and kw.difficulty < 40
            and kw.volume > 100
        )

        scored.append(
            KeywordScore(
                keyword=kw.keyword,
                volume=kw.volume,
                difficulty=kw.difficulty,
                intent=intent,
                funnel_stage=funnel,
                opportunity_score=round(score, 3),
                is_quick_win=is_quick_win,
            )
        )

    scored.sort(key=lambda x: x.opportunity_score, reverse=True)

    # Calculate distributions
    intent_dist: dict[str, int] = {}
    funnel_dist: dict[str, int] = {}
    for s in scored:
        intent_dist[s.intent] = intent_dist.get(s.intent, 0) + 1
        funnel_dist[s.funnel_stage] = funnel_dist.get(s.funnel_stage, 0) + 1

    total_vol = sum(s.volume for s in scored)
    avg_diff = sum(s.difficulty for s in scored) / max(len(scored), 1)
    quick_wins = sum(1 for s in scored if s.is_quick_win)

    return KeywordAnalysisResponse(
        scored_keywords=scored,
        stats={
            "total": len(scored),
            "total_volume": total_vol,
            "avg_difficulty": round(avg_diff, 1),
            "avg_opportunity": round(sum(s.opportunity_score for s in scored) / max(len(scored), 1), 3),
            "quick_wins": quick_wins,
        },
        intent_distribution=intent_dist,
        funnel_distribution=funnel_dist,
    )


@router.post("/opportunity", response_model=OpportunityResponse)
async def analyze_opportunity(req: OpportunityRequest):
    """Identify quick-win keyword opportunities based on position + difficulty."""
    opportunities = []

    for kw in req.keywords:
        if kw.current_position is None:
            continue
        if not (req.position_range[0] <= kw.current_position <= req.position_range[1]):
            continue
        if kw.difficulty > req.max_difficulty:
            continue
        if kw.volume < req.min_volume:
            continue

        # Estimate traffic gain from moving to position 1-3
        ctr_current = _estimate_ctr(kw.current_position)
        ctr_target = _estimate_ctr(3)
        traffic_gain = int(kw.volume * (ctr_target - ctr_current))

        action = _determine_action(kw.current_position, kw.difficulty)

        opportunities.append(
            {
                "keyword": kw.keyword,
                "current_position": kw.current_position,
                "volume": kw.volume,
                "difficulty": kw.difficulty,
                "estimated_traffic_gain": traffic_gain,
                "action": action,
                "priority": "high" if traffic_gain > 100 else "medium",
            }
        )

    opportunities.sort(key=lambda x: x["estimated_traffic_gain"], reverse=True)

    total_traffic = sum(o["estimated_traffic_gain"] for o in opportunities)
    avg_diff = sum(o["difficulty"] for o in opportunities) / max(len(opportunities), 1)

    by_action: dict[str, int] = {}
    for o in opportunities:
        by_action[o["action"]] = by_action.get(o["action"], 0) + 1

    return OpportunityResponse(
        opportunities=opportunities,
        total_potential_traffic=total_traffic,
        avg_difficulty=round(avg_diff, 1),
        by_action=by_action,
    )


@router.post("/competitor-gaps", response_model=CompetitorGapsResponse)
async def analyze_competitor_gaps(req: CompetitorGapsRequest):
    """Find keyword gaps — keywords a competitor ranks for that we don't."""
    our_set = set(kw.lower().strip() for kw in req.our_keywords)
    max_volume = max((kw.volume for kw in req.competitor_keywords), default=1) or 1

    gaps = []
    for kw in req.competitor_keywords:
        if kw.keyword.lower().strip() in our_set:
            continue

        intent = kw.intent or _classify_intent(kw.keyword)
        funnel = kw.funnel_stage or _classify_funnel(intent, kw.keyword)
        score = _calculate_opportunity(
            volume=kw.volume,
            difficulty=kw.difficulty,
            intent=intent,
            position=None,
            max_volume=max_volume,
        )

        gaps.append(
            KeywordScore(
                keyword=kw.keyword,
                volume=kw.volume,
                difficulty=kw.difficulty,
                intent=intent,
                funnel_stage=funnel,
                opportunity_score=round(score, 3),
                is_quick_win=False,
            )
        )

    gaps.sort(key=lambda x: x.opportunity_score, reverse=True)

    by_intent: dict[str, int] = {}
    by_funnel: dict[str, int] = {}
    for g in gaps:
        by_intent[g.intent] = by_intent.get(g.intent, 0) + 1
        by_funnel[g.funnel_stage] = by_funnel.get(g.funnel_stage, 0) + 1

    total_vol = sum(g.volume for g in gaps)

    return CompetitorGapsResponse(
        gaps=gaps[:500],
        total_gap_volume=total_vol,
        gap_count=len(gaps),
        by_intent=by_intent,
        by_funnel=by_funnel,
    )


# --- Helper functions ---


def _classify_intent(keyword: str) -> str:
    """Classify keyword intent based on modifier patterns."""
    kw = keyword.lower()

    transactional = ["buy", "price", "cost", "discount", "deal", "coupon", "order", "purchase", "shop", "cheap"]
    commercial = ["best", "top", "review", "comparison", "vs", "alternative", "recommend"]
    navigational = ["login", "sign in", "dashboard", "app", "website", "official"]

    if any(mod in kw for mod in transactional):
        return "transactional"
    if any(mod in kw for mod in commercial):
        return "commercial"
    if any(mod in kw for mod in navigational):
        return "navigational"
    return "informational"


def _classify_funnel(intent: str, keyword: str) -> str:
    """Map intent to funnel stage."""
    if intent == "transactional":
        return "bofu"
    if intent == "commercial":
        return "mofu"
    if intent == "navigational":
        return "bofu"
    # Informational — check if it's more MOFU or TOFU
    kw = keyword.lower()
    mofu_signals = ["how to", "guide", "tutorial", "template", "example", "step"]
    if any(sig in kw for sig in mofu_signals):
        return "mofu"
    return "tofu"


def _calculate_opportunity(
    volume: int,
    difficulty: int,
    intent: str,
    position: Optional[int],
    max_volume: int,
) -> float:
    """Calculate opportunity score (0-1)."""
    intent_weights = {
        "transactional": 1.0,
        "commercial": 0.8,
        "informational": 0.5,
        "navigational": 0.3,
    }

    volume_norm = volume / max(max_volume, 1)
    difficulty_score = (100 - difficulty) / 100

    position_bonus = 0.0
    if position is not None:
        if 4 <= position <= 10:
            position_bonus = 1.0
        elif 11 <= position <= 20:
            position_bonus = 0.7
        elif 21 <= position <= 50:
            position_bonus = 0.3

    intent_weight = intent_weights.get(intent, 0.5)

    score = (volume_norm * 0.35) + (difficulty_score * 0.35) + (intent_weight * 0.15) + (position_bonus * 0.15)
    return min(max(score, 0.0), 1.0)


def _estimate_ctr(position: int) -> float:
    """Estimate organic CTR by position."""
    ctr_map = {
        1: 0.28, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.06,
        6: 0.05, 7: 0.04, 8: 0.03, 9: 0.03, 10: 0.02,
    }
    if position <= 10:
        return ctr_map.get(position, 0.02)
    if position <= 20:
        return 0.01
    return 0.005


def _determine_action(position: int, difficulty: int) -> str:
    """Determine the optimization action for a quick-win keyword."""
    if position <= 7:
        return "optimize_meta"
    if position <= 12:
        return "update_content"
    if difficulty < 20:
        return "internal_link"
    return "expand_content"
