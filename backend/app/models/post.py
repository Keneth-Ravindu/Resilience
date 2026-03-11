from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, Text, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    media_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True
    )

    media_type: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    tags: Mapped[Optional[List[str]]] = mapped_column(
        JSON,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True
    )

    author = relationship(
        "User",
        back_populates="posts",
        foreign_keys=[user_id]
    )

    comments = relationship(
        "Comment",
        back_populates="post",
        cascade="all, delete-orphan"
    )


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.id"),
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True
    )

    post = relationship(
        "Post",
        back_populates="comments"
    )

    author = relationship(
        "User",
        back_populates="comments",
        foreign_keys=[user_id]
    )