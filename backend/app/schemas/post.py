from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional

class PostCreate(BaseModel):
    content: str
    tags: list[str] = Field(default_factory=list)


class PostOut(BaseModel):
    id: int
    user_id: int
    content: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    content: str


class CommentOut(BaseModel):
    id: int
    post_id: int
    user_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True