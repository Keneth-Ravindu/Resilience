import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

# Reduce noisy libraries
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

app.include_router(auth_router)
app.include_router(posts_router)
app.include_router(journals_router)
app.include_router(workouts_router)
app.include_router(nlp_router)
app.include_router(analytics_router)
app.include_router(rewrite_router)
app.include_router(comments_router)
app.include_router(mentors_router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "backend", "env": settings.ENV}