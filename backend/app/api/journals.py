from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.journal import JournalEntry
from app.schemas.journal import JournalCreate, JournalOut
from app.services.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/journals", tags=["journals"])


@router.post("", response_model=JournalOut, status_code=status.HTTP_201_CREATED)
def create_journal(payload: JournalCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    entry = JournalEntry(
        user_id=user.id,
        entry_date=payload.entry_date,
        title=payload.title,
        content=payload.content,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=list[JournalOut])
def list_my_journals(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(JournalEntry)
        .filter(JournalEntry.user_id == user.id)
        .order_by(JournalEntry.entry_date.desc())
        .limit(90)
        .all()
    )