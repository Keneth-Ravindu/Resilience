from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.nlp import NLPAnalyzeRequest
from app.services.security import get_current_user
from app.models.user import User
from app.services.text_analysis_service import analyze_and_store_text

router = APIRouter(prefix="/nlp", tags=["nlp"])


@router.post("/analyze")
def analyze_endpoint(payload: NLPAnalyzeRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # store linked to the logged-in user
    record = analyze_and_store_text(
        db,
        user_id=user.id,
        object_type=payload.object_type,
        object_id=payload.object_id,
        text=payload.text,
    )

    return {
        "id": record.id,
        "toxicity_score": record.toxicity_score,
        "toxicity_label": record.toxicity_label,
        "primary_emotion": record.primary_emotion,
        "tone": record.tone,
        "models": {"toxicity": record.toxicity_model, "emotion": record.emotion_model},
        "emotions": record.emotions,
        "created_at": record.created_at,
    }