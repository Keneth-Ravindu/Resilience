from fastapi import APIRouter, Depends, status, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db.session import get_db
from app.schemas.journal import JournalCreate, JournalOut
from app.services.security import get_current_user
from app.models.user import User
from app.models.journal import JournalEntry
from app.models.reaction import Reaction

from app.repositories.text_analysis_repo import get_latest_analysis_for_object
from app.schemas.text_analysis import TextAnalysisOut

router = APIRouter(prefix="/journals", tags=["journals"])

def get_reaction_counts(db: Session, object_type: str, object_id: int):
    rows = (
        db.query(
            Reaction.reaction_type,
            func.count(Reaction.id)
        )
        .filter(
            Reaction.object_type == object_type,
            Reaction.object_id == object_id
        )
        .group_by(Reaction.reaction_type)
        .all()
    )

    counts = {reaction: count for reaction, count in rows}
    total = sum(counts.values())
    return counts, total


@router.post("", response_model=JournalOut, status_code=status.HTTP_201_CREATED)
def create_journal(
    payload: JournalCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    visibility = (payload.visibility or "private").strip().lower()
    if visibility not in {"private", "public"}:
        raise HTTPException(status_code=400, detail="visibility must be 'private' or 'public'")

    entry = JournalEntry(
        user_id=user.id,
        entry_date=payload.entry_date,
        title=payload.title,
        content=payload.content,
        visibility=visibility,
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Run NLP and store analysis
    try:
        from app.services.text_analysis_service import analyze_and_store_text

        analyze_and_store_text(
            db,
            user_id=user.id,
            object_type="journal",
            object_id=entry.id,
            text=entry.content,
        )

    except Exception as e:
        db.rollback()
        print(f"[WARN] NLP analysis failed for journal {entry.id}: {e}")
        
    counts, total = get_reaction_counts(db, "journal", entry.id)
    entry.reaction_counts = counts
    entry.total_reactions = total

    return entry


@router.get("", response_model=list[JournalOut])
def list_journals(
    visibility: str | None = Query(None, description="optional: private | public"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns:
    - current user's own journals (private + public)
    - other users' journals only if visibility=public
    """
    q = db.query(JournalEntry)

    requested_visibility = visibility.strip().lower() if visibility else None
    if requested_visibility and requested_visibility not in {"private", "public"}:
        raise HTTPException(status_code=400, detail="visibility must be 'private' or 'public'")

    q = q.filter(
        or_(
            JournalEntry.user_id == user.id,
            JournalEntry.visibility == "public",
        )
    )

    journals = (
        q.order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
        .limit(100)
        .all()
    )

    enriched_journals = []

    for journal in journals:
        counts, total = get_reaction_counts(db, "journal", journal.id)
        journal.reaction_counts = counts
        journal.total_reactions = total
        enriched_journals.append(journal)

    return enriched_journals


@router.get("/{journal_id}", response_model=JournalOut)
def get_journal(
    journal_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    journal = db.get(JournalEntry, journal_id)
    if not journal:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    # owner can always view, others only if public
    if journal.user_id != user.id and journal.visibility != "public":
        raise HTTPException(status_code=403, detail="Not allowed")
    
    counts, total = get_reaction_counts(db, "journal", journal.id)
    journal.reaction_counts = counts
    journal.total_reactions = total

    return journal


@router.get("/{journal_id}/analysis", response_model=TextAnalysisOut)
def get_journal_analysis(
    journal_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    journal = db.get(JournalEntry, journal_id)
    if not journal:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    # owner can always view analysis, others only if journal is public
    if journal.user_id != user.id and journal.visibility != "public":
        raise HTTPException(status_code=403, detail="Not allowed")

    analysis = get_latest_analysis_for_object(
        db,
        user_id=journal.user_id,
        object_type="journal",
        object_id=journal_id,
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this journal entry")

    return analysis