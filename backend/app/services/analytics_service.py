from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.text_analysis import TextAnalysis


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
    # avg toxicity per day
    rows = db.execute(
        select(
            func.date_trunc("day", TextAnalysis.created_at).label("day"),
            func.avg(TextAnalysis.toxicity_score).label("value"),
        )
        .where(
            TextAnalysis.user_id == user_id,
            TextAnalysis.created_at >= func.now() - func.make_interval(days=days),
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
    rows = db.execute(
        select(TextAnalysis.created_at, TextAnalysis.emotions)
        .where(
            TextAnalysis.user_id == user_id,
            TextAnalysis.created_at >= func.now() - func.make_interval(days=days),
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