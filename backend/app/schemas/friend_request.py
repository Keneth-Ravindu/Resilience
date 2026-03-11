from datetime import datetime
from pydantic import BaseModel


class FriendRequestOut(BaseModel):
    id: int
    requester_id: int
    receiver_id: int
    status: str
    created_at: datetime
    responded_at: datetime | None = None

    class Config:
        from_attributes = True