from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import anyio

from app.db.session import get_db
from app.models.post import Comment, Post
from app.models.user import User
from app.models.notification import Notification
from app.services.security import get_current_user
from app.repositories.text_analysis_repo import get_latest_analysis_for_object
from app.schemas.text_analysis import TextAnalysisOut
from app.schemas.comment import CommentCreate, CommentOut
from app.websocket.notification_manager import notification_manager

router = APIRouter(prefix="/comments", tags=["comments"])


@router.post("/posts/{post_id}", response_model=CommentOut)
def create_comment(
    post_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    content = payload.content.strip()

    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = Comment(
        user_id=user.id,
        post_id=post_id,
        content=content,
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)

    if post.user_id != user.id:
        notification = Notification(
            user_id=post.user_id,
            triggered_by_user_id=user.id,
            type="comment",
            reference_id=post.id,
            is_read=False,
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)

        try:
            actor = db.get(User, user.id)

            anyio.from_thread.run(
                notification_manager.send_to_user,
                post.user_id,
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
            # Keep comment creation working even if websocket push fails
            print("COMMENT NOTIFICATION WS ERROR:", err)

    return comment


@router.get("/{comment_id}/analysis", response_model=TextAnalysisOut)
def get_comment_analysis(
    comment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    comment = db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    analysis = get_latest_analysis_for_object(
        db,
        user_id=user.id,
        object_type="comment",
        object_id=comment_id,
    )

    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this comment")

    return analysis