from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.workout import Workout
from app.schemas.workout import WorkoutCreate, WorkoutOut
from app.services.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.post("", response_model=WorkoutOut, status_code=status.HTTP_201_CREATED)
def create_workout(payload: WorkoutCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    workout = Workout(
        user_id=user.id,
        workout_date=payload.workout_date,
        workout_type=payload.workout_type,
        duration_minutes=payload.duration_minutes,
        intensity=payload.intensity,
        notes=payload.notes,
    )
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout


@router.get("", response_model=list[WorkoutOut])
def list_my_workouts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Workout)
        .filter(Workout.user_id == user.id)
        .order_by(Workout.workout_date.desc())
        .limit(90)
        .all()
    )