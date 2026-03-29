from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.text_analysis import TextAnalysis 
from app.repositories import mentor_repo


def get_summary(db: Session, user_id: int) -> dict:
    # total + avg toxicity
    total, avg_tox = db.execute(
        select(
            func.count(TextAnalysis.id),
            func.avg(TextAnalysis.toxicity_score),
        ).where(TextAnalysis.user_id == user_id)
    ).one()

    # tone distribution
    tone_rows = db.execute(
        select(TextAnalysis.tone, func.count(TextAnalysis.id))
        .where(TextAnalysis.user_id == user_id)
        .group_by(TextAnalysis.tone)
    ).all()

    tone_counts = {"supportive": 0, "neutral": 0, "harsh": 0}
    for tone, cnt in tone_rows:
        if tone in tone_counts:
            tone_counts[tone] = int(cnt)

    # top emotions (based on primary_emotion frequency)
    emo_rows = db.execute(
        select(TextAnalysis.primary_emotion)
        .where(TextAnalysis.user_id == user_id, TextAnalysis.primary_emotion.isnot(None))
    ).scalars().all()

    top_emotions = [e for e, _ in Counter(emo_rows).most_common(5)]

    return {
        "total_analyses": int(total or 0),
        "avg_toxicity": float(avg_tox) if avg_tox is not None else None,
        "tone_counts": tone_counts,
        "top_emotions": top_emotions,
    }


def toxicity_timeline(db: Session, user_id: int, days: int = 30) -> List[dict]:
    since_dt = datetime.utcnow() - timedelta(days=days)

    rows = db.execute(
        select(
            func.date_trunc("day", TextAnalysis.created_at).label("day"),
            func.avg(TextAnalysis.toxicity_score).label("value"),
        )
        .where(
            TextAnalysis.user_id == user_id,
            TextAnalysis.created_at >= since_dt,
            TextAnalysis.toxicity_score.isnot(None),
        )
        .group_by("day")
        .order_by("day")
    ).all()

    points = []
    for day_dt, value in rows:
        points.append({"day": day_dt.date(), "value": float(value)})

    return points


def emotion_timeline(
    db: Session,
    user_id: int,
    emotions: List[str],
    days: int = 30,
) -> Dict[str, List[dict]]:
    """
    Returns average emotion score per day for selected emotions.
    Uses TextAnalysis.emotions JSON (dict).
    We do aggregation in Python because JSON math differs across DBs and ORM complexity.
    """
    since_dt = datetime.utcnow() - timedelta(days=days)
    rows = db.execute(
        select(TextAnalysis.created_at, TextAnalysis.emotions)
        .where(
            TextAnalysis.user_id == user_id,
            TextAnalysis.created_at >= since_dt,
            TextAnalysis.emotions.isnot(None),
        )
        .order_by(TextAnalysis.created_at.asc())
    ).all()

    # bucket by day
    buckets = defaultdict(list)  # day -> list[emotions_dict]
    for created_at, emo_dict in rows:
        if not isinstance(emo_dict, dict):
            continue
        buckets[created_at.date()].append(emo_dict)

    series: Dict[str, List[dict]] = {e: [] for e in emotions}

    for day, emo_dicts in buckets.items():
        for e in emotions:
            vals = []
            for d in emo_dicts:
                v = d.get(e)
                if isinstance(v, (int, float)):
                    vals.append(float(v))
            if vals:
                series[e].append({"day": day, "value": sum(vals) / len(vals)})

    # keep chronological
    for e in emotions:
        series[e].sort(key=lambda p: p["day"])

    return series

