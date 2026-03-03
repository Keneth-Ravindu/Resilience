from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.post import Post, Comment
from app.schemas.post import PostCreate, PostOut, CommentCreate, CommentOut
from app.services.security import get_current_user
from app.models.user import User
from app.services.text_analysis_service import analyze_and_store_text

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # 1) Save post
    post = Post(
        user_id=user.id,
        content=payload.content,
        tags=payload.tags,  # already list[str] from schema
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # 2) Run NLP + store analysis (do not fail post creation if NLP fails)
    try:
        analyze_and_store_text(
            db,
            user_id=user.id,
            object_type="post",
            object_id=post.id,
            text=post.content,
        )
    except Exception as e:
        db.rollback()  # IMPORTANT: clear failed transaction state if any
        print(f"[WARN] NLP analysis failed for post {post.id}: {e}")

    return post


@router.get("", response_model=list[PostOut])
def list_posts(db: Session = Depends(get_db)):
    return db.query(Post).order_by(Post.created_at.desc()).limit(50).all()


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(
    post_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # 1) Save comment
    comment = Comment(
        post_id=post_id,
        user_id=user.id,
        content=payload.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # 2) Run NLP + store analysis (do not fail comment creation if NLP fails)
    try:
        analyze_and_store_text(
            db,
            user_id=user.id,
            object_type="comment",
            object_id=comment.id,
            text=comment.content,
        )
    except Exception as e:
        db.rollback()
        print(f"[WARN] NLP analysis failed for comment {comment.id}: {e}")

    return comment