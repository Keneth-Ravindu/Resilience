from datetime import datetime
from pydantic import BaseModel


class NotificationUserSummary(BaseModel):
    id: int
    name: str
    display_name: str | None = None
    profile_picture_url: str | None = None

    class Config:
        from_attributes = True


class NotificationOut(BaseModel):
    id: int
    user_id: int
    triggered_by_user_id: int
    type: str
    reference_id: int | None = None
    is_read: bool
    created_at: datetime | None = None
    triggered_by_user: NotificationUserSummary | None = None

    class Config:
        from_attributes = True