def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def _calculate_risk_score(
    avg_toxicity: float,
    dominant_emotion: str | None,
    tone_counts: dict[str, int],
    total_items: int,
    negative_count: int,
) -> dict:
    score = 0
    flags: list[str] = []

    if avg_toxicity >= 0.60:
        score += 30
        flags.append("high toxicity")
    elif avg_toxicity >= 0.40:
        score += 15
        flags.append("moderate toxicity")

    if dominant_emotion in {
        "sadness",
        "anger",
        "fear",
        "annoyance",
        "disappointment",
        "disapproval",
        "disgust",
        "grief",
        "remorse",
    }:
        score += 20
        flags.append(f"dominant {dominant_emotion}")

    harsh_count = tone_counts.get("harsh", 0)
    if harsh_count >= 3:
        score += 10
        flags.append("repeated harsh tone")

    negative_ratio = (negative_count / total_items) if total_items > 0 else 0.0
    if negative_ratio >= 0.60:
        score += 15
        flags.append("negative emotion pattern")

    if score >= 50:
        risk_level = "high"
    elif score >= 25:
        risk_level = "moderate"
    else:
        risk_level = "low"

    return {
        "risk_score": score,
        "risk_level": risk_level,
        "flags": flags,
    }


def build_mentor_overview(db: Session, mentor_user_id: int, days: int = 30) -> dict:
    since_dt = datetime.utcnow() - timedelta(days=days)

    pending_requests = mentor_repo.list_pending_requests_for_mentor(
        db,
        mentor_user_id=mentor_user_id,
    )
    mentorships = mentor_repo.list_accepted_mentees_for_mentor(
        db,
        mentor_user_id=mentor_user_id,
    )

    mentee_cards: list[dict] = []

    negative_emotions = {
        "sadness",
        "anger",
        "fear",
        "annoyance",
        "disappointment",
        "disapproval",
        "disgust",
        "grief",
        "remorse",
    }

    for mentorship in mentorships:
        mentee_id = mentorship.mentee_user_id
        mentee = db.get(User, mentee_id)

        rows = (
            db.query(TextAnalysis)
            .filter(
                TextAnalysis.user_id == mentee_id,
                TextAnalysis.created_at >= since_dt,
            )
            .order_by(TextAnalysis.created_at.desc())
            .all()
        )

        total_items = len(rows)

        if total_items == 0:
            mentee_cards.append(
                {
                    "mentorship_id": mentorship.id,
                    "mentee_user_id": mentee_id,
                    "display_name": (mentee.display_name or mentee.name) if mentee else f"User {mentee_id}",
                    "profile_picture_url": mentee.profile_picture_url if mentee else None,
                    "avg_toxicity": 0.0,
                    "dominant_emotion": None,
                    "risk_score": 0,
                    "risk_level": "low",
                    "flags": ["no recent analytics data"],
                    "recent_items_count": 0,
                }
            )
            continue

        tox_vals = [
            _safe_float(row.toxicity_score, 0.0)
            for row in rows
            if row.toxicity_score is not None
        ]
        avg_toxicity = sum(tox_vals) / len(tox_vals) if tox_vals else 0.0

        emotion_counts: Counter[str] = Counter()
        tone_counts: Counter[str] = Counter()
        negative_count = 0

        for row in rows:
            if row.primary_emotion:
                emotion = row.primary_emotion.strip().lower()
                emotion_counts[emotion] += 1
                if emotion in negative_emotions:
                    negative_count += 1

            tone = (row.tone or "unknown").strip().lower()
            tone_counts[tone] += 1

        dominant_emotion = emotion_counts.most_common(1)[0][0] if emotion_counts else None

        risk = _calculate_risk_score(
            avg_toxicity=avg_toxicity,
            dominant_emotion=dominant_emotion,
            tone_counts=dict(tone_counts),
            total_items=total_items,
            negative_count=negative_count,
        )

        mentee_cards.append(
            {
                "mentorship_id": mentorship.id,
                "mentee_user_id": mentee_id,
                "display_name": (mentee.display_name or mentee.name) if mentee else f"User {mentee_id}",
                "profile_picture_url": mentee.profile_picture_url if mentee else None,
                "avg_toxicity": round(avg_toxicity, 3),
                "dominant_emotion": dominant_emotion,
                "risk_score": risk["risk_score"],
                "risk_level": risk["risk_level"],
                "flags": risk["flags"],
                "recent_items_count": total_items,
            }
        )

    mentee_cards.sort(
        key=lambda item: (item["risk_score"], item["recent_items_count"]),
        reverse=True,
    )

    return {
        "pending_requests_count": len(pending_requests),
        "active_mentees_count": len(mentorships),
        "mentees": mentee_cards,
    }
    
