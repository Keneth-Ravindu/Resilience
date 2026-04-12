from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_

from app.db.session import get_db
from app.models.user import User
from app.models.friend_request import FriendRequest
from app.models.mentorship import Mentorship
from app.models.conversation import Conversation
from app.models.message import Message
from app.schemas.chat import ConversationOut, MessageCreate, MessageOut
from app.services.security import get_current_user
from app.services.text_analysis_service import analyze_text_preview

router = APIRouter(prefix="/chat", tags=["chat"])


def _user_summary(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "display_name": user.display_name,
        "profile_picture_url": user.profile_picture_url,
        "role": user.role,
    }


def _are_friends(db: Session, user_a_id: int, user_b_id: int) -> bool:
    relation = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.status == "accepted",
            or_(
                and_(
                    FriendRequest.requester_id == user_a_id,
                    FriendRequest.receiver_id == user_b_id,
                ),
                and_(
                    FriendRequest.requester_id == user_b_id,
                    FriendRequest.receiver_id == user_a_id,
                ),
            ),
        )
        .first()
    )
    return relation is not None


def _are_mentor_pair(db: Session, user_a_id: int, user_b_id: int) -> bool:
    relation = (
        db.query(Mentorship)
        .filter(
            Mentorship.status == "accepted",
            or_(
                and_(
                    Mentorship.mentor_user_id == user_a_id,
                    Mentorship.mentee_user_id == user_b_id,
                ),
                and_(
                    Mentorship.mentor_user_id == user_b_id,
                    Mentorship.mentee_user_id == user_a_id,
                ),
            ),
        )
        .first()
    )
    return relation is not None


def _can_chat(db: Session, user_a_id: int, user_b_id: int) -> bool:
    if user_a_id == user_b_id:
        return False
    return _are_friends(db, user_a_id, user_b_id) or _are_mentor_pair(db, user_a_id, user_b_id)


def _normalized_pair(user_a_id: int, user_b_id: int) -> tuple[int, int]:
    return (min(user_a_id, user_b_id), max(user_a_id, user_b_id))


def _get_conversation_between(db: Session, user_a_id: int, user_b_id: int):
    user_one_id, user_two_id = _normalized_pair(user_a_id, user_b_id)
    return (
        db.query(Conversation)
        .filter(
            Conversation.user_one_id == user_one_id,
            Conversation.user_two_id == user_two_id,
        )
        .first()
    )


@router.post("/start/{other_user_id}", response_model=ConversationOut)
def start_or_get_conversation(
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if other_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot start a chat with yourself.")

    other_user = db.get(User, other_user_id)
    if not other_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not _can_chat(db, current_user.id, other_user_id):
        raise HTTPException(
            status_code=403,
            detail="Chat is only allowed between accepted friends or accepted mentor-mentee pairs.",
        )

    conversation = _get_conversation_between(db, current_user.id, other_user_id)

    if not conversation:
        user_one_id, user_two_id = _normalized_pair(current_user.id, other_user_id)
        conversation = Conversation(
            user_one_id=user_one_id,
            user_two_id=user_two_id,
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    return {
        "id": conversation.id,
        "user_one_id": conversation.user_one_id,
        "user_two_id": conversation.user_two_id,
        "created_at": conversation.created_at,
        "other_user": _user_summary(other_user),
    }


@router.get("/conversations", response_model=list[ConversationOut])
def list_my_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversations = (
        db.query(Conversation)
        .filter(
            or_(
                Conversation.user_one_id == current_user.id,
                Conversation.user_two_id == current_user.id,
            )
        )
        .order_by(Conversation.created_at.desc())
        .all()
    )

    results = []
    for conversation in conversations:
        other_user_id = (
            conversation.user_two_id
            if conversation.user_one_id == current_user.id
            else conversation.user_one_id
        )
        other_user = db.get(User, other_user_id)
        if not other_user:
            continue

        results.append(
            {
                "id": conversation.id,
                "user_one_id": conversation.user_one_id,
                "user_two_id": conversation.user_two_id,
                "created_at": conversation.created_at,
                "other_user": _user_summary(other_user),
            }
        )

    return results


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if current_user.id not in {conversation.user_one_id, conversation.user_two_id}:
        raise HTTPException(status_code=403, detail="Not allowed.")

    messages = (
        db.query(Message)
        .options(joinedload(Message.sender))
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    results = []
    for message in messages:
        results.append(
            {
                "id": message.id,
                "conversation_id": message.conversation_id,
                "sender_id": message.sender_id,
                "content": message.content,
                "created_at": message.created_at,
                "sender": _user_summary(message.sender),
            }
        )

    return results


@router.post("/conversations/{conversation_id}/messages")
def send_message(
    conversation_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if current_user.id not in {conversation.user_one_id, conversation.user_two_id}:
        raise HTTPException(status_code=403, detail="Not allowed.")

    other_user_id = (
        conversation.user_two_id
        if conversation.user_one_id == current_user.id
        else conversation.user_one_id
    )

    if not _can_chat(db, current_user.id, other_user_id):
        raise HTTPException(
            status_code=403,
            detail="This chat is no longer allowed because the relationship is not accepted.",
        )

    cleaned = (payload.content or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Message content is required.")

    moderation = analyze_text_preview(cleaned)

    if moderation.get("is_toxic") is True:
        return {
            "blocked": True,
            "detail": {
                "message": moderation.get("message")
                or "This message is too harsh or toxic. Please rewrite it respectfully.",
                "is_toxic": True,
                "toxicity_label": moderation.get("toxicity_label"),
                "primary_emotion": moderation.get("primary_emotion"),
                "rewrite_suggestion": moderation.get("rewrite_suggestion"),
                "rewrite_reason": moderation.get("rewrite_reason"),
            },
        }

    message = Message(
        conversation_id=conversation.id,
        sender_id=current_user.id,
        content=cleaned,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    sender = db.get(User, current_user.id)

    return {
        "blocked": False,
        "message": {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "sender_id": message.sender_id,
            "content": message.content,
            "created_at": message.created_at,
            "sender": _user_summary(sender),
        },
    }