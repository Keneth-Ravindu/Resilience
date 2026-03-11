from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    name: Mapped[str] = mapped_column(String(120), nullable=False)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Social profile fields
    display_name: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
        index=True
    )

    profile_picture_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    status_text: Mapped[str | None] = mapped_column(
        String(280),
        nullable=True
    )

    # Optional profile fields
    age_range: Mapped[str | None] = mapped_column(String(40), nullable=True)

    fitness_level: Mapped[str | None] = mapped_column(String(40), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    # Relationships
    posts = relationship(
        "Post",
        back_populates="author"
    )

    comments = relationship(
        "Comment",
        back_populates="author"
    )

    reactions = relationship(
        "Reaction",
        back_populates="user",
        cascade="all, delete-orphan"
    )