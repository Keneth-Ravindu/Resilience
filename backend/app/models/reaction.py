from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Reaction(Base):
    __tablename__ = "reactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    object_type: Mapped[str] = mapped_column(
        String(20),
        index=True,
        nullable=False,
    )  # post | comment | journal

    object_id: Mapped[int] = mapped_column(
        Integer,
        index=True,
        nullable=False,
    )

    reaction_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )  # like | love | fire | strong | clap | support

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="reactions",
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "object_type",
            "object_id",
            name="uq_user_reaction_per_object",
        ),
    )