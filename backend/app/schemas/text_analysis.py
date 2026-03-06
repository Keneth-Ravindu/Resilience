from pydantic import BaseModel, ConfigDict
from datetime import datetime


class TextAnalysisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    object_type: str
    object_id: int
    text: str

    toxicity_score: float | None = None
    toxicity_label: str | None = None

    emotions: dict | None = None
    primary_emotion: str | None = None
    tone: str | None = None

    toxicity_model: str | None = None
    emotion_model: str | None = None

    rewrite_suggestion: str | None = None
    rewrite_model: str | None = None
    rewrite_reason: str | None = None

    created_at: datetime