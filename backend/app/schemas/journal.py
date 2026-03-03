from datetime import datetime, date
from pydantic import BaseModel

class JournalCreate(BaseModel):
    entry_date: date | None = None
    title: str | None = None
    content: str


class JournalOut(BaseModel):
    id: int
    user_id: int
    entry_date: date
    title: str | None = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True