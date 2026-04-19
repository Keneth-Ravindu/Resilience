from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import anyio

from app.db.session import get_db
from app.models.reaction import Reaction
from app.models.post import Post, Comment
from app.models.journal import JournalEntry
from app.models.user import User
from app.models.notification import Notification
from app.schemas.reaction import ReactionCreate
from app.services.security import get_current_user
from app.websocket.notification_manager import notification_manager

router = APIRouter(prefix="/reactions", tags=["reactions"])

ALLOWED_OBJECT_TYPES = {"post", "comment", "journal"}
ALLOWED_REACTION_TYPES = {"like", "love", "fire", "strong", "clap", "support"}


def get_target(db: Session, object_type: str, object_id: int):
    if object_type == "post":
        target = db.get(Post, object_id)
    elif object_type == "comment":
        target = db.get(Comment, object_id)
    elif object_type == "journal":
        target = db.get(JournalEntry, object_id)
    else:
        target = None

    if not target:
        raise HTTPException(status_code=404, detail="Target object not found")

    return target


def get_target_owner_id(target, object_type: str) -> int | None:
    if object_type == "post":
        return target.user_id
    if object_type == "comment":
        return target.user_id
    if object_type == "journal":
        return target.user_id
    return None


@router.post("/react")
def react(
    payload: ReactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    object_type = payload.object_type.strip().lower()
    reaction_type = payload.reaction_type.strip().lower()

    if object_type not in ALLOWED_OBJECT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid object type")

    if reaction_type not in ALLOWED_REACTION_TYPES:
        raise HTTPException(status_code=400, detail="Invalid reaction type")

    target = get_target(db, object_type, payload.object_id)
    owner_id = get_target_owner_id(target, object_type)

    existing = (
        db.query(Reaction)
        .filter(
            Reaction.user_id == user.id,
            Reaction.object_type == object_type,
            Reaction.object_id == payload.object_id,
        )
        .first()
    )

    # create reaction
    if not existing:
        reaction = Reaction(
            user_id=user.id,
            object_type=object_type,
            object_id=payload.object_id,
            reaction_type=reaction_type,
        )

        db.add(reaction)
        db.commit()
        db.refresh(reaction)

        # create notification for target owner
        if owner_id and owner_id != user.id:
            notification = Notification(
                user_id=owner_id,
                triggered_by_user_id=user.id,
                type="like",
                reference_id=payload.object_id,
                is_read=False,
            )
            db.add(notification)
            db.commit()
            db.refresh(notification)

            try:
                actor = db.get(User, user.id)

                anyio.from_thread.run(
                    notification_manager.send_to_user,
                    owner_id,
                    {
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
                        "created_at": notification.created_at.isoformat() if notification.created_at else None,
                    },
                )
            except Exception as err:
                # fallback if websocket push fails
                print("REACTION NOTIFICATION WS ERROR:", err)

        return {"action": "created"}

    # remove reaction
    if existing.reaction_type == reaction_type:
        db.delete(existing)
        db.commit()
        return {"action": "removed"}

    # update reaction
    existing.reaction_type = reaction_type
    db.commit()

    return {"action": "updated"}