from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base


class Mentorship(Base):
    __tablename__ = "mentorships"

    id = Column(Integer, primary_key=True, index=True)
    mentor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mentee_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    mentor = relationship("User", foreign_keys=[mentor_user_id])
    mentee = relationship("User", foreign_keys=[mentee_user_id])