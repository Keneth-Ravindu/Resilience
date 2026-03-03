from fastapi import APIRouter

from app.core.config import settings
from app.schemas.nlp import NLPAnalyzeRequest, NLPAnalyzeResponse
from app.services.model_loader import get_toxicity_pipe, get_emotion_pipe

router = APIRouter()


def _tone_from(toxicity_score: float | None, primary_emotion: str | None) -> str:
    if toxicity_score is not None and toxicity_score >= 0.60:
        return "harsh"
    if primary_emotion in {"admiration", "gratitude", "joy", "optimism", "pride", "relief"}:
        return "supportive"
    return "neutral"


def _flatten_pipeline_output(raw):
    """
    HuggingFace pipeline output can be:
      - List[Dict] for a single text
      - List[List[Dict]] for a batch (even if batch size is 1)
    This function normalizes it to List[Dict].
    """
    if raw is None:
        return []
    if isinstance(raw, list) and len(raw) > 0 and isinstance(raw[0], list):
        return raw[0]
    return raw if isinstance(raw, list) else []


def _normalize_label(label: str, *, aliases: dict[str, str] | None = None) -> str:
    """
    Normalize model labels into a stable set.
    For toxicity we want: 'toxic' and 'non-toxic'.

    Handles:
      - 'toxic' / 'non-toxic'
      - 'LABEL_0' / 'LABEL_1'
      - any custom labels via pipe.label_aliases
    """
    if not label:
        return ""

    # First: alias map from model_loader (best)
    if aliases and label in aliases:
        return aliases[label]

    low = label.lower().strip()

    # If model already gives what we need:
    if "non" in low and "toxic" in low:
        return "non-toxic"
    if "toxic" in low:
        return "toxic"

    # Common HuggingFace generic labels:
    if low in {"label_0", "label0"}:
        return "non-toxic"
    if low in {"label_1", "label1"}:
        return "toxic"

    # Fallback: just return the lowercase label
    return low


@router.get("/health")
def health():
    return {"status": "ok", "service": "nlp_service"}


@router.post("/analyze", response_model=NLPAnalyzeResponse)
def analyze(payload: NLPAnalyzeRequest):
    text = payload.text.strip()
    if not text:
        return NLPAnalyzeResponse(
            tone="neutral",
            toxicity_model=settings.TOXICITY_MODEL,
            emotion_model=settings.EMOTION_MODEL,
        )

    tox_pipe = get_toxicity_pipe()
    emo_pipe = get_emotion_pipe()

    # --- Toxicity ---
    tox_raw = tox_pipe(text)
    tox_items = _flatten_pipeline_output(tox_raw)

    # If model_loader attached aliases, use them
    tox_aliases = getattr(tox_pipe, "label_aliases", None)

    tox_scores: dict[str, float] = {}
    for item in tox_items:
        if not isinstance(item, dict):
            continue
        label = _normalize_label(str(item.get("label", "")), aliases=tox_aliases)
        score = item.get("score", None)
        try:
            tox_scores[label] = float(score)
        except (TypeError, ValueError):
            continue

    # Prefer 'toxic' score, else compute from non-toxic if available
    toxicity_score = tox_scores.get("toxic")
    if toxicity_score is None and "non-toxic" in tox_scores:
        toxicity_score = 1.0 - tox_scores["non-toxic"]

    toxicity_label = (
        "toxic" if (toxicity_score is not None and toxicity_score >= 0.50) else "non-toxic"
    )

    # --- Emotion ---
    emo_raw = emo_pipe(text)
    emo_items = _flatten_pipeline_output(emo_raw)

    emo_scores: dict[str, float] = {}
    for item in emo_items:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label", "")).strip()
        score = item.get("score", None)
        if not label:
            continue
        try:
            emo_scores[label] = float(score)
        except (TypeError, ValueError):
            continue

    primary_emotion = max(emo_scores, key=emo_scores.get) if emo_scores else None
    tone = _tone_from(toxicity_score, primary_emotion)

    return NLPAnalyzeResponse(
        toxicity_score=toxicity_score,
        toxicity_label=toxicity_label,
        emotions=emo_scores,
        primary_emotion=primary_emotion,
        tone=tone,
        toxicity_model=settings.TOXICITY_MODEL,
        emotion_model=settings.EMOTION_MODEL,
    )