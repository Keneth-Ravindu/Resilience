from datetime import datetime
from pydantic import BaseModel, Field
from typing import Literal


MentorshipStatus = Literal["pending", "accepted", "rejected", "ended"]


class MentorUserSummary(BaseModel):
    id: int
    name: str
    email: str
    display_name: str | None = None
    profile_picture_url: str | None = None
    status_text: str | None = None
    age_range: str | None = None
    fitness_level: str | None = None
    role: str

    class Config:
        from_attributes = True


class MentorshipOut(BaseModel):
    id: int
    mentor_user_id: int
    mentee_user_id: int
    status: MentorshipStatus
    created_at: datetime
    mentor: MentorUserSummary | None = None
    mentee: MentorUserSummary | None = None

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