from pydantic import BaseModel
from datetime import datetime

class PostAnalysisOut(BaseModel):
    post_id: int
    analysis_id: int
    
    toxicity_score: float | None = None
    toxicity_label: str | None = None
    
    emotions: dict | None = None
    primary_emotion: str | None = None
    
    tone: str | None = None
    
    rewrite_suggestion: str | None = None
    rewrite_model: str | None = None
    rewrite_reason: str | None = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True
    
        
    