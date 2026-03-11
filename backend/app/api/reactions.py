from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.reaction import Reaction
from app.models.post import Post, Comment
from app.models.journal import JournalEntry
from app.models.user import User
from app.schemas.reaction import ReactionCreate
from app.services.security import get_current_user

router = APIRouter(prefix="/reactions", tags=["reactions"])

ALLOWED_OBJECT_TYPES = {"post", "comment", "journal"}
ALLOWED_REACTION_TYPES = {"like", "love", "fire", "strong", "clap", "support"}


def validate_target(db: Session, object_type: str, object_id: int):
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

    validate_target(db, object_type, payload.object_id)

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