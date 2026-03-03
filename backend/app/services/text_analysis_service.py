from __future__ import annotations

import logging
from sqlalchemy.orm import Session

from app.models.text_analysis import TextAnalysis
from app.repositories.text_analysis_repo import create_text_analysis
from app.schemas.nlp import NLPAnalyzeRequest
from app.services.nlp_client import analyze_text

logger = logging.getLogger(__name__)


def analyze_and_store_text(
    db: Session,
    *,
    user_id: int,
    object_type: str,
    object_id: int,
    text: str,
    store_when_empty: bool = False,
) -> TextAnalysis | None:
    """
    1) Calls NLP microservice
    2) Stores outputs in DB

    Notes:
    - If NLP service fails, we still store a record (with None scores) so the app doesn't break.
    - If text is empty and store_when_empty=False, returns None.
    """
    cleaned = (text or "").strip()

    # Optionally skip storing analysis for empty text
    if not cleaned:
        if not store_when_empty:
            return None

        record = TextAnalysis(
            user_id=user_id,
            object_type=object_type,
            object_id=object_id,
            text="",
            toxicity_score=None,
            toxicity_label="non-toxic",
            emotions=None,
            primary_emotion="neutral",
            tone="neutral",
            toxicity_model=None,
            emotion_model=None,
        )
        return create_text_analysis(db, record)

    # Call NLP microservice (and fail gracefully)
    try:
        nlp_result = analyze_text(
            NLPAnalyzeRequest(text=cleaned, object_type=object_type, object_id=object_id)
        )

        record = TextAnalysis(
            user_id=user_id,
            object_type=object_type,
            object_id=object_id,
            text=cleaned,
            toxicity_score=nlp_result.toxicity_score,
            toxicity_label=nlp_result.toxicity_label,
            emotions=nlp_result.emotions,
            primary_emotion=nlp_result.primary_emotion,
            tone=nlp_result.tone,
            toxicity_model=nlp_result.toxicity_model,
            emotion_model=nlp_result.emotion_model,
        )
        return create_text_analysis(db, record)

    except Exception as e:
        # IMPORTANT: Don't break main app flows if NLP is temporarily down
        logger.exception(
            "NLP analyze_text failed. Storing fallback TextAnalysis. error=%s", str(e)
        )

        record = TextAnalysis(
            user_id=user_id,
            object_type=object_type,
            object_id=object_id,
            text=cleaned,
            toxicity_score=None,
            toxicity_label=None,
            emotions=None,
            primary_emotion=None,
            tone=None,
            toxicity_model=None,
            emotion_model=None,
        )
        return create_text_analysis(db, record)