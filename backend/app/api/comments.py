from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.post import Comment
from app.models.user import User
from app.services.security import get_current_user
from app.repositories.text_analysis_repo import get_latest_analysis_for_object
from app.schemas.text_analysis import TextAnalysisOut

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("/{comment_id}/analysis", response_model=TextAnalysisOut)
def get_comment_analysis(
    comment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    comment = db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Only allow user to access their own comment analysis
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    analysis = get_latest_analysis_for_object(
        db,
        user_id=user.id,
        object_type="comment",
        object_id=comment_id,
    )
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this comment")

    return analysis