def build_user_dashboard(
    db: Session,
    user_id: int,
    days: int = 30,
) -> dict:
    since_dt = datetime.utcnow() - timedelta(days=days)

    summary = get_summary(db, user_id)

    activity_rows = (
        db.query(
            TextAnalysis.object_type,
            func.count(TextAnalysis.id).label("count"),
        )
        .filter(
            TextAnalysis.user_id == user_id,
            TextAnalysis.created_at >= since_dt,
        )
        .group_by(TextAnalysis.object_type)
        .all()
    )

    activity_counts = {
        "posts": 0,
        "journals": 0,
        "comments": 0,
    }

    for object_type, count in activity_rows:
        if object_type == "post":
            activity_counts["posts"] = int(count)
        elif object_type == "journal":
            activity_counts["journals"] = int(count)
        elif object_type == "comment":
            activity_counts["comments"] = int(count)

    recent_rows = (
        db.query(
            TextAnalysis.object_type,
            TextAnalysis.primary_emotion,
            TextAnalysis.tone,
            TextAnalysis.toxicity_score,
            TextAnalysis.created_at,
        )
        .filter(
            TextAnalysis.user_id == user_id,
            TextAnalysis.created_at >= since_dt,
        )
        .order_by(TextAnalysis.created_at.desc())
        .all()
    )

    by_type = {
        "post": {
            "dominant_primary_emotion_week": None,
            "trend_text": "No data",
        },
        "journal": {
            "dominant_primary_emotion_week": None,
            "trend_text": "No data",
        },
        "comment": {
            "dominant_primary_emotion_week": None,
            "trend_text": "No data",
        },
    }

    negative_emotions = {
        "anger",
        "annoyance",
        "sadness",
        "fear",
        "disappointment",
        "disapproval",
        "disgust",
        "grief",
        "remorse",
    }

    positive_emotions = {
        "joy",
        "optimism",
        "love",
        "gratitude",
        "caring",
        "approval",
        "admiration",
        "relief",
        "pride",
        "amusement",
        "excitement",
    }

    for object_type in ["post", "journal", "comment"]:
        rows_for_type = [r for r in recent_rows if r.object_type == object_type]
        emotion_counts = Counter()

        for row in rows_for_type:
            if row.primary_emotion:
                emotion_counts[row.primary_emotion.strip().lower()] += 1

        dominant = emotion_counts.most_common(1)[0][0] if emotion_counts else None
        trend_text = "Emotion pattern stable"

        if dominant in negative_emotions:
            trend_text = "Negative emotion increasing"
        elif dominant in positive_emotions:
            trend_text = "Positive emotions increasing"

        by_type[object_type] = {
            "dominant_primary_emotion_week": dominant,
            "trend_text": trend_text,
        }

    top_emotions = summary.get("top_emotions", [])
    avg_toxicity = summary.get("avg_toxicity") or 0.0
    tone_counts = summary.get("tone_counts", {})

    insights = []

    if avg_toxicity >= 0.60:
        insights.append(
            {
                "type": "warning",
                "title": "High Toxicity Trend",
                "message": "Your recent content shows a high toxicity level. Consider rewriting before posting.",
            }
        )
    elif avg_toxicity >= 0.40:
        insights.append(
            {
                "type": "warning",
                "title": "Moderate Toxicity Trend",
                "message": "Some recent content appears harsher than usual.",
            }
        )

    if top_emotions:
        insights.append(
            {
                "type": "info",
                "title": "Top Emotional Pattern",
                "message": f"Your most frequent recent emotion is '{top_emotions[0]}'.",
            }
        )

    if tone_counts.get("supportive", 0) >= 3:
        insights.append(
            {
                "type": "positive",
                "title": "Supportive Communication",
                "message": "You have recently used a supportive tone in several entries.",
            }
        )

    toxicity_points = toxicity_timeline(db, user_id, days)

    return {
        "summary": summary,
        "activity_counts": activity_counts,
        "snapshot": {
            "post": by_type["post"],
            "journal": by_type["journal"],
            "comment": by_type["comment"],
        },
        "toxicity_timeline": toxicity_points,
        "insights": insights,
    }