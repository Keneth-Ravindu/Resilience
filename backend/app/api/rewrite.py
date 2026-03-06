from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services.security import get_current_user
from app.models.user import User
from app.services.rewrite_client import rewrite_text

router = APIRouter(prefix="/rewrite", tags=["rewrite"])


class RewriteRequest(BaseModel):
    text: str


@router.post("")
def manual_rewrite(
    payload: RewriteRequest,
    user: User = Depends(get_current_user),
):
    # user is only to protect endpoint (JWT required)
    return rewrite_text(payload.text.strip())