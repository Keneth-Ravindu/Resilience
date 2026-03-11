from datetime import datetime
from pydantic import BaseModel


class ReactionCreate(BaseModel):
    object_type: str
    object_id: int
    reaction_type: str


class ReactionOut(BaseModel):
    id: int
    user_id: int
    object_type: str
    object_id: int
    reaction_type: str
    created_at: datetime

    class Config:
        from_attributes = True