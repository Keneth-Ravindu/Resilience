from pydantic import BaseModel


class NLPAnalyzeRequest(BaseModel):
    text: str
    object_type: str  # post/comment/journal
    object_id: int


class NLPAnalyzeResponse(BaseModel):
    # Toxicity
    toxicity_score: float | None = None
    toxicity_label: str | None = None

    # Emotions
    emotions: dict | None = None
    primary_emotion: str | None = None

    # UI tone
    tone: str | None = None

    # Models used
    toxicity_model: str | None = None
    emotion_model: str | None = None

    # Rewrite suggestion
    rewrite_suggestion: str | None = None
    rewrite_model: str | None = None