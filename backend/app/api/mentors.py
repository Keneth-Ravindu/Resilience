from datetime import datetime, timedelta, date
from typing import Optional, List, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, aliased

from app.db.session import get_db
from app.models.user import User
from app.models.mentorship import Mentorship
from app.models.text_analysis import TextAnalysis
from app.services.security import get_current_user

from app.schemas.mentor import (
    MentorshipOut,
    MentorshipRequestIn,
    MentorNoteCreateIn,
    MentorNoteOut,
)

from app.repositories import mentor_repo


router = APIRouter(prefix="/mentors", tags=["mentors"])


# -------------------------
# Mentorship lifecycle
# -------------------------
@router.post("/request", response_model=MentorshipOut)
def request_mentor(
    payload: MentorshipRequestIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.mentor_user_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot mentor yourself.")

    existing = mentor_repo.find_existing_mentorship(
        db,
        mentor_user_id=payload.mentor_user_id,
        mentee_user_id=user.id,
    )
    if existing:
        return existing  # idempotent

    try:
        ms = mentor_repo.create_mentorship_request(
            db,
            mentor_user_id=payload.mentor_user_id,
            mentee_user_id=user.id,
        )
        return ms
    except Exception:
        raise HTTPException(status_code=400, detail="Mentorship request already exists.")


@router.post("/{mentorship_id}/accept", response_model=MentorshipOut)
def accept_mentorship(
    mentorship_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ms = mentor_repo.get_mentorship_by_id(db, mentorship_id)
    if not ms:
        raise HTTPException(status_code=404, detail="Mentorship not found.")

    if ms.mentor_user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the mentor can accept this request.")

    if ms.status != "pending":
        return ms

    return mentor_repo.update_mentorship_status(db, ms, status="accepted")


@router.post("/{mentorship_id}/reject", response_model=MentorshipOut)
def reject_mentorship(
    mentorship_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ms = mentor_repo.get_mentorship_by_id(db, mentorship_id)
    if not ms:
        raise HTTPException(status_code=404, detail="Mentorship not found.")

    if ms.mentor_user_id != user.id:
        raise HTTPException(status_code=403, detail="Only the mentor can reject this request.")

    if ms.status != "pending":
        return ms

    return mentor_repo.update_mentorship_status(db, ms, status="rejected")


@router.post("/accept", response_model=MentorshipOut)
def accept_by_mentee(
    mentee_user_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ms = mentor_repo.get_pending_request_for_mentor(
        db,
        mentor_user_id=user.id,
        mentee_user_id=mentee_user_id,
    )
    if not ms:
        raise HTTPException(status_code=404, detail="Pending mentorship request not found.")

    return mentor_repo.update_mentorship_status(db, ms, status="accepted")


@router.post("/reject", response_model=MentorshipOut)
def reject_by_mentee(
    mentee_user_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ms = mentor_repo.get_pending_request_for_mentor(
        db,
        mentor_user_id=user.id,
        mentee_user_id=mentee_user_id,
    )
    if not ms:
        raise HTTPException(status_code=404, detail="Pending mentorship request not found.")

    return mentor_repo.update_mentorship_status(db, ms, status="rejected")


@router.post("/{mentorship_id}/end", response_model=MentorshipOut)
def end_mentorship(
    mentorship_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ms = mentor_repo.get_mentorship_by_id(db, mentorship_id)
    if not ms:
        raise HTTPException(status_code=404, detail="Mentorship not found.")

    if user.id not in {ms.mentor_user_id, ms.mentee_user_id}:
        raise HTTPException(status_code=403, detail="Not allowed.")

    if ms.status == "ended":
        return ms

    return mentor_repo.update_mentorship_status(db, ms, status="ended")


@router.get("/my", response_model=List[MentorshipOut])
def my_mentorships(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return mentor_repo.list_my_mentorships(db, user_id=user.id)


# -------------------------
# Inbox + Summary
# -------------------------
@router.get("/requests/pending", response_model=List[MentorshipOut])
def pending_requests(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return mentor_repo.list_pending_requests_for_mentor(db, mentor_user_id=user.id)


@router.get("/requests/pending/detailed")
def pending_requests_detailed(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    Mentor = aliased(User)
    Mentee = aliased(User)

    rows = (
        db.query(
            Mentorship,
            Mentor.id,
            Mentor.email,
            Mentee.id,
            Mentee.email,
        )
        .join(Mentor, Mentorship.mentor_user_id == Mentor.id)
        .join(Mentee, Mentorship.mentee_user_id == Mentee.id)
        .filter(
            Mentorship.mentor_user_id == user.id,
            Mentorship.status == "pending",
        )
        .order_by(Mentorship.created_at.desc())
        .all()
    )

    out = []
    for ms, mentor_id, mentor_email, mentee_id, mentee_email in rows:
        out.append(
            {
                "id": ms.id,
                "status": ms.status,
                "created_at": ms.created_at,
                "mentor": {"id": mentor_id, "email": mentor_email},
                "mentee": {"id": mentee_id, "email": mentee_email},
            }
        )

    return out


@router.get("/summary")
def mentorship_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mentees = mentor_repo.list_accepted_mentees_for_mentor(db, mentor_user_id=user.id)
    mentors = mentor_repo.list_accepted_mentors_for_mentee(db, mentee_user_id=user.id)

    return {
        "user_id": user.id,
        "as_mentor": {
            "accepted_mentees_count": len(mentees),
            "accepted_mentees": [
                {"mentorship_id": m.id, "mentee_user_id": m.mentee_user_id, "created_at": m.created_at}
                for m in mentees
            ],
        },
        "as_mentee": {
            "accepted_mentors_count": len(mentors),
            "accepted_mentors": [
                {"mentorship_id": m.id, "mentor_user_id": m.mentor_user_id, "created_at": m.created_at}
                for m in mentors
            ],
        },
    }


# -------------------------
# Mentor Notes
# -------------------------
@router.post("/notes", response_model=MentorNoteOut)
def create_note(
    payload: MentorNoteCreateIn,
    mentee_user_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ok = mentor_repo.is_accepted_mentor_of(db, mentor_user_id=user.id, mentee_user_id=mentee_user_id)
    if not ok:
        raise HTTPException(status_code=403, detail="You are not an accepted mentor for this user.")

    note = mentor_repo.create_mentor_note(
        db,
        mentor_user_id=user.id,
        mentee_user_id=mentee_user_id,
        object_type=payload.object_type,
        object_id=payload.object_id,
        note=payload.note,
    )
    return note


@router.get("/notes", response_model=List[MentorNoteOut])
def get_notes_for_object(
    object_type: str = Query(..., description="post|journal|comment"),
    object_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return mentor_repo.list_notes_for_object(
        db,
        mentee_user_id=user.id,
        object_type=object_type,
        object_id=object_id,
    )


# -------------------------
# Phase 10 missing endpoints
# -------------------------
@router.get("/mentees", response_model=List[MentorshipOut])
def list_mentees(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Lists accepted mentorships where current user is the mentor.
    """
    return mentor_repo.list_accepted_mentees_for_mentor(db, mentor_user_id=user.id)


@router.get("/{mentee_user_id}/analytics")
def mentee_analytics(
    mentee_user_id: int,
    days: int = Query(30, ge=7, le=365),
    window: int = Query(7, ge=3, le=60),
    emotions: List[str] = Query(default=[]),
    top_n: int = Query(3, ge=1, le=10),
    include_series: bool = Query(False),
    rounding: int = Query(4, ge=0, le=12),
    debug: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Mentor-only view of a mentee's analytics (Phase 9 integration).
    Security: only allowed if current_user is accepted mentor of mentee_user_id.
    """
    ok = mentor_repo.is_accepted_mentor_of(db, mentor_user_id=user.id, mentee_user_id=mentee_user_id)
    if not ok:
        raise HTTPException(status_code=403, detail="Not allowed. You are not an accepted mentor for this user.")

    t0 = datetime.utcnow()
    end_day = datetime.utcnow().date()
    end_day_str = str(end_day)

    # We look further back so trends have enough history
    since_dt = datetime.utcnow() - timedelta(days=max(days, window * 2))
    range_since_dt = datetime.utcnow() - timedelta(days=days)
    start_day = range_since_dt.date()

    # Auto-detect emotion keys if not provided
    if not emotions:
        discovery_rows = (
            db.query(TextAnalysis.emotions)
            .filter(
                TextAnalysis.user_id == mentee_user_id,
                TextAnalysis.created_at >= since_dt,
                TextAnalysis.emotions.isnot(None),
            )
            .all()
        )
        s = set()
        for (emo_map,) in discovery_rows:
            if isinstance(emo_map, dict):
                s.update([str(k) for k in emo_map.keys()])
        emotions = sorted(list(s))

    if not emotions:
        return {
            "mentee_user_id": mentee_user_id,
            "mentor_user_id": user.id,
            "as_of": end_day_str,
            "range_days": days,
            "window_days": window,
            "top_n": top_n,
            "emotions": [],
            "by_type": {
                "post": {"object_type": "post", "as_of": end_day_str},
                "journal": {"object_type": "journal", "as_of": end_day_str},
                "comment": {"object_type": "comment", "as_of": end_day_str},
            },
        }

    # ----- local helpers (mirrors your analytics.py style) -----
    def _safe_float(x: Any, default: float = 0.0) -> float:
        try:
            if x is None:
                return default
            return float(x)
        except Exception:
            return default

    def _date_range_days(start: date, end: date) -> List[str]:
        out = []
        cur = start
        while cur <= end:
            out.append(str(cur))
            cur = cur + timedelta(days=1)
        return out

    def _avg_map_for_range(rows2, emotions2):
        buckets = {e: {} for e in emotions2}
        for created_at, emo_map in rows2:
            day = str(created_at.date())
            emo_map = emo_map or {}
            for emotion in emotions2:
                val = _safe_float(emo_map.get(emotion, 0.0), 0.0)
                if day not in buckets[emotion]:
                    buckets[emotion][day] = {"sum": 0.0, "count": 0.0}
                buckets[emotion][day]["sum"] += val
                buckets[emotion][day]["count"] += 1.0
        return buckets

    def _daily_avg_series(buckets, start_day2, end_day2):
        all_days = _date_range_days(start_day2, end_day2)
        final = {}
        for emotion, day_map in buckets.items():
            points = []
            for d in all_days:
                agg = day_map.get(d)
                if not agg:
                    points.append({"day": d, "value": 0.0, "has_data": False})
                else:
                    cnt = int(agg["count"])
                    avg = (agg["sum"] / cnt) if cnt > 0 else 0.0
                    points.append({"day": d, "value": float(avg), "has_data": True})
            final[emotion] = points
        return final

    def _top_n_rows(avg_map: Dict[str, float], n: int):
        pairs = [{"emotion": k, "avg": round(float(v), rounding)} for k, v in avg_map.items()]
        pairs.sort(key=lambda x: x["avg"], reverse=True)
        return pairs[:n]

    def _avg_for_day_from_rows(rows3, day: date) -> Dict[str, float]:
        sums = {e: 0.0 for e in emotions}
        cnt = 0.0
        for created_at, emo_map, _primary in rows3:
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

    def _avg_for_last_n_days_from_compact(series: Dict[str, List[Dict[str, Any]]], n: int) -> Dict[str, float]:
        last_days = _date_range_days(end_day - timedelta(days=n - 1), end_day)
        out: Dict[str, float] = {}
        for emo in emotions:
            pts = series.get(emo, [])
            day_map = {p["day"]: float(p["value"]) for p in pts}
            vals = [day_map.get(d, 0.0) for d in last_days]
            out[emo] = (sum(vals) / float(len(vals))) if vals else 0.0
        return out

    def _trend_direction_from_compact(series_points: List[Dict[str, Any]]) -> str:
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

    def _dominant_primary_in_window(rows3, window_days: int) -> str | None:
        since_week = datetime.utcnow() - timedelta(days=window_days)
        counts: Dict[str, int] = {}
        for created_at, _emo_map, primary in rows3:
            if created_at < since_week:
                continue
            if not primary:
                continue
            k = str(primary).strip().lower()
            counts[k] = counts.get(k, 0) + 1
        if not counts:
            return None
        return sorted(counts.items(), key=lambda x: x[1], reverse=True)[0][0]

    # ----- build per type -----
    def _build_for(object_type: str) -> Dict[str, Any]:
        rows_t = (
            db.query(TextAnalysis.created_at, TextAnalysis.emotions, TextAnalysis.primary_emotion)
            .filter(
                TextAnalysis.user_id == mentee_user_id,
                TextAnalysis.object_type == object_type,
                TextAnalysis.created_at >= since_dt,
                TextAnalysis.emotions.isnot(None),
            )
            .all()
        )

        base_payload: Dict[str, Any] = {
            "object_type": object_type,
            "as_of": end_day_str,
            "top_today": [],
            "top_week": [],
            "dominant_primary_emotion_week": None,
            "trends": {e: "stable" for e in emotions},
        }

        if not rows_t:
            if include_series:
                base_payload["series"] = {e: [] for e in emotions}
            return base_payload

        rows_in_range = [(c, m) for (c, m, _p) in rows_t if c >= range_since_dt]
        buckets = _avg_map_for_range(rows_in_range, emotions)
        full_series = _daily_avg_series(buckets, start_day, end_day)

        compact = {emo: [p for p in pts if p.get("has_data")] for emo, pts in full_series.items()}

        today_avg = _avg_for_day_from_rows(rows_t, end_day)
        week_avg = _avg_for_last_n_days_from_compact(compact, window)
        dominant_primary = _dominant_primary_in_window(rows_t, window)
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

    resp: Dict[str, Any] = {
        "mentee_user_id": mentee_user_id,
        "mentor_user_id": user.id,
        "as_of": end_day_str,
        "range_days": days,
        "window_days": window,
        "top_n": top_n,
        "emotions": emotions,
        "by_type": {
            "post": _build_for("post"),
            "journal": _build_for("journal"),
            "comment": _build_for("comment"),
        },
    }

    if debug:
        dt_ms = (datetime.utcnow() - t0).total_seconds() * 1000.0
        resp["meta"] = {
            "since_dt": since_dt.isoformat(),
            "range_since_dt": range_since_dt.isoformat(),
            "timing_ms": {"total": round(dt_ms, 2)},
        }

    return resp