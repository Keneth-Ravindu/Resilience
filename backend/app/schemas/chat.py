from datetime import datetime
from pydantic import BaseModel


class ChatUserSummary(BaseModel):
    id: int
    name: str
    email: str
    display_name: str | None = None
    profile_picture_url: str | None = None
    role: str

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: int
    user_one_id: int
    user_two_id: int
    created_at: datetime
    other_user: ChatUserSummary
    latest_message_content: str | None = None
    latest_message_created_at: datetime | None = None
    latest_message_sender_id: int | None = None

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    created_at: datetime
    sender: ChatUserSummary

    class Config:
        from_attributes = True