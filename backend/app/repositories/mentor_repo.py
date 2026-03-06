from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.mentorship import Mentorship
from app.models.mentor_note import MentorNote


# -------------------------
# Mentorships
# -------------------------
def create_mentorship_request(
    db: Session,
    *,
    mentor_user_id: int,
    mentee_user_id: int,
) -> Mentorship:
    ms = Mentorship(
        mentor_user_id=mentor_user_id,
        mentee_user_id=mentee_user_id,
        status="pending",
    )
    db.add(ms)
    db.commit()
    db.refresh(ms)
    return ms


def get_mentorship_by_id(db: Session, mentorship_id: int) -> Mentorship | None:
    return db.query(Mentorship).filter(Mentorship.id == mentorship_id).first()


def find_existing_mentorship(
    db: Session,
    *,
    mentor_user_id: int,
    mentee_user_id: int,
) -> Mentorship | None:
    return (
        db.query(Mentorship)
        .filter(
            Mentorship.mentor_user_id == mentor_user_id,
            Mentorship.mentee_user_id == mentee_user_id,
        )
        .first()
    )


def update_mentorship_status(
    db: Session,
    mentorship: Mentorship,
    *,
    status: str,
) -> Mentorship:
    mentorship.status = status
    db.add(mentorship)
    db.commit()
    db.refresh(mentorship)
    return mentorship


def list_my_mentorships(db: Session, *, user_id: int) -> list[Mentorship]:
    return (
        db.query(Mentorship)
        .filter(or_(Mentorship.mentor_user_id == user_id, Mentorship.mentee_user_id == user_id))
        .order_by(Mentorship.created_at.desc())
        .all()
    )


def is_accepted_mentor_of(
    db: Session,
    *,
    mentor_user_id: int,
    mentee_user_id: int,
) -> bool:
    ms = (
        db.query(Mentorship)
        .filter(
            Mentorship.mentor_user_id == mentor_user_id,
            Mentorship.mentee_user_id == mentee_user_id,
            Mentorship.status == "accepted",
        )
        .first()
    )
    return ms is not None


def get_pending_request_for_mentor(
    db: Session,
    *,
    mentor_user_id: int,
    mentee_user_id: int,
) -> Mentorship | None:
    return (
        db.query(Mentorship)
        .filter(
            Mentorship.mentor_user_id == mentor_user_id,
            Mentorship.mentee_user_id == mentee_user_id,
            Mentorship.status == "pending",
        )
        .first()
    )


# -------------------------
# Mentor Notes
# -------------------------
def create_mentor_note(
    db: Session,
    *,
    mentor_user_id: int,
    mentee_user_id: int,
    object_type: str,
    object_id: int,
    note: str,
) -> MentorNote:
    mn = MentorNote(
        mentor_user_id=mentor_user_id,
        mentee_user_id=mentee_user_id,
        object_type=object_type,
        object_id=object_id,
        note=note,
    )
    db.add(mn)
    db.commit()
    db.refresh(mn)
    return mn


def list_notes_for_object(
    db: Session,
    *,
    mentee_user_id: int,
    object_type: str,
    object_id: int,
) -> list[MentorNote]:
    return (
        db.query(MentorNote)
        .filter(
            MentorNote.mentee_user_id == mentee_user_id,
            MentorNote.object_type == object_type,
            MentorNote.object_id == object_id,
        )
        .order_by(MentorNote.created_at.asc())
        .all()
    )


# -------------------------
# Inbox + Summary + Mentees list
# -------------------------
def list_pending_requests_for_mentor(db: Session, *, mentor_user_id: int) -> list[Mentorship]:
    return (
        db.query(Mentorship)
        .filter(
            Mentorship.mentor_user_id == mentor_user_id,
            Mentorship.status == "pending",
        )
        .order_by(Mentorship.created_at.desc())
        .all()
    )


def list_accepted_mentees_for_mentor(db: Session, *, mentor_user_id: int) -> list[Mentorship]:
    """
    Used by GET /mentors/mentees
    """
    return (
        db.query(Mentorship)
        .filter(
            Mentorship.mentor_user_id == mentor_user_id,
            Mentorship.status == "accepted",
        )
        .order_by(Mentorship.created_at.desc())
        .all()
    )


def list_accepted_mentors_for_mentee(db: Session, *, mentee_user_id: int) -> list[Mentorship]:
    return (
        db.query(Mentorship)
        .filter(
            Mentorship.mentee_user_id == mentee_user_id,
            Mentorship.status == "accepted",
        )
        .order_by(Mentorship.created_at.desc())
        .all()
    )