from sqlalchemy.orm import Session

from app.models.text_analysis import TextAnalysis


def create_text_analysis(db: Session, analysis: TextAnalysis) -> TextAnalysis:
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis