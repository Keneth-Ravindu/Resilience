from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional, Tuple
import time

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from scipy import stats

from app.db.session import get_db
from app.models.text_analysis import TextAnalysis
from app.services.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


# -----------------------------
# Helpers
# -----------------------------
def _date_range_days(start: date, end: date) -> List[str]:
    """Inclusive date range as ['YYYY-MM-DD', ...]"""
    out = []
    cur = start
    while cur <= end:
        out.append(str(cur))
        cur = cur + timedelta(days=1)
    return out


def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        if x is None:
            return default
        return float(x)
    except Exception:
        return default


def _normalize_object_types(object_types: Optional[List[str]]) -> List[str]:
    # default: posts + journals
    if not object_types:
        return ["post", "journal"]

    allowed = {"post", "journal", "comment"}
    cleaned = []
    for t in object_types:
        tt = (t or "").strip().lower()
        if tt in allowed:
            cleaned.append(tt)

    # if user passes garbage, fallback
    return cleaned or ["post", "journal"]


def _avg_map_for_range(
    rows: List[Tuple[datetime, Optional[dict]]],
    emotions: List[str],
) -> Dict[str, Dict[str, Dict[str, float]]]:
    """
    Builds:
    buckets[emotion][day] = {"sum": float, "count": int}
    """
    buckets: Dict[str, Dict[str, Dict[str, float]]] = {e: {} for e in emotions}

    for created_at, emo_map in rows:
        day = str(created_at.date())
        emo_map = emo_map or {}

        for emotion in emotions:
            val = _safe_float(emo_map.get(emotion, 0.0), 0.0)

            if day not in buckets[emotion]:
                buckets[emotion][day] = {"sum": 0.0, "count": 0.0}

            buckets[emotion][day]["sum"] += val
            buckets[emotion][day]["count"] += 1.0

    return buckets


def _daily_avg_series(
    buckets: Dict[str, Dict[str, Dict[str, float]]],
    start_day: date,
    end_day: date,
    fill_missing_days: bool = True,
) -> Dict[str, List[Dict[str, float]]]:
    """
    Convert buckets -> series:
    {"joy": [{"day":"2026-03-01","value":0.12}, ...], ...}
    """
    all_days = _date_range_days(start_day, end_day)
    final: Dict[str, List[Dict[str, float]]] = {}

    for emotion, day_map in buckets.items():
        points: List[Dict[str, float]] = []

        if fill_missing_days:
            for d in all_days:
                agg = day_map.get(d)
                if not agg:
                    points.append({"day": d, "value": 0.0, "has_data": False})
                else:
                    cnt = int(agg["count"])
                    avg = (agg["sum"] / cnt) if cnt > 0 else 0.0
                    points.append({"day": d, "value": float(avg), "has_data": True})
        else:
            for d, agg in sorted(day_map.items()):
                cnt = int(agg["count"])
                avg = (agg["sum"] / cnt) if cnt > 0 else 0.0
                points.append({"day": d, "value": float(avg)})

        final[emotion] = points

    return final


def _window_avg(series: List[Dict[str, float]], last_n: int) -> float:
    if not series:
        return 0.0
    tail = series[-last_n:] if last_n > 0 else series
    if not tail:
        return 0.0
    return sum(float(p["value"]) for p in tail) / float(len(tail))

def _find_data_start_day(series: Dict[str, List[Dict[str, Any]]]) -> str | None:
    """
    Returns the first day where any emotion has_data=True.
    """
    earliest: str | None = None
    for points in series.values():
        for p in points:
            if p.get("has_data") is True:
                d = p.get("day")
                if d and (earliest is None or d < earliest):
                    earliest = d
                break
    return earliest


def _count_days_with_data(series: Dict[str, List[Dict[str, Any]]]) -> int:
    """
    Counts unique days where any emotion has_data=True.
    """
    days = set()
    for points in series.values():
        for p in points:
            if p.get("has_data") is True:
                d = p.get("day")
                if d:
                    days.add(d)
    return len(days)


# ---------------------------------------------------
# SUMMARY
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
        emo_key = str(emo).lower().strip()
        emotion_freq[emo_key] = emotion_freq.get(emo_key, 0) + 1

    sorted_emotions = sorted(emotion_freq.items(), key=lambda x: x[1], reverse=True)

    return {
        "total_analyses": int(total),
        "avg_toxicity": float(avg_toxicity) if avg_toxicity is not None else None,
        "tone_counts": tone_counts,
        "top_emotions": [e[0] for e in sorted_emotions[:5]],
    }
    
@router.get("/activity/counts")
def analytics_activity_counts(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns real analyzed object counts for the current user
    within the given date range.
    """
    since_dt = datetime.utcnow() - timedelta(days=days)

    rows = (
        db.query(
            TextAnalysis.object_type,
            func.count(TextAnalysis.id).label("count"),
        )
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.created_at >= since_dt,
        )
        .group_by(TextAnalysis.object_type)
        .all()
    )

    counts = {
        "posts": 0,
        "journals": 0,
        "comments": 0,
    }

    for object_type, count in rows:
        if object_type == "post":
            counts["posts"] = int(count)
        elif object_type == "journal":
            counts["journals"] = int(count)
        elif object_type == "comment":
            counts["comments"] = int(count)

    return {
        "days": days,
        "counts": counts,
    }


# ---------------------------------------------------
# TOXICITY TIMELINE (fills missing days with 0)
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
# EMOTION TIMELINE (DAILY AVERAGE)
# Supports filtering by object_types (post/journal/comment)
# ---------------------------------------------------
@router.get("/emotions/timeline")
def emotion_timeline(
    emotions: List[str] = Query(...),
    days: int = Query(30, ge=7, le=365),
    object_types: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    types = _normalize_object_types(object_types)

    since_dt = datetime.utcnow() - timedelta(days=days)
    start_day = since_dt.date()
    end_day = datetime.utcnow().date()

    rows = (
        db.query(TextAnalysis.created_at, TextAnalysis.emotions)
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.object_type.in_(types),
            TextAnalysis.created_at >= since_dt,
            TextAnalysis.emotions.isnot(None),
        )
        .all()
    )

    buckets = _avg_map_for_range(rows, emotions)
    final_series = _daily_avg_series(buckets, start_day, end_day, fill_missing_days=True)

    data_start_day = _find_data_start_day(final_series)
    data_points = _count_days_with_data(final_series)

    return {
        "object_types": types,
        "range_days": days,
        "as_of": str(end_day),
        "data_start_day": data_start_day,  
        "data_points": data_points,        # how much real data exists
        "series": final_series,
    }


# ---------------------------------------------------
# EMOTION TRENDS (posts + journals)
# Compare recent window vs previous window
# ---------------------------------------------------
@router.get("/emotions/trends")
def emotion_trends(
    emotions: List[str] = Query(..., description="e.g. emotions=joy&emotions=sadness"),
    days: int = Query(30, ge=14, le=365),
    window: int = Query(7, ge=3, le=60),
    object_types: Optional[List[str]] = Query(None),
    include_series: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    types = _normalize_object_types(object_types)

    since_dt = datetime.utcnow() - timedelta(days=days)
    start_day = since_dt.date()
    end_day = datetime.utcnow().date()

    rows = (
        db.query(TextAnalysis.created_at, TextAnalysis.emotions)
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.object_type.in_(types),
            TextAnalysis.created_at >= since_dt,
            TextAnalysis.emotions.isnot(None),
        )
        .all()
    )

    buckets = _avg_map_for_range(rows, emotions)
    series = _daily_avg_series(buckets, start_day, end_day, fill_missing_days=True)

    # recent window = last `window` days
    # previous window = the `window` days before recent
    trends = []
    for emo in emotions:
        s = series.get(emo, [])
        if len(s) < window * 2:
            # not enough history — still compute with what we have
            recent_avg = _window_avg(s, window)
            prev_avg = _window_avg(s[:-window], window) if len(s) > window else 0.0
        else:
            recent_avg = _window_avg(s, window)
            prev_avg = _window_avg(s[-(window * 2):-window], window)

        delta = recent_avg - prev_avg
        pct = (delta / prev_avg * 100.0) if prev_avg > 1e-9 else (100.0 if delta > 0 else 0.0)

        # simple direction label
        if abs(delta) < 0.01:
            direction = "stable"
        elif delta > 0:
            direction = "up"
        else:
            direction = "down"

        trends.append(
            {
                "emotion": emo,
                "recent_avg": float(recent_avg),
                "previous_avg": float(prev_avg),
                "delta": float(delta),
                "pct_change": float(pct),
                "direction": direction,
            }
        )

    # sort by biggest absolute change (most interesting at top)
    trends.sort(key=lambda x: abs(x["delta"]), reverse=True)

    resp: Dict[str, Any] = {
        "object_types": types,
        "range_days": days,
        "window_days": window,
        "as_of": str(end_day),
        "trends": trends,
    }

    if include_series:
        resp["series"] = series

    return resp

# ---------------------------------------------------
# MOOD DASHBOARD 
# ---------------------------------------------------
@router.get("/mood/dashboard")
def mood_dashboard(
    days: int = Query(30, ge=14, le=365),
    window: int = Query(7, ge=3, le=60),
    object_types: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    UI-friendly dashboard:
    - rising/falling emotions (recent window vs previous window)
    - distribution of primary emotions
    - distribution of tone
    """
    types = _normalize_object_types(object_types)

    since_dt = datetime.utcnow() - timedelta(days=days)
    start_day = since_dt.date()
    end_day = datetime.utcnow().date()

    # ---------------------------
    # 1) Get all analyses in range
    # ---------------------------
    rows = (
        db.query(TextAnalysis.created_at, TextAnalysis.emotions, TextAnalysis.primary_emotion, TextAnalysis.tone)
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.object_type.in_(types),
            TextAnalysis.created_at >= since_dt,
        )
        .all()
    )

    # ---------------------------
    # 2) Collect emotion keys seen
    # ---------------------------
    all_emotions_set = set()
    for _, emo_map, _, _ in rows:
        if isinstance(emo_map, dict):
            all_emotions_set.update([str(k) for k in emo_map.keys()])

    # If nothing exists yet, return empty dashboard
    if not all_emotions_set:
        return {
            "object_types": types,
            "range_days": days,
            "window_days": window,
            "as_of": str(end_day),
            "top_rising_emotions": [],
            "top_falling_emotions": [],
            "primary_emotion_distribution": [],
            "tone_distribution": [],
        }

    emotions = sorted(list(all_emotions_set))

    # ---------------------------
    # 3) Build daily-average series
    # ---------------------------
    rows_for_series = [(r[0], r[1]) for r in rows if r[1] is not None]
    buckets = _avg_map_for_range(rows_for_series, emotions)
    series = _daily_avg_series(buckets, start_day, end_day, fill_missing_days=True)

    # ---------------------------
    # 4) Compute trends
    # ---------------------------
    trend_rows = []
    for emo in emotions:
        s = series.get(emo, [])
        if not s:
            continue

        # recent = last window, previous = window before that
        if len(s) < window * 2:
            recent_avg = _window_avg(s, window)
            prev_avg = _window_avg(s[:-window], window) if len(s) > window else 0.0
        else:
            recent_avg = _window_avg(s, window)
            prev_avg = _window_avg(s[-(window * 2):-window], window)

        delta = recent_avg - prev_avg

        trend_rows.append(
            {
                "emotion": emo,
                "recent_avg": float(recent_avg),
                "previous_avg": float(prev_avg),
                "delta": float(delta),
            }
        )

    # Sort by change
    trend_rows.sort(key=lambda x: x["delta"], reverse=True)

    top_rising = [t for t in trend_rows if t["delta"] > 0][:5]
    top_falling = sorted([t for t in trend_rows if t["delta"] < 0], key=lambda x: x["delta"])[:5]

    # ---------------------------
    # 5) Primary emotion distribution (pie chart)
    # ---------------------------
    primary_counts: Dict[str, int] = {}
    for _, _, primary, _ in rows:
        if not primary:
            continue
        k = str(primary).strip().lower()
        primary_counts[k] = primary_counts.get(k, 0) + 1

    primary_dist = [
        {"label": k, "value": int(v)}
        for k, v in sorted(primary_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    # ---------------------------
    # 6) Tone distribution (optional but useful)
    # ---------------------------
    tone_counts: Dict[str, int] = {}
    for _, _, _, tone in rows:
        key = (tone or "unknown").strip().lower()
        tone_counts[key] = tone_counts.get(key, 0) + 1

    tone_dist = [
        {"label": k, "value": int(v)}
        for k, v in sorted(tone_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "object_types": types,
        "range_days": days,
        "window_days": window,
        "as_of": str(end_day),
        "top_rising_emotions": top_rising,
        "top_falling_emotions": top_falling,
        "primary_emotion_distribution": primary_dist,
        "tone_distribution": tone_dist,
    }

# ---------------------------------------------------
# 🧠 MOOD DASHBOARD (separate for post vs journal)
# ---------------------------------------------------
@router.get("/mood/dashboard/by-type")
def mood_dashboard_by_type(
    days: int = Query(30, ge=14, le=365),
    window: int = Query(7, ge=3, le=60),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns the same dashboard data, split by object type:
      - post
      - journal
    """

    end_day = datetime.utcnow().date()

    def _build_for(types: List[str]) -> Dict[str, Any]:
        # Reuse your existing dashboard logic by calling the same helpers.
        since_dt = datetime.utcnow() - timedelta(days=days)
        start_day = since_dt.date()

        rows = (
            db.query(
                TextAnalysis.created_at,
                TextAnalysis.emotions,
                TextAnalysis.primary_emotion,
                TextAnalysis.tone,
            )
            .filter(
                TextAnalysis.user_id == user.id,
                TextAnalysis.object_type.in_(types),
                TextAnalysis.created_at >= since_dt,
            )
            .all()
        )

        # Collect all emotion keys seen
        all_emotions_set = set()
        for _, emo_map, _, _ in rows:
            if isinstance(emo_map, dict):
                all_emotions_set.update([str(k) for k in emo_map.keys()])

        if not all_emotions_set:
            return {
                "object_types": types,
                "range_days": days,
                "window_days": window,
                "as_of": str(end_day),
                "top_rising_emotions": [],
                "top_falling_emotions": [],
                "primary_emotion_distribution": [],
                "tone_distribution": [],
            }

        emotions = sorted(list(all_emotions_set))

        # Daily averages series
        rows_for_series = [(r[0], r[1]) for r in rows if r[1] is not None]
        buckets = _avg_map_for_range(rows_for_series, emotions)
        series = _daily_avg_series(
            buckets,
            start_day,
            end_day,
            fill_missing_days=True,
        )

        # Trends
        trend_rows = []
        for emo in emotions:
            s = series.get(emo, [])
            if not s:
                continue

            # recent = last window, previous = window before that
            if len(s) < window * 2:
                recent_avg = _window_avg(s, window)
                prev_avg = _window_avg(s[:-window], window) if len(s) > window else 0.0
            else:
                recent_avg = _window_avg(s, window)
                prev_avg = _window_avg(s[-(window * 2):-window], window)

            delta = recent_avg - prev_avg

            trend_rows.append(
                {
                    "emotion": emo,
                    "recent_avg": float(recent_avg),
                    "previous_avg": float(prev_avg),
                    "delta": float(delta),
                }
            )

        trend_rows.sort(key=lambda x: x["delta"], reverse=True)
        top_rising = [t for t in trend_rows if t["delta"] > 0][:5]
        top_falling = sorted([t for t in trend_rows if t["delta"] < 0], key=lambda x: x["delta"])[:5]

        # Primary emotion distribution
        primary_counts: Dict[str, int] = {}
        for _, _, primary, _ in rows:
            if not primary:
                continue
            k = str(primary).strip().lower()
            primary_counts[k] = primary_counts.get(k, 0) + 1

        primary_dist = [
            {"label": k, "value": int(v)}
            for k, v in sorted(primary_counts.items(), key=lambda x: x[1], reverse=True)
        ]

        # Tone distribution
        tone_counts: Dict[str, int] = {}
        for _, _, _, tone in rows:
            key = (tone or "unknown").strip().lower()
            tone_counts[key] = tone_counts.get(key, 0) + 1

        tone_dist = [
            {"label": k, "value": int(v)}
            for k, v in sorted(tone_counts.items(), key=lambda x: x[1], reverse=True)
        ]

        return {
            "object_types": types,
            "range_days": days,
            "window_days": window,
            "as_of": str(end_day),
            "top_rising_emotions": top_rising,
            "top_falling_emotions": top_falling,
            "primary_emotion_distribution": primary_dist,
            "tone_distribution": tone_dist,
        }

    return {
        "as_of": str(end_day),
        "range_days": days,
        "window_days": window,
        "by_type": {
            "post": _build_for(["post"]),
            "journal": _build_for(["journal"]),
        },
    }
    
@router.get("/emotions/timeline/by-type")
def emotion_timeline_by_type(
    emotions: List[str] = Query(...),
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Same as /emotions/timeline but split into:
    - post
    - journal
    """
    since_dt = datetime.utcnow() - timedelta(days=days)
    start_day = since_dt.date()
    end_day = datetime.utcnow().date()

    def _build_for(object_type: str) -> Dict[str, Any]:
        rows = (
            db.query(TextAnalysis.created_at, TextAnalysis.emotions)
            .filter(
                TextAnalysis.user_id == user.id,
                TextAnalysis.object_type == object_type,
                TextAnalysis.created_at >= since_dt,
                TextAnalysis.emotions.isnot(None),
            )
            .all()
        )

        buckets = _avg_map_for_range(rows, emotions)
        series = _daily_avg_series(buckets, start_day, end_day, fill_missing_days=True)

        data_start_day = _find_data_start_day(series)
        data_points = _count_days_with_data(series)

        return {
            "object_types": [object_type],
            "range_days": days,
            "as_of": str(end_day),
            "data_start_day": data_start_day,
            "data_points": data_points,
            "series": series,
        }

    return {
        "as_of": str(end_day),
        "range_days": days,
        "by_type": {
            "post": _build_for("post"),
            "journal": _build_for("journal"),
        },
    }
    
def _top_emotions_from_series_for_range(
    series: Dict[str, List[Dict[str, Any]]],
    start_day: str,
    end_day: str,
    k: int = 3,
) -> List[Dict[str, float]]:
    """
    Returns top-k emotions by average value within [start_day, end_day].
    """
    out = []
    for emo, points in series.items():
        vals = [float(p["value"]) for p in points if start_day <= p["day"] <= end_day and p.get("has_data")]
        if not vals:
            continue
        out.append({"emotion": emo, "avg": sum(vals) / len(vals)})
    out.sort(key=lambda x: x["avg"], reverse=True)
    return out[:k]


def _trend_for_emotion(series_points: List[Dict[str, Any]], window: int = 7) -> str:
    """
    Compare last `window` days vs previous `window` days (only days with has_data=True).
    """
    vals = [float(p["value"]) for p in series_points if p.get("has_data")]
    if len(vals) < 2:
        return "stable"

    recent = vals[-window:]
    prev = vals[-(window * 2):-window] if len(vals) >= window * 2 else []

    recent_avg = sum(recent) / len(recent) if recent else 0.0
    prev_avg = sum(prev) / len(prev) if prev else 0.0

    delta = recent_avg - prev_avg
    if abs(delta) < 0.01:
        return "stable"
    return "up" if delta > 0 else "down"


@router.get("/emotions/headlines/by-type")
def emotions_headlines_by_type(
    emotions: List[str] = Query(...),
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    UI-friendly emotion headlines per type:
      - top emotions today
      - top emotions this week
      - dominant primary emotion this week
      - trend direction per tracked emotion
    """
    since_dt = datetime.utcnow() - timedelta(days=days)
    end_day = datetime.utcnow().date()
    today_str = str(end_day)
    week_start_str = str(end_day - timedelta(days=6))  # last 7 days inclusive

    def _build_for(object_type: str) -> Dict[str, Any]:
        rows = (
            db.query(
                TextAnalysis.created_at,
                TextAnalysis.emotions,
                TextAnalysis.primary_emotion,
            )
            .filter(
                TextAnalysis.user_id == user.id,
                TextAnalysis.object_type == object_type,
                TextAnalysis.created_at >= since_dt,
            )
            .all()
        )

        # Build series (daily avg)
        rows_for_series = [(r[0], r[1]) for r in rows if r[1] is not None]
        buckets = _avg_map_for_range(rows_for_series, emotions)
        series = _daily_avg_series(buckets, since_dt.date(), end_day, fill_missing_days=True)

        # Top emotions today & this week
        top_today = _top_emotions_from_series_for_range(series, today_str, today_str, k=3)
        top_week = _top_emotions_from_series_for_range(series, week_start_str, today_str, k=5)

        # Dominant primary emotion this week
        primary_counts: Dict[str, int] = {}
        for created_at, _, primary in rows:
            if not primary:
                continue
            day = str(created_at.date())
            if week_start_str <= day <= today_str:
                k = str(primary).strip().lower()
                primary_counts[k] = primary_counts.get(k, 0) + 1

        dominant_primary = None
        if primary_counts:
            dominant_primary = sorted(primary_counts.items(), key=lambda x: x[1], reverse=True)[0][0]

        # Trend direction per emotion
        trends = {}
        for emo in emotions:
            trends[emo] = _trend_for_emotion(series.get(emo, []), window=7)

        return {
            "object_type": object_type,
            "as_of": today_str,
            "top_today": top_today,
            "top_week": top_week,
            "dominant_primary_emotion_week": dominant_primary,
            "trends": trends,
        }

    return {
        "as_of": today_str,
        "range_days": days,
        "by_type": {
            "post": _build_for("post"),
            "journal": _build_for("journal"),
        },
    }

@router.get("/emotions/series/compact/by-type")
def emotions_series_compact_by_type(
    emotions: List[str] = Query(...),
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Compact chart series:
    - only returns days where has_data=True
    - split by object type (post vs journal)
    """
    since_dt = datetime.utcnow() - timedelta(days=days)
    end_day = datetime.utcnow().date()
    end_day_str = str(end_day)

    def _build_for(object_type: str) -> Dict[str, Any]:
        rows = (
            db.query(TextAnalysis.created_at, TextAnalysis.emotions)
            .filter(
                TextAnalysis.user_id == user.id,
                TextAnalysis.object_type == object_type,
                TextAnalysis.created_at >= since_dt,
                TextAnalysis.emotions.isnot(None),
            )
            .all()
        )

        # If no rows → empty
        if not rows:
            return {
                "object_type": object_type,
                "range_days": days,
                "as_of": end_day_str,
                "data_start_day": None,
                "data_points": 0,
                "series": {e: [] for e in emotions},
            }

        # Build normal filled series first
        buckets = _avg_map_for_range(rows, emotions)
        full_series = _daily_avg_series(buckets, since_dt.date(), end_day, fill_missing_days=True)

        # Compact: keep only has_data=True
        compact_series: Dict[str, List[Dict[str, Any]]] = {}
        for emo, points in full_series.items():
            compact_series[emo] = [p for p in points if p.get("has_data")]

        # data_start_day + data_points
        any_points = next(iter(compact_series.values()), [])
        data_start_day = any_points[0]["day"] if any_points else None
        data_points = len(any_points) if any_points else 0

        return {
            "object_type": object_type,
            "range_days": days,
            "as_of": end_day_str,
            "data_start_day": data_start_day,
            "data_points": data_points,
            "series": compact_series,
        }

    return {
        "as_of": end_day_str,
        "range_days": days,
        "by_type": {
            "post": _build_for("post"),
            "journal": _build_for("journal"),
        },
    }
    
@router.get("/mood/dashboard/bundle/by-type")
def mood_dashboard_bundle_by_type(
    emotions: List[str] = Query(...),
    days: int = Query(30, ge=7, le=365),
    window: int = Query(7, ge=3, le=60),
    top_n: int = Query(3, ge=1, le=10),
    include_series: bool = Query(False),
    debug: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    import time

    t0 = time.perf_counter()

    since_dt = datetime.utcnow() - timedelta(days=days)
    start_day = since_dt.date()
    end_day = datetime.utcnow().date()
    end_day_str = str(end_day)

    trend_since_dt = datetime.utcnow() - timedelta(days=max(days, window * 2))

    def _top_n_rows(avg_map: Dict[str, float], n: int) -> list[Dict[str, float]]:
        pairs = [{"emotion": k, "avg": float(v)} for k, v in avg_map.items()]
        pairs.sort(key=lambda x: x["avg"], reverse=True)
        return pairs[:n]

    def _dominant_primary_in_window(rows, window_days: int) -> str | None:
        since_week = datetime.utcnow() - timedelta(days=window_days)
        counts: Dict[str, int] = {}
        for created_at, _, primary in rows:
            if created_at < since_week:
                continue
            if not primary:
                continue
            k = str(primary).strip().lower()
            counts[k] = counts.get(k, 0) + 1
        if not counts:
            return None
        return sorted(counts.items(), key=lambda x: x[1], reverse=True)[0][0]

    def _avg_for_day_from_rows(rows, day: date) -> Dict[str, float]:
        sums = {e: 0.0 for e in emotions}
        cnt = 0.0

        for created_at, emo_map, _ in rows:
            if created_at.date() != day:
                continue
            if not isinstance(emo_map, dict):
                continue
            for e in emotions:
                sums[e] += _safe_float(emo_map.get(e, 0.0), 0.0)
            cnt += 1.0

        if cnt <= 0:
            return {e: 0.0 for e in emotions}
        return {e: float(sums[e] / cnt) for e in emotions}

    def _avg_for_last_n_days_from_compact_series(
        series: Dict[str, list[Dict[str, Any]]], n: int
    ) -> Dict[str, float]:
        last_days = _date_range_days(end_day - timedelta(days=n - 1), end_day)
        out: Dict[str, float] = {}

        for emo in emotions:
            pts = series.get(emo, [])
            day_map = {p["day"]: float(p["value"]) for p in pts}
            vals = [day_map.get(d, 0.0) for d in last_days]
            out[emo] = sum(vals) / float(len(vals)) if vals else 0.0

        return out

    def _trend_direction_from_compact(series_points: list[Dict[str, Any]]) -> str:
        day_map = {p["day"]: float(p["value"]) for p in series_points}

        prev_days = _date_range_days(
            end_day - timedelta(days=window * 2 - 1),
            end_day - timedelta(days=window),
        )
        recent_days = _date_range_days(end_day - timedelta(days=window - 1), end_day)

        prev_vals = [day_map.get(d, 0.0) for d in prev_days]
        recent_vals = [day_map.get(d, 0.0) for d in recent_days]

        prev_avg = (sum(prev_vals) / float(len(prev_vals))) if prev_vals else 0.0
        recent_avg = (sum(recent_vals) / float(len(recent_vals))) if recent_vals else 0.0

        delta = recent_avg - prev_avg
        if abs(delta) < 0.01:
            return "stable"
        return "up" if delta > 0 else "down"

    meta: Dict[str, Any] = {
        "as_of": end_day_str,
        "range_days": days,
        "window_days": window,
        "top_n": top_n,
        "db_rows": {},
        "timing_ms": {},
    }

    def _build_for(object_type: str) -> Dict[str, Any]:
        tq0 = time.perf_counter()

        rows = (
            db.query(TextAnalysis.created_at, TextAnalysis.emotions, TextAnalysis.primary_emotion)
            .filter(
                TextAnalysis.user_id == user.id,
                TextAnalysis.object_type == object_type,
                TextAnalysis.created_at >= trend_since_dt,
                TextAnalysis.emotions.isnot(None),
            )
            .all()
        )

        tq1 = time.perf_counter()
        meta["db_rows"][object_type] = len(rows)
        meta["timing_ms"][f"db_query_{object_type}"] = round((tq1 - tq0) * 1000.0, 2)

        base_payload: Dict[str, Any] = {
            "object_type": object_type,
            "as_of": end_day_str,
            "top_today": [],
            "top_week": [],
            "dominant_primary_emotion_week": None,
            "trends": {e: "stable" for e in emotions},
        }

        if not rows:
            if include_series:
                base_payload["series"] = {e: [] for e in emotions}
            return base_payload

        rows_in_range = [(c, m) for (c, m, _) in rows if c >= since_dt]
        buckets = _avg_map_for_range(rows_in_range, emotions)
        full_series = _daily_avg_series(buckets, start_day, end_day, fill_missing_days=True)

        compact: Dict[str, list[Dict[str, Any]]] = {}
        for emo, pts in full_series.items():
            compact[emo] = [p for p in pts if p.get("has_data")]

        today_avg = _avg_for_day_from_rows(rows, end_day)
        week_avg = _avg_for_last_n_days_from_compact_series(compact, window)
        dominant_primary = _dominant_primary_in_window(rows, window)
        trends = {emo: _trend_direction_from_compact(compact.get(emo, [])) for emo in emotions}

        base_payload.update(
            {
                "top_today": _top_n_rows(today_avg, top_n),
                "top_week": _top_n_rows(week_avg, top_n),
                "dominant_primary_emotion_week": dominant_primary,
                "trends": trends,
            }
        )

        if include_series:
            base_payload["series"] = compact

        return base_payload

    by_type = {
        "post": _build_for("post"),
        "journal": _build_for("journal"),
        "comment": _build_for("comment"),
    }

    t1 = time.perf_counter()
    meta["timing_ms"]["total"] = round((t1 - t0) * 1000.0, 2)

    resp: Dict[str, Any] = {
        "as_of": end_day_str,
        "range_days": days,
        "window_days": window,
        "top_n": top_n,
        "by_type": by_type,
    }

    if debug:
        resp["meta"] = meta

    return resp

# ---------------------------------------------------
# STATS: Correlations (emotion vs toxicity_score)
# ---------------------------------------------------
@router.get("/stats/correlations")
def stats_correlations(
    emotions: List[str] = Query(..., description="e.g. emotions=joy&emotions=anger"),
    days: int = Query(30, ge=7, le=365),
    object_types: Optional[List[str]] = Query(None),
    rounding: int = Query(6, ge=0, le=12),
    debug: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Computes correlation between each emotion score and toxicity_score.

    Returns for each emotion:
      - pearson_r, pearson_p
      - spearman_r, spearman_p
      - n (paired samples used)
    """
    t0 = time.perf_counter()

    types = _normalize_object_types(object_types)
    since_dt = datetime.utcnow() - timedelta(days=days)

    rows = (
        db.query(TextAnalysis.emotions, TextAnalysis.toxicity_score)
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.object_type.in_(types),
            TextAnalysis.created_at >= since_dt,
            TextAnalysis.emotions.isnot(None),
            TextAnalysis.toxicity_score.isnot(None),
        )
        .all()
    )

    def _maybe_float(x: Any) -> float | None:
        try:
            if x is None:
                return None
            return float(x)
        except Exception:
            return None

    def _r(v: float | None) -> float | None:
        return None if v is None else round(float(v), rounding)

    correlations = []
    n_total_valid = 0

    for emo_map, tox in rows:
        if isinstance(emo_map, dict) and _maybe_float(tox) is not None:
            n_total_valid += 1

    for emo in emotions:
        x_vals: List[float] = []
        y_vals: List[float] = []

        for emo_map, tox in rows:
            if not isinstance(emo_map, dict):
                continue

            tox_f = _maybe_float(tox)
            if tox_f is None:
                continue

            emo_f = _maybe_float(emo_map.get(emo))
            if emo_f is None:
                continue

            x_vals.append(emo_f)
            y_vals.append(tox_f)

        n = len(x_vals)

        if n < 3 or len(set(x_vals)) < 2 or len(set(y_vals)) < 2:
            correlations.append(
                {
                    "emotion": emo,
                    "vs": "toxicity_score",
                    "pearson_r": None,
                    "pearson_p": None,
                    "spearman_r": None,
                    "spearman_p": None,
                    "n": n,
                }
            )
            continue

        pearson_r, pearson_p = stats.pearsonr(x_vals, y_vals)
        spearman_r, spearman_p = stats.spearmanr(x_vals, y_vals)

        correlations.append(
            {
                "emotion": emo,
                "vs": "toxicity_score",
                "pearson_r": _r(pearson_r),
                "pearson_p": _r(pearson_p),
                "spearman_r": _r(spearman_r),
                "spearman_p": _r(spearman_p),
                "n": n,
            }
        )

    resp: Dict[str, Any] = {
        "object_types": types,
        "days": days,
        "rounding": rounding,
        "n_total": int(n_total_valid),
        "correlations": correlations,
    }

    if debug:
        t1 = time.perf_counter()
        resp["meta"] = {
            "rows_scanned": len(rows),
            "filters": {
                "object_types": types,
                "days": days,
                "since_dt": since_dt.isoformat(),
            },
            "timing_ms": {
                "total": round((t1 - t0) * 1000.0, 2),
            },
        }

    return resp


@router.get("/stats/correlations/by-type")
def stats_correlations_by_type(
    emotions: List[str] = Query(..., description="e.g. emotions=joy&emotions=anger"),
    days: int = Query(30, ge=7, le=365),
    rounding: int = Query(6, ge=0, le=12),
    debug: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Same as /stats/correlations but split into:
    - post
    - journal
    - comment
    """
    end_ts = datetime.utcnow()

    def _maybe_float(x: Any) -> float | None:
        try:
            if x is None:
                return None
            return float(x)
        except Exception:
            return None

    def _r(v: float | None) -> float | None:
        return None if v is None else round(float(v), rounding)

    def _build_for(object_type: str) -> Dict[str, Any]:
        t0 = time.perf_counter()
        since_dt = end_ts - timedelta(days=days)

        rows = (
            db.query(TextAnalysis.emotions, TextAnalysis.toxicity_score)
            .filter(
                TextAnalysis.user_id == user.id,
                TextAnalysis.object_type == object_type,
                TextAnalysis.created_at >= since_dt,
                TextAnalysis.emotions.isnot(None),
                TextAnalysis.toxicity_score.isnot(None),
            )
            .all()
        )

        correlations = []
        n_total_valid = 0

        for emo_map, tox in rows:
            if isinstance(emo_map, dict) and _maybe_float(tox) is not None:
                n_total_valid += 1

        for emo in emotions:
            x_vals: List[float] = []
            y_vals: List[float] = []

            for emo_map, tox in rows:
                if not isinstance(emo_map, dict):
                    continue

                tox_f = _maybe_float(tox)
                if tox_f is None:
                    continue

                emo_f = _maybe_float(emo_map.get(emo))
                if emo_f is None:
                    continue

                x_vals.append(emo_f)
                y_vals.append(tox_f)

            n = len(x_vals)

            if n < 3 or len(set(x_vals)) < 2 or len(set(y_vals)) < 2:
                correlations.append(
                    {
                        "emotion": emo,
                        "vs": "toxicity_score",
                        "pearson_r": None,
                        "pearson_p": None,
                        "spearman_r": None,
                        "spearman_p": None,
                        "n": n,
                    }
                )
                continue

            pearson_r, pearson_p = stats.pearsonr(x_vals, y_vals)
            spearman_r, spearman_p = stats.spearmanr(x_vals, y_vals)

            correlations.append(
                {
                    "emotion": emo,
                    "vs": "toxicity_score",
                    "pearson_r": _r(pearson_r),
                    "pearson_p": _r(pearson_p),
                    "spearman_r": _r(spearman_r),
                    "spearman_p": _r(spearman_p),
                    "n": n,
                }
            )

        payload: Dict[str, Any] = {
            "object_type": object_type,
            "days": days,
            "rounding": rounding,
            "n_total": int(n_total_valid),
            "correlations": correlations,
        }

        if debug:
            t1 = time.perf_counter()
            payload["meta"] = {
                "rows_scanned": len(rows),
                "filters": {
                    "object_type": object_type,
                    "days": days,
                    "since_dt": since_dt.isoformat(),
                },
                "timing_ms": {"total": round((t1 - t0) * 1000.0, 2)},
            }

        return payload

    return {
        "days": days,
        "rounding": rounding,
        "by_type": {
            "post": _build_for("post"),
            "journal": _build_for("journal"),
            "comment": _build_for("comment"),
        },
    }
    
# ---------------------------------------------------
# STATS: Emotion ↔ Emotion Correlation Matrix
# ---------------------------------------------------
@router.get("/stats/emotions/correlation-matrix")
def stats_emotion_correlation_matrix(
    emotions: List[str] = Query(...),
    days: int = Query(30, ge=7, le=365),
    object_types: Optional[List[str]] = Query(None),
    method: str = Query("spearman"),
    rounding: int = Query(6, ge=0, le=12),
    min_n: int = Query(10, ge=3, le=200),
    debug: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    t0 = time.perf_counter()

    types = _normalize_object_types(object_types)
    since_dt = datetime.utcnow() - timedelta(days=days)

    m = method.lower().strip()
    if m not in {"spearman", "pearson"}:
        m = "spearman"

    def _maybe_float(x: Any):
        try:
            return float(x) if x is not None else None
        except:
            return None

    def _r(v):
        return None if v is None else round(float(v), rounding)

    rows = (
        db.query(TextAnalysis.emotions)
        .filter(
            TextAnalysis.user_id == user.id,
            TextAnalysis.object_type.in_(types),
            TextAnalysis.created_at >= since_dt,
            TextAnalysis.emotions.isnot(None),
        )
        .all()
    )

    dataset = []

    for (emo_map,) in rows:
        if not isinstance(emo_map, dict):
            continue

        vec = []
        ok = True

        for emo in emotions:
            val = _maybe_float(emo_map.get(emo))
            if val is None:
                ok = False
                break
            vec.append(val)

        if ok:
            dataset.append(vec)

    n = len(dataset)
    k = len(emotions)

    r_matrix = [[1.0 if i == j else None for j in range(k)] for i in range(k)]
    p_matrix = [[0.0 if i == j else None for j in range(k)] for i in range(k)]

    if n >= min_n and k > 0:

        cols = [[] for _ in range(k)]

        for vec in dataset:
            for i in range(k):
                cols[i].append(vec[i])

        for i in range(k):
            for j in range(k):

                if i == j:
                    continue

                if len(set(cols[i])) < 2 or len(set(cols[j])) < 2:
                    continue

                if m == "pearson":
                    r_val, p_val = stats.pearsonr(cols[i], cols[j])
                else:
                    r_val, p_val = stats.spearmanr(cols[i], cols[j])

                r_matrix[i][j] = _r(r_val)
                p_matrix[i][j] = _r(p_val)

    resp = {
        "object_types": types,
        "days": days,
        "method": m,
        "rounding": rounding,
        "min_n": min_n,
        "emotions": emotions,
        "n": n,
        "r_matrix": r_matrix,
        "p_matrix": p_matrix,
    }

    if debug:
        t1 = time.perf_counter()

        resp["meta"] = {
            "rows_scanned": len(rows),
            "rows_used": n,
            "filters": {
                "object_types": types,
                "days": days,
                "since_dt": since_dt.isoformat(),
            },
            "timing_ms": {
                "total": round((t1 - t0) * 1000, 2)
            },
        }

    return resp

# ---------------------------------------------------
# STATS: Emotion ↔ Emotion Correlation Matrix (by-type + p-values)
# ---------------------------------------------------
@router.get("/stats/emotions/correlation-matrix/by-type")
def stats_emotion_correlation_matrix_by_type(
    emotions: List[str] = Query(...),
    days: int = Query(30, ge=7, le=365),
    method: str = Query("spearman"),
    rounding: int = Query(6, ge=0, le=12),
    min_n: int = Query(10, ge=3, le=200),
    debug: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    end_ts = datetime.utcnow()

    m = method.lower().strip()
    if m not in {"spearman", "pearson"}:
        m = "spearman"

    def _maybe_float(x):
        try:
            return float(x) if x is not None else None
        except:
            return None

    def _r(v):
        return None if v is None else round(float(v), rounding)

    def _build_for(object_type: str):

        t0 = time.perf_counter()
        since_dt = end_ts - timedelta(days=days)

        rows = (
            db.query(TextAnalysis.emotions)
            .filter(
                TextAnalysis.user_id == user.id,
                TextAnalysis.object_type == object_type,
                TextAnalysis.created_at >= since_dt,
                TextAnalysis.emotions.isnot(None),
            )
            .all()
        )

        dataset = []

        for (emo_map,) in rows:

            if not isinstance(emo_map, dict):
                continue

            vec = []
            ok = True

            for emo in emotions:
                val = _maybe_float(emo_map.get(emo))
                if val is None:
                    ok = False
                    break
                vec.append(val)

            if ok:
                dataset.append(vec)

        n = len(dataset)
        k = len(emotions)

        r_matrix = [[1.0 if i == j else None for j in range(k)] for i in range(k)]
        p_matrix = [[0.0 if i == j else None for j in range(k)] for i in range(k)]

        if n >= min_n and k > 0:

            cols = [[] for _ in range(k)]

            for vec in dataset:
                for i in range(k):
                    cols[i].append(vec[i])

            for i in range(k):
                for j in range(k):

                    if i == j:
                        continue

                    if len(set(cols[i])) < 2 or len(set(cols[j])) < 2:
                        continue

                    if m == "pearson":
                        r_val, p_val = stats.pearsonr(cols[i], cols[j])
                    else:
                        r_val, p_val = stats.spearmanr(cols[i], cols[j])

                    r_matrix[i][j] = _r(r_val)
                    p_matrix[i][j] = _r(p_val)

        payload = {
            "object_type": object_type,
            "days": days,
            "method": m,
            "rounding": rounding,
            "min_n": min_n,
            "emotions": emotions,
            "n": n,
            "r_matrix": r_matrix,
            "p_matrix": p_matrix,
        }

        if debug:
            t1 = time.perf_counter()

            payload["meta"] = {
                "rows_scanned": len(rows),
                "rows_used": n,
                "filters": {
                    "object_type": object_type,
                    "days": days,
                    "since_dt": since_dt.isoformat(),
                },
                "timing_ms": {
                    "total": round((t1 - t0) * 1000, 2)
                },
            }

        return payload

    return {
        "days": days,
        "method": m,
        "rounding": rounding,
        "min_n": min_n,
        "by_type": {
            "post": _build_for("post"),
            "journal": _build_for("journal"),
            "comment": _build_for("comment"),
        },
    }
