from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class PostCreate(BaseModel):
    content: str
    tags: list[str] = Field(default_factory=list)
    media_url: str | None = None
    media_type: str | None = None


class PostOut(BaseModel):
    id: int
    user_id: int
    content: str
    media_url: str | None = None
    media_type: str | None = None
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