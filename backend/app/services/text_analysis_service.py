from __future__ import annotations

import logging
from sqlalchemy.orm import Session

from app.models.text_analysis import TextAnalysis
from app.repositories.text_analysis_repo import create_text_analysis
from app.schemas.nlp import NLPAnalyzeRequest
from app.services.nlp_client import analyze_text
from app.services.rewrite_client import rewrite_text
from app.core.config import settings

logger = logging.getLogger(__name__)


def _norm_label(label: str | None) -> str | None:
    if not label:
        return None
    return label.strip().lower()


def _should_auto_rewrite(toxicity_label: str | None, toxicity_score: float | None) -> bool:
    """
    Decision rules:
    1) If label explicitly says toxic -> rewrite
    2) If label explicitly says non-toxic -> rewrite if score >= threshold (fallback)
    3) Unknown labels -> rely on threshold
    """
    label = _norm_label(toxicity_label)
    threshold = float(getattr(settings, "TOXICITY_REWRITE_THRESHOLD", 0.65))
    #Here is where you can see the toxicity score
    

    score = None if toxicity_score is None else float(toxicity_score)

    if label in {"toxic"}:
        return True

    if label in {"non-toxic", "nontoxic", "non_toxic"}:
        return (score is not None) and (score >= threshold)

    if score is None:
        return False

    return score >= threshold


def _should_skip_rewrite(text: str) -> bool:
    """
    Avoid rewriting very short or empty text.
    """
    t = (text or "").strip()
    if not t:
        return True
    if len(t) < 8:
        return True
    return False


def _build_rewrite_reason(
    *,
    toxicity_label: str | None,
    toxicity_score: float | None,
    threshold: float | None,
) -> str:
    """
    A simple "safety explanation" string you can show in UI later.
    Keep it neutral + professional.
    """
    lbl = toxicity_label if toxicity_label is not None else "unknown"
    score = float(toxicity_score) if toxicity_score is not None else None

    if score is None:
        return f"Rewrite suggested because the content was flagged as potentially harmful (label={lbl})."

    if threshold is None:
        return (
            f"Rewrite suggested because toxic language was detected "
            f"(label={lbl}, score={score:.4f})."
        )

    return (
        f"The system detected potentially harmful language "
        f"(toxicity score: {score:.2f}). "
        "A more respectful alternative was automatically suggested."
    )
    
def analyze_text_preview(text: str) -> dict:
    """
    Analyze text without storing it in the database.
    Used for pre-submit moderation checks in the frontend.
    """

    cleaned = (text or "").strip()

    if not cleaned:
        return {
            "is_toxic": False,
            "toxicity_score": None,
            "toxicity_label": None,
            "primary_emotion": None,
            "tone": None,
            "rewrite_suggestion": None,
            "rewrite_reason": None,
            "rewrite_model": None,
            "message": None,
        }

    nlp_result = analyze_text(
        NLPAnalyzeRequest(text=cleaned, object_type="preview", object_id=0)
    )

    threshold = float(getattr(settings, "TOXICITY_REWRITE_THRESHOLD", 0.65))
    should_rewrite = _should_auto_rewrite(
        nlp_result.toxicity_label,
        nlp_result.toxicity_score,
    )
    skip_rewrite = _should_skip_rewrite(cleaned)

    rewrite_suggestion = None
    rewrite_reason = None
    rewrite_model = None

    if not skip_rewrite and should_rewrite:
        try:
            rewrite_result = rewrite_text(cleaned)

            rewrite_suggestion = rewrite_result.get("rewrite_suggestion")
            rewrite_reason = rewrite_result.get("rewrite_reason")
            rewrite_model = rewrite_result.get("rewrite_model")

            if not rewrite_reason:
                rewrite_reason = _build_rewrite_reason(
                    toxicity_label=nlp_result.toxicity_label,
                    toxicity_score=nlp_result.toxicity_score,
                    threshold=threshold,
                )
        except Exception as e:
            logger.exception("PREVIEW REWRITE FAILED error=%s", str(e))

    is_toxic = bool(should_rewrite)

    message = None
    if is_toxic:
        message = (
            "This text is too harsh or toxic. Please use the rewrite suggestion "
            "or rewrite it in a more respectful way before posting."
        )

    return {
        "is_toxic": is_toxic,
        "toxicity_score": nlp_result.toxicity_score,
        "toxicity_label": nlp_result.toxicity_label,
        "primary_emotion": nlp_result.primary_emotion,
        "tone": nlp_result.tone,
        "rewrite_suggestion": rewrite_suggestion,
        "rewrite_reason": rewrite_reason,
        "rewrite_model": rewrite_model,
        "message": message,
    }    


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
    Pipeline:
    1) Call NLP microservice
    2) Decide if rewrite needed
    3) Call rewrite microservice if toxic
    4) Store result in DB
    """

    cleaned = (text or "").strip()

    logger.info(
        "TEXT ANALYSIS START user=%s object=%s:%s text_len=%s",
        user_id,
        object_type,
        object_id,
        len(cleaned),
    )

    if not cleaned:
        if not store_when_empty:
            logger.info("TEXT ANALYSIS SKIPPED (empty text)")
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
            rewrite_suggestion=None,
            rewrite_model=None,
            rewrite_reason=None,
        )

        logger.info("TEXT ANALYSIS STORED (empty text)")
        return create_text_analysis(db, record)

    try:
        # ---------- NLP CALL ----------
        logger.info("CALLING NLP SERVICE")

        nlp_result = analyze_text(
            NLPAnalyzeRequest(text=cleaned, object_type=object_type, object_id=object_id)
        )

        logger.info(
            "NLP RESULT label=%s score=%s primary_emotion=%s",
            nlp_result.toxicity_label,
            nlp_result.toxicity_score,
            nlp_result.primary_emotion,
        )

        rewrite_suggestion: str | None = None
        rewrite_model: str | None = None
        rewrite_reason: str | None = None

        skip_rewrite = _should_skip_rewrite(cleaned)
        should_rewrite = _should_auto_rewrite(
            nlp_result.toxicity_label,
            nlp_result.toxicity_score,
        )

        threshold = float(getattr(settings, "TOXICITY_REWRITE_THRESHOLD", 0.65))

        if skip_rewrite:
            logger.info("REWRITE SKIPPED reason=short_text")

        # ---------- REWRITE DECISION ----------
        if not skip_rewrite and should_rewrite:
            logger.info(
                "AUTO-REWRITE TRIGGERED object=%s:%s label=%s score=%s threshold=%s",
                object_type,
                object_id,
                nlp_result.toxicity_label,
                nlp_result.toxicity_score,
                threshold,
            )

            try:
                rewritten, model_used = rewrite_text(cleaned)

                rewrite_suggestion = rewritten
                rewrite_model = model_used
                rewrite_reason = _build_rewrite_reason(
                    toxicity_label=nlp_result.toxicity_label,
                    toxicity_score=nlp_result.toxicity_score,
                    threshold=threshold,
                )

                logger.info(
                    "AUTO-REWRITE SUCCESS object=%s:%s model=%s reason=%s",
                    object_type,
                    object_id,
                    model_used,
                    rewrite_reason,
                )

            except Exception as e:
                logger.exception(
                    "AUTO-REWRITE FAILED object=%s:%s error=%s",
                    object_type,
                    object_id,
                    str(e),
                )

        else:
            logger.info(
                "AUTO-REWRITE NOT TRIGGERED object=%s:%s skip=%s should=%s label=%s score=%s",
                object_type,
                object_id,
                skip_rewrite,
                should_rewrite,
                nlp_result.toxicity_label,
                nlp_result.toxicity_score,
            )

        # ---------- STORE RESULT ----------
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
            rewrite_suggestion=rewrite_suggestion,
            rewrite_model=rewrite_model,
            rewrite_reason=rewrite_reason,
        )

        result = create_text_analysis(db, record)

        logger.info(
            "TEXT ANALYSIS STORED id=%s rewrite=%s",
            result.id,
            bool(rewrite_suggestion),
        )

        return result

    except Exception as e:
        logger.exception(
            "NLP ANALYSIS FAILED object=%s:%s error=%s",
            object_type,
            object_id,
            str(e),
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
            rewrite_suggestion=None,
            rewrite_model=None,
            rewrite_reason=None,
        )

        return create_text_analysis(db, record)