from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class AuthorInfo(BaseModel):
    id: int
    name: str
    display_name: str | None = None
    profile_picture_url: str | None = None

    class Config:
        from_attributes = True


# ----------------------------
# Post Creation
# ----------------------------

class PostCreate(BaseModel):
    content: str
    tags: list[str] = Field(default_factory=list)
    media_url: str | None = None
    media_type: str | None = None
    used_rewrite: bool = False


# ----------------------------
# Post Response
# ----------------------------

class PostOut(BaseModel):
    id: int
    user_id: int
    content: str
    media_url: str | None = None
    media_type: str | None = None
    tags: list[str] = Field(default_factory=list)
    created_at: datetime

    author: AuthorInfo

    
    reaction_counts: dict[str, int] | None = None
    total_reactions: int | None = None
    
    workout_data: list[dict] | None = None

    class Config:
        from_attributes = True


# ----------------------------
# Comment Creation
# ----------------------------

class CommentCreate(BaseModel):
    content: str
    used_rewrite: bool = False


# ----------------------------
# Comment Response
# ----------------------------

class CommentOut(BaseModel):
    id: int
    post_id: int
    user_id: int
    content: str
    created_at: datetime

    author: AuthorInfo

    # (preparing for comment reactions later)
    reaction_counts: dict[str, int] | None = None
    total_reactions: int | None = None

    class Config:
        from_attributes = True