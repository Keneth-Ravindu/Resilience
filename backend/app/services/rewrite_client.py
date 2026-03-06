import httpx
from fastapi import HTTPException

from app.core.config import settings


def rewrite_text(text: str) -> tuple[str, str]:
    """
    Calls rewrite microservice and returns:
      (rewritten_text, model_used)
    """
    url = f"{settings.REWRITE_SERVICE_URL}/rewrite"

    payload = {"text": text}

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, json=payload)
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Rewrite service unreachable: {e}") from e

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Rewrite service error: {resp.text}")

    data = resp.json()
    
    model_used = data.get("model", "")

    # Normalize model name (remove full Windows path if present)
    if model_used:
        model_used = model_used.split("\\")[-1]  # keep only folder name
        
    # rewrite_service returns: original_text, rewritten_text, model
    return data.get("rewritten_text", ""), model_used