from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
import anyio
import asyncio

from app.db.session import get_db
from app.models.user import User
from app.models.friend_request import FriendRequest
from app.models.mentorship import Mentorship
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.notification import Notification
from app.schemas.chat import ConversationOut, MessageCreate, MessageOut
from app.services.security import get_current_user
from app.services.text_analysis_service import analyze_text_preview
from app.websocket.manager import manager
from app.websocket.notification_manager import notification_manager

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
    return _are_friends(db, user_a_id, user_b_id) or _are_mentor_pair(
        db, user_a_id, user_b_id
    )


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


def _get_latest_message_for_conversation(db: Session, conversation_id: int):
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .first()
    )


def _build_conversation_payload(
    db: Session,
    conversation: Conversation,
    current_user_id: int,
):
    other_user_id = (
        conversation.user_two_id
        if conversation.user_one_id == current_user_id
        else conversation.user_one_id
    )
    other_user = db.get(User, other_user_id)
    if not other_user:
        return None

    latest_message = _get_latest_message_for_conversation(db, conversation.id)

    return {
        "id": conversation.id,
        "user_one_id": conversation.user_one_id,
        "user_two_id": conversation.user_two_id,
        "created_at": conversation.created_at,
        "other_user": _user_summary(other_user),
        "latest_message_content": latest_message.content if latest_message else None,
        "latest_message_created_at": latest_message.created_at if latest_message else None,
        "latest_message_sender_id": latest_message.sender_id if latest_message else None,
    }


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

    payload = _build_conversation_payload(db, conversation, current_user.id)
    if not payload:
        raise HTTPException(status_code=404, detail="Other user not found.")

    return payload


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
        payload = _build_conversation_payload(db, conversation, current_user.id)
        if payload:
            results.append(payload)

    results.sort(
        key=lambda item: item["latest_message_created_at"] or item["created_at"],
        reverse=True,
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

    # Create notification for receiver
    notification = Notification(
        user_id=other_user_id,
        triggered_by_user_id=current_user.id,
        type="message",
        reference_id=conversation.id,
        is_read=False,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    actor = db.get(User, current_user.id)

    notification_payload = {
        "id": notification.id,
        "user_id": notification.user_id,
        "triggered_by_user_id": notification.triggered_by_user_id,
        "triggered_by_user": {
            "id": actor.id,
            "display_name": actor.display_name,
            "name": actor.name,
            "profile_picture_url": actor.profile_picture_url,
        },
        "type": notification.type,
        "reference_id": notification.reference_id,
        "is_read": notification.is_read,
        "created_at": notification.created_at.isoformat()
        if notification.created_at
        else None,
    }

    try:
        anyio.from_thread.run(
            notification_manager.send_to_user,
            other_user_id,
            notification_payload,
        )
    except Exception as err:
        print("CHAT NOTIFICATION WS ERROR:", err)

    # Broadcast new message to open chat windows
    message_payload = {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "content": message.content,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "sender": _user_summary(sender),
    }

    try:
        anyio.from_thread.run(
            manager.broadcast_to_conversation,
            conversation.id,
            {
                "type": "new_message",
                "message": message_payload,
            },
        )
    except Exception as err:
        print("CHAT MESSAGE WS ERROR:", err)

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


@router.websocket("/ws/conversations/{conversation_id}")
async def websocket_conversation(
    websocket: WebSocket,
    conversation_id: int,
):
    await manager.connect(conversation_id, websocket)

    try:
        while True:
            await websocket.receive_json()
    except WebSocketDisconnect:
        manager.disconnect(conversation_id, websocket)
    except Exception:
        manager.disconnect(conversation_id, websocket)