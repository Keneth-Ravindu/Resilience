from datetime import datetime, date

from sqlalchemy import DateTime, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    workout_date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    workout_type: Mapped[str] = mapped_column(String(40), nullable=False)  # strength/cardio/mobility
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    intensity: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-10
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)