from pydantic import BaseModel


class NLPAnalyzeRequest(BaseModel):
    text: str
    object_type: str
    object_id: int


class NLPAnalyzeResponse(BaseModel):
    toxicity_score: float | None = None
    toxicity_label: str | None = None
    emotions: dict | None = None
    primary_emotion: str | None = None
    tone: str | None = None
    toxicity_model: str | None = None
    emotion_model: str | None = None