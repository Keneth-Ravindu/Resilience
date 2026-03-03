from datetime import datetime, date
from pydantic import BaseModel, Field

class WorkoutCreate(BaseModel):
    workout_date: date | None = None
    workout_type: str
    duration_minutes: int = Field(ge=1, le=600)
    intensity: int = Field(ge=1, le=10)
    notes: str | None = None


class WorkoutOut(BaseModel):
    id: int
    user_id: int
    workout_date: date
    workout_type: str
    duration_minutes: int
    intensity: int
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True