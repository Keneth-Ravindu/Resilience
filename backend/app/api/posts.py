from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pathlib import Path
from uuid import uuid4
import logging
import shutil

from app.db.session import get_db
from app.models.post import Post, Comment
from app.models.reaction import Reaction
from app.schemas.post import PostCreate, PostOut, CommentCreate, CommentOut
from app.services.security import get_current_user
from app.models.user import User
from app.services.text_analysis_service import analyze_and_store_text
from app.repositories.text_analysis_repo import get_latest_analysis_for_object
from app.services.text_analysis_service import analyze_text_preview

router = APIRouter(prefix="/posts", tags=["posts"])
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
POST_MEDIA_DIR = BASE_DIR / "uploads" / "post_media"

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024
MAX_VIDEO_SIZE = 50 * 1024 * 1024

# ---------------------------
# Workout Detection
# ---------------------------

EXERCISE_DB = {
    "bench press": {
        "image": "/static/workouts/bench_press.jpg",
        "muscle": "chest",
    },
    "squat": {
        "image": "/static/workouts/squat.jpg",
        "muscle": "legs",
    },
    "deadlift": {
        "image": "/static/workouts/deadlift_1.jpg",
        "muscle": "back",
    },
    "shoulder press": {
        "image": "/static/workouts/shoulder_press.jpg",
        "muscle": "shoulders",
    },
    "bicep curl": {
        "image": "/static/workouts/bicep_curl.jpg",
        "muscle": "arms",
    },
    "tricep pushdown": {
        "image": "/static/workouts/tricep_pushdown.jpg",
        "muscle": "arms",
    },
}

EXERCISE_ALIASES = {
    "bench": "bench press",
    "bench presses": "bench press",
    "squats": "squat",
    "deadlifts": "deadlift",
    "shoulder presses": "shoulder press",
    "curls": "bicep curl",
    "bicep curls": "bicep curl",
    "tricep pushdowns": "tricep pushdown",
}


def extract_workout_data(text: str):
    text_lower = (text or "").lower()
    found = []

    for name, data in EXERCISE_DB.items():
        if name in text_lower:
            found.append(
                {
                    "name": name,
                    "image": data["image"],
                    "muscle": data["muscle"],
                }
            )

    for alias, actual_name in EXERCISE_ALIASES.items():
        if alias in text_lower:
            already_found = any(item["name"] == actual_name for item in found)
            if not already_found and actual_name in EXERCISE_DB:
                data = EXERCISE_DB[actual_name]
                found.append(
                    {
                        "name": actual_name,
                        "image": data["image"],
                        "muscle": data["muscle"],
                    }
                )

    return found


def _get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def _detect_media_type(content_type: str) -> str | None:
    if content_type in ALLOWED_IMAGE_TYPES:
        return "image"
    if content_type in ALLOWED_VIDEO_TYPES:
        return "video"
    return None


def _enforce_safe_text(text: str, used_rewrite: bool = False):
    result = analyze_text_preview(text)

    if result.get("is_toxic") is True:
        if used_rewrite:
            score = result.get("toxicity_score") or 0
            if score < 0.85:
                return result

        raise HTTPException(
            status_code=400,
            detail={
                "message": "This content is too harsh or toxic. Please rewrite it.",
                "is_toxic": True,
                "toxicity_label": result.get("toxicity_label"),
                "primary_emotion": result.get("primary_emotion"),
                "rewrite_suggestion": result.get("rewrite_suggestion"),
            },
        )

    return result


# ---------------------------
# Reaction Helper
# ---------------------------

def get_reaction_counts(db: Session, object_type: str, object_id: int):
    rows = (
        db.query(
            Reaction.reaction_type,
            func.count(Reaction.id)
        )
        .filter(
            Reaction.object_type == object_type,
            Reaction.object_id == object_id
        )
        .group_by(Reaction.reaction_type)
        .all()
    )

    counts = {reaction: count for reaction, count in rows}
    total = sum(counts.values())
    return counts, total


# ---------------------------
# Upload Media
# ---------------------------

@router.post("/upload-media", status_code=status.HTTP_201_CREATED)
def upload_post_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower().strip()
    media_type = _detect_media_type(content_type)

    if not media_type:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: jpg, jpeg, png, webp, mp4, webm, mov",
        )

    POST_MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    extension = _get_file_extension(file.filename or "")
    if not extension:
        extension = ".jpg" if media_type == "image" else ".mp4"

    filename = f"user_{user.id}_{uuid4().hex}{extension}"
    file_path = POST_MEDIA_DIR / filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()

    file_size = file_path.stat().st_size

    if media_type == "image" and file_size > MAX_IMAGE_SIZE:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Image file is too large. Max size is 5 MB")

    if media_type == "video" and file_size > MAX_VIDEO_SIZE:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Video file is too large. Max size is 50 MB")

    media_url = f"/uploads/post_media/{filename}"

    return {
        "message": "Media uploaded successfully",
        "media_url": media_url,
        "media_type": media_type,
        "filename": filename,
        "content_type": content_type,
        "size_bytes": file_size,
    }


# ---------------------------
# Create Post
# ---------------------------

@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: PostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    media_type = (payload.media_type or "").strip().lower() or None
    if media_type not in {None, "image", "video"}:
        raise HTTPException(status_code=400, detail="media_type must be 'image' or 'video'")

    if payload.media_url and not media_type:
        raise HTTPException(status_code=400, detail="media_type is required when media_url is provided")

    if media_type and not payload.media_url:
        raise HTTPException(status_code=400, detail="media_url is required when media_type is provided")

    _enforce_safe_text(payload.content, payload.used_rewrite)

    workout_data = extract_workout_data(payload.content)

    post = Post(
        user_id=user.id,
        content=payload.content,
        media_url=payload.media_url,
        media_type=media_type,
        tags=payload.tags,
        workout_data=workout_data if workout_data else None,
    )

    db.add(post)
    db.commit()
    db.refresh(post)

    post = (
        db.query(Post)
        .options(joinedload(Post.author))
        .filter(Post.id == post.id)
        .first()
    )

    try:
        analyze_and_store_text(
            db,
            user_id=user.id,
            object_type="post",
            object_id=post.id,
            text=post.content,
        )
    except Exception as e:
        db.rollback()
        logger.exception("NLP analysis failed for post %s error=%s", post.id, str(e))

    counts, total = get_reaction_counts(db, "post", post.id)

    post.reaction_counts = counts
    post.total_reactions = total

    return post


# ---------------------------
# List Posts (Feed)
# ---------------------------

@router.get("", response_model=list[PostOut])
def list_posts(
    db: Session = Depends(get_db),
):
    posts = (
        db.query(Post)
        .options(joinedload(Post.author))
        .order_by(Post.created_at.desc())
        .limit(100)
        .all()
    )

    enriched_posts = []

    for post in posts:
        counts, total = get_reaction_counts(db, "post", post.id)

        post.reaction_counts = counts
        post.total_reactions = total

        enriched_posts.append(post)

    return enriched_posts


# ---------------------------
# Get Single Post
# ---------------------------

@router.get("/{post_id}", response_model=PostOut)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
):
    post = (
        db.query(Post)
        .options(joinedload(Post.author))
        .filter(Post.id == post_id)
        .first()
    )

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    counts, total = get_reaction_counts(db, "post", post.id)

    post.reaction_counts = counts
    post.total_reactions = total

    return post


# ---------------------------
# Comments
# ---------------------------

@router.get("/{post_id}/comments", response_model=list[CommentOut])
def list_comments(
    post_id: int,
    db: Session = Depends(get_db),
):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.post_id == post_id)
        .order_by(Comment.created_at.asc())
        .all()
    )

    enriched_comments = []

    for comment in comments:
        counts, total = get_reaction_counts(db, "comment", comment.id)
        comment.reaction_counts = counts
        comment.total_reactions = total
        enriched_comments.append(comment)

    return enriched_comments


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

    _enforce_safe_text(payload.content, payload.used_rewrite)

    comment = Comment(
        post_id=post_id,
        user_id=user.id,
        content=payload.content,
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)

    comment = (
        db.query(Comment)
        .options(joinedload(Comment.author))
        .filter(Comment.id == comment.id)
        .first()
    )

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
        logger.exception("NLP analysis failed for comment %s error=%s", comment.id, str(e))

    counts, total = get_reaction_counts(db, "comment", comment.id)
    comment.reaction_counts = counts
    comment.total_reactions = total

    return comment


# ---------------------------
# Post Analysis
# ---------------------------

@router.get("/{post_id}/analysis")
def get_post_analysis(
    post_id: int,
    db: Session = Depends(get_db),
):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    analysis = get_latest_analysis_for_object(
        db,
        user_id=post.user_id,
        object_type="post",
        object_id=post_id,
    )

    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this post")

    return {
        "post_id": post_id,
        "analysis_id": analysis.id,
        "created_at": analysis.created_at,
        "toxicity_score": analysis.toxicity_score,
        "toxicity_label": analysis.toxicity_label,
        "emotions": analysis.emotions,
        "primary_emotion": analysis.primary_emotion,
        "tone": analysis.tone,
        "toxicity_model": analysis.toxicity_model,
        "emotion_model": analysis.emotion_model,
        "rewrite_suggestion": getattr(analysis, "rewrite_suggestion", None),
        "rewrite_model": getattr(analysis, "rewrite_model", None),
        "rewrite_reason": getattr(analysis, "rewrite_reason", None),
    }