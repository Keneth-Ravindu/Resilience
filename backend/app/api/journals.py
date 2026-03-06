from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.journal import JournalCreate, JournalOut
from app.services.security import get_current_user
from app.models.user import User
from app.models.journal import JournalEntry

from app.repositories.text_analysis_repo import get_latest_analysis_for_object
from app.schemas.text_analysis import TextAnalysisOut

router = APIRouter(prefix="/journals", tags=["journals"])


@router.post("", response_model=JournalOut, status_code=status.HTTP_201_CREATED)
def create_journal(
    payload: JournalCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = JournalEntry(
        user_id=user.id,
        entry_date=payload.entry_date,
        title=payload.title,
        content=payload.content,
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

    return entry


@router.get("", response_model=list[JournalOut])
def list_my_journals(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(JournalEntry)
        .filter(JournalEntry.user_id == user.id)
        .order_by(JournalEntry.entry_date.desc())
        .limit(90)
        .all()
    )


# ✅ NEW: get analysis for a journal entry
@router.get("/{journal_id}/analysis", response_model=TextAnalysisOut)
def get_journal_analysis(
    journal_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    journal = db.get(JournalEntry, journal_id)
    if not journal:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    # only owner can view
    if journal.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    analysis = get_latest_analysis_for_object(
        db,
        user_id=user.id,
        object_type="journal",
        object_id=journal_id,
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this journal entry")

    return analysis