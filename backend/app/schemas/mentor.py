from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Literal


MentorshipStatus = Literal["pending", "accepted", "rejected", "ended"]


class MentorshipOut(BaseModel):
    id: int
    mentor_user_id: int
    mentee_user_id: int
    status: MentorshipStatus
    created_at: datetime

    class Config:
        from_attributes = True


class MentorshipRequestIn(BaseModel):
    mentor_user_id: int = Field(..., ge=1)


class MentorshipUpdateStatusIn(BaseModel):
    status: MentorshipStatus


class MentorNoteCreateIn(BaseModel):
    object_type: Literal["post", "journal", "comment"]
    object_id: int = Field(..., ge=1)
    note: str = Field(..., min_length=1, max_length=5000)


class MentorNoteOut(BaseModel):
    id: int
    mentor_user_id: int
    mentee_user_id: int
    object_type: str
    object_id: int
    note: str
    created_at: datetime

    class Config:
        from_attributes = True