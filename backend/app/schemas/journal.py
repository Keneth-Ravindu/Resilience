from datetime import datetime, date
from pydantic import BaseModel, Field


class JournalCreate(BaseModel):
    entry_date: date | None = None
    title: str | None = None
    content: str
    visibility: str = Field(default="private")


class JournalOut(BaseModel):
    id: int
    user_id: int
    entry_date: date
    title: str | None = None
    content: str
    visibility: str
    created_at: datetime

    class Config:
        from_attributes = True