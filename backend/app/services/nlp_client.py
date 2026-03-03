import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.schemas.nlp import NLPAnalyzeRequest, NLPAnalyzeResponse


def analyze_text(payload: NLPAnalyzeRequest) -> NLPAnalyzeResponse:
    """
    Calls the NLP microservice. Keeps backend free of ML weights.
    """
    url = f"{settings.NLP_SERVICE_URL}/analyze"

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=payload.model_dump())
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"NLP service unreachable: {e}") from e

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"NLP service error: {resp.text}")

    return NLPAnalyzeResponse(**resp.json())