# backend/app/api/analytics.py

from datetime import datetime, timedelta, date
from typing import List, Dict, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.models.text_analysis import TextAnalysis
from app.services.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _date_range_days(start: date, end: date) -> List[str]:
    """Inclusive date range as ['YYYY-MM-DD', ...]"""
    days = []
    cur = start
    while cur <= end:
        days.append(str(cur))
        cur = cur + timedelta(days=1)
    return days


def _normalize_emotion(e: str) -> str:
    return str(e).strip().lower()


# ---------------------------------------------------
# 📊 SUMMARY
# ---------------------------------------------------
@router.get("/summary")
def analytics_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    base = db.query(TextAnalysis).filter(TextAnalysis.user_id == user.id)

    total = base.count()

    avg_toxicity = (
        db.query(func.avg(TextAnalysis.toxicity_score))
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.toxicity_score.isnot(None),
        )
        .scalar()
    )

    raw_tones = (
        db.query(TextAnalysis.tone, func.count(TextAnalysis.id))
        .filter(TextAnalysis.user_id == user.id)
        .group_by(TextAnalysis.tone)
        .all()
    )

    tone_counts: Dict[str, int] = {}
    for tone, count in raw_tones:
        key = tone if tone else "unknown"
        tone_counts[key] = int(count)

    raw_emotions = (
        db.query(TextAnalysis.primary_emotion)
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.primary_emotion.isnot(None),
        )
        .all()
    )

    emotion_freq: Dict[str, int] = {}
    for (emo,) in raw_emotions:
        if not emo:
            continue
        emo_key = _normalize_emotion(emo)
        emotion_freq[emo_key] = emotion_freq.get(emo_key, 0) + 1

    sorted_emotions = sorted(emotion_freq.items(), key=lambda x: x[1], reverse=True)

    return {
        "total_analyses": int(total),
        "avg_toxicity": float(avg_toxicity) if avg_toxicity is not None else None,
        "tone_counts": tone_counts,
        "top_emotions": [e[0] for e in sorted_emotions[:5]],
    }


# ---------------------------------------------------
# 📈 TOXICITY TIMELINE (fills missing days with 0)
# ---------------------------------------------------
@router.get("/toxicity/timeline")
def toxicity_timeline(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    since_dt = datetime.utcnow() - timedelta(days=days)
    start_day = since_dt.date()
    end_day = datetime.utcnow().date()

    rows = (
        db.query(
            func.date(TextAnalysis.created_at).label("day"),
            func.avg(TextAnalysis.toxicity_score).label("avg_score"),
        )
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.created_at >= since_dt,
            TextAnalysis.toxicity_score.isnot(None),
        )
        .group_by(func.date(TextAnalysis.created_at))
        .order_by(func.date(TextAnalysis.created_at))
        .all()
    )

    day_map: Dict[str, float] = {str(r.day): float(r.avg_score or 0.0) for r in rows}

    points = []
    for d in _date_range_days(start_day, end_day):
        points.append({"day": d, "value": float(day_map.get(d, 0.0))})

    return {"points": points}


# ---------------------------------------------------
# 📊 EMOTION TIMELINE (DAILY AVERAGE + fills missing days)
# ---------------------------------------------------
@router.get("/emotions/timeline")
def emotion_timeline(
    emotions: List[str] = Query(...),
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    since_dt = datetime.utcnow() - timedelta(days=days)
    start_day = since_dt.date()
    end_day = datetime.utcnow().date()
    all_days = _date_range_days(start_day, end_day)

    # Normalize requested emotions (frontend might send Joy/Joy, etc.)
    requested = [_normalize_emotion(e) for e in emotions if str(e).strip()]
    if not requested:
        return {"series": {}}

    rows = (
        db.query(TextAnalysis.created_at, TextAnalysis.emotions)
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.created_at >= since_dt,
            TextAnalysis.emotions.isnot(None),
        )
        .all()
    )

    # emotion -> day -> {"sum": float, "count": int}
    buckets: Dict[str, Dict[str, Dict[str, float]]] = {e: {} for e in requested}

    for created_at, emo_map in rows:
        day = str(created_at.date())
        emo_map = emo_map or {}

        # normalize keys in stored map too (safer long-term)
        normalized_map = { _normalize_emotion(k): float(v) for k, v in emo_map.items() }

        for emotion in requested:
            value = float(normalized_map.get(emotion, 0.0))

            if day not in buckets[emotion]:
                buckets[emotion][day] = {"sum": 0.0, "count": 0}

            buckets[emotion][day]["sum"] += value
            buckets[emotion][day]["count"] += 1

    # Build final series with missing-day fill (0.0)
    final_series: Dict[str, List[Dict[str, float]]] = {}

    for emotion in requested:
        points: List[Dict[str, float]] = []
        day_map = buckets.get(emotion, {})

        for d in all_days:
            agg = day_map.get(d)
            if not agg:
                points.append({"day": d, "value": 0.0})
                continue

            count = int(agg["count"])
            avg = (agg["sum"] / count) if count > 0 else 0.0
            points.append({"day": d, "value": float(avg)})

        final_series[emotion] = points

    return {"series": final_series}