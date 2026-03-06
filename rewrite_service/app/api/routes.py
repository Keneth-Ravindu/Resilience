from fastapi import APIRouter
import torch

from app.schemas.rewrite import RewriteRequest, RewriteResponse
from app.services.model_loader import get_rewrite_bundle
from app.core.config import settings

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "model": settings.REWRITE_MODEL}


@router.post("/rewrite", response_model=RewriteResponse)
def rewrite(payload: RewriteRequest):
    text = (payload.text or "").strip()

    if not text:
        return RewriteResponse(
            original_text="",
            rewritten_text="",
            model=settings.REWRITE_MODEL,
        )

    tokenizer, model = get_rewrite_bundle()

    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=128,
    )

    if torch.cuda.is_available():
        inputs = {k: v.to("cuda") for k, v in inputs.items()}

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=64,
            num_beams=4,
            early_stopping=True,
        )

    rewritten = tokenizer.decode(outputs[0], skip_special_tokens=True)

    return RewriteResponse(
        original_text=text,
        rewritten_text=rewritten,
        model=settings.REWRITE_MODEL,
    )