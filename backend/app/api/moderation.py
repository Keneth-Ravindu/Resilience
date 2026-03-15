from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.models.user import User
from app.services.security import get_current_user
from app.services.text_analysis_service import analyze_text_preview

router = APIRouter(prefix="/moderation", tags=["moderation"])


class ModerationRequest(BaseModel):
    text: str


@router.post("/check-text")
def check_text_moderation(
    payload: ModerationRequest,
    user: User = Depends(get_current_user),
):
    return analyze_text_preview(payload.text)