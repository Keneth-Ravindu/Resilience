from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime
from app.db.base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    triggered_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    type = Column(String, nullable=False)  # like, comment, message, workout

    reference_id = Column(Integer, nullable=True)  # post_id, comment_id, message_id

    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)