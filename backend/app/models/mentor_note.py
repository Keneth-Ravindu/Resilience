from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class MentorNote(Base):
    __tablename__ = "mentor_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    mentor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    mentee_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    object_type: Mapped[str] = mapped_column(String(30), index=True)  # post|comment|journal
    object_id: Mapped[int] = mapped_column(Integer, index=True)

    note: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)