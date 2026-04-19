from pydantic import BaseModel
from datetime import datetime


class NotificationOut(BaseModel):
    id: int
    user_id: int
    triggered_by_user_id: int
    type: str
    reference_id: int | None = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True