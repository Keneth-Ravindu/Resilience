from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Float, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TextAnalysis(Base):
    """
    Stores NLP outputs for posts, comments, and journal entries.
    One row per analyzed text instance.
    """
    __tablename__ = "text_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    # What was analyzed
    object_type: Mapped[str] = mapped_column(String(30), index=True)  # "post" | "comment" | "journal"
    object_id: Mapped[int] = mapped_column(Integer, index=True)

    # Raw text snapshot (audit + reproducibility)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    # Toxicity
    toxicity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    toxicity_label: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Emotions
    emotions: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {"joy":0.12,"sadness":0.62,...}
    primary_emotion: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # UI badge
    tone: Mapped[str | None] = mapped_column(String(30), nullable=True)  # supportive/neutral/harsh

    # Model versions (important for viva)
    toxicity_model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    emotion_model: Mapped[str | None] = mapped_column(String(120), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)