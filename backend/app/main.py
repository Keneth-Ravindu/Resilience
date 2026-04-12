import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.posts import router as posts_router
from app.api.journals import router as journals_router
from app.api.workouts import router as workouts_router
from app.api.nlp_debug import router as nlp_router
from app.api.analytics import router as analytics_router
from app.api.rewrite import router as rewrite_router
from app.api.comments import router as comments_router
from app.api.mentors import router as mentors_router
from app.api.users import router as users_router
from app.api.friend_requests import router as friend_requests_router
from app.api.reactions import router as reactions_router
from app.api.moderation import router as moderation_router
from app.api.chat import router as chat_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

app = FastAPI(title=settings.APP_NAME)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directories
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
PROFILE_PICTURES_DIR = UPLOADS_DIR / "profile_pictures"
POST_MEDIA_DIR = UPLOADS_DIR / "post_media"

PROFILE_PICTURES_DIR.mkdir(parents=True, exist_ok=True)
POST_MEDIA_DIR.mkdir(parents=True, exist_ok=True)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(posts_router)
app.include_router(journals_router)
app.include_router(workouts_router)
app.include_router(nlp_router)
app.include_router(analytics_router)
app.include_router(rewrite_router)
app.include_router(comments_router)
app.include_router(mentors_router)
app.include_router(friend_requests_router)
app.include_router(reactions_router)
app.include_router(moderation_router)
app.include_router(chat_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "backend", "env": settings.ENV}