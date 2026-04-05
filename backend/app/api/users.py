from pathlib import Path
from uuid import uuid4
import shutil

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserProfileUpdate, PublicUserProfile
from app.services.security import get_current_user

from app.models.post import Post
from app.models.journal import JournalEntry

router = APIRouter(prefix="/users", tags=["users"])

class UserRoleUpdate(BaseModel):
    role: str


def require_admin(user: User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    


BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROFILE_PICTURES_DIR = BASE_DIR / "uploads" / "profile_pictures"

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


def _get_file_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


@router.get("/me", response_model=UserOut)
def get_my_profile(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_my_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.display_name is not None:
        cleaned = payload.display_name.strip()
        user.display_name = cleaned if cleaned else None

    if payload.profile_picture_url is not None:
        cleaned = payload.profile_picture_url.strip()
        user.profile_picture_url = cleaned if cleaned else None

    if payload.status_text is not None:
        cleaned = payload.status_text.strip()
        user.status_text = cleaned if cleaned else None

    if payload.age_range is not None:
        cleaned = payload.age_range.strip()
        user.age_range = cleaned if cleaned else None

    if payload.fitness_level is not None:
        cleaned = payload.fitness_level.strip()
        user.fitness_level = cleaned if cleaned else None

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/me/upload-profile-picture", status_code=status.HTTP_201_CREATED)
def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    content_type = (file.content_type or "").lower().strip()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image type. Allowed: jpg, jpeg, png, webp",
        )

    PROFILE_PICTURES_DIR.mkdir(parents=True, exist_ok=True)

    extension = _get_file_extension(file.filename or "")
    if not extension:
        extension = ".jpg"

    filename = f"user_{user.id}_{uuid4().hex}{extension}"
    file_path = PROFILE_PICTURES_DIR / filename

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()

    file_size = file_path.stat().st_size
    if file_size > MAX_PROFILE_IMAGE_SIZE:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Profile image is too large. Max size is 5 MB")

    profile_picture_url = f"/uploads/profile_pictures/{filename}"
    user.profile_picture_url = profile_picture_url

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Profile picture uploaded successfully",
        "profile_picture_url": profile_picture_url,
        "filename": filename,
        "content_type": content_type,
        "size_bytes": file_size,
    }


@router.get("/search", response_model=list[PublicUserProfile])
def search_users(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    search_term = q.strip()
    if not search_term:
        return []

    users = (
        db.query(User)
        .filter(
            or_(
                User.display_name.ilike(f"%{search_term}%"),
                User.name.ilike(f"%{search_term}%"),
            )
        )
        .order_by(User.created_at.desc())
        .limit(20)
        .all()
    )
    return users


@router.get("", response_model=list[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .limit(200)
        .all()
    )
    return users

@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    allowed_roles = {"user", "mentor", "admin"}
    new_role = (payload.role or "").strip().lower()

    if new_role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Invalid role")

    target_user = db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.id == current_user.id and new_role != "admin":
        raise HTTPException(status_code=400, detail="Admin cannot remove their own admin role")

    target_user.role = new_role
    db.add(target_user)
    db.commit()
    db.refresh(target_user)

    return target_user


@router.get("/{user_id}", response_model=PublicUserProfile)
def get_public_profile(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/{user_id}/posts")
def get_user_posts(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    posts = (
        db.query(Post)
        .filter(Post.user_id == user_id)
        .order_by(Post.created_at.desc())
        .limit(50)
        .all()
    )

    return posts

@router.get("/{user_id}/journals")
def get_user_public_journals(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    journals = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.user_id == user_id,
            JournalEntry.visibility == "public",
        )
        .order_by(JournalEntry.entry_date.desc())
        .limit(50)
        .all()
    )

    return journals