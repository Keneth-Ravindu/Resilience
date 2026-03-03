from datetime import date
from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class ToneCounts(BaseModel):
    supportive: int = 0
    neutral: int = 0
    harsh: int = 0


class AnalyticsSummaryResponse(BaseModel):
    total_analyses: int
    avg_toxicity: Optional[float] = None
    tone_counts: ToneCounts
    top_emotions: List[str] = Field(default_factory=list)


class TimePoint(BaseModel):
    day: date
    value: float


class ToxicityTimelineResponse(BaseModel):
    points: List[TimePoint] = Field(default_factory=list)


class EmotionTimelineResponse(BaseModel):
    # e.g. {"joy": [{"day":..., "value":...}], "sadness":[...]}
    series: Dict[str, List[TimePoint]] = Field(default_factory=dict)