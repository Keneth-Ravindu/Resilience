import httpx
from fastapi import HTTPException

from app.core.config import settings


def rewrite_text(text: str) -> dict:
    """
    Calls rewrite microservice and returns a normalized object:
    {
        "rewrite_suggestion": str,
        "rewrite_reason": str,
        "rewrite_model": str
    }
    """
    url = f"{settings.REWRITE_SERVICE_URL}/rewrite"
    payload = {"text": text}

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, json=payload)
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Rewrite service unreachable: {e}"
        ) from e

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Rewrite service error: {resp.text}"
        )

    data = resp.json()

    model_used = data.get("model", "") or ""
    if model_used:
        model_used = model_used.split("\\")[-1]

    rewritten_text = (
        data.get("rewritten_text")
        or data.get("rewrite_suggestion")
        or data.get("suggestion")
        or ""
    )

    rewrite_reason = (
        data.get("reason")
        or data.get("rewrite_reason")
        or "Suggested to make the text clearer and more supportive."
    )

    return {
        "rewrite_suggestion": rewritten_text,
        "rewrite_reason": rewrite_reason,
        "rewrite_model": model_used,
    }