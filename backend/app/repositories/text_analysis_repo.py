from sqlalchemy.orm import Session

from app.models.text_analysis import TextAnalysis


def create_text_analysis(db: Session, analysis: TextAnalysis) -> TextAnalysis:
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


def get_latest_analysis_for_object(
    db: Session,
    *,
    user_id: int,
    object_type: str,
    object_id: int,
) -> TextAnalysis | None:
    """
    Returns the most recent analysis row for a given user + object.
    """
    return (
        db.query(TextAnalysis)
        .filter(
            TextAnalysis.user_id == user_id,
            TextAnalysis.object_type == object_type,
            TextAnalysis.object_id == object_id,
        )
        .order_by(TextAnalysis.created_at.desc())
        .first()
    )