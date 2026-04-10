from fastapi import APIRouter
import re
import torch

from app.schemas.rewrite import RewriteRequest, RewriteResponse
from app.services.model_loader import get_rewrite_bundle
from app.core.config import settings

router = APIRouter()


def normalize_text(text: str) -> str:
    text = (text or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def looks_too_similar(original: str, rewritten: str) -> bool:
    original_norm = normalize_text(original).lower()
    rewritten_norm = normalize_text(rewritten).lower()

    if not rewritten_norm:
        return True

    if rewritten_norm == original_norm:
        return True

    if rewritten_norm in original_norm or original_norm in rewritten_norm:
        return True

    return False


def safe_fallback_rewrite(text: str) -> tuple[str, str]:
    lower = normalize_text(text).lower()

    fallback_patterns = [
        (
            ["i hate you"],
            "I felt hurt and upset, but I want to respond respectfully.",
            "The original text was strongly hostile, so a calmer and more respectful version was suggested.",
        ),
        (
            ["you are stupid", "you're stupid"],
            "I disagree with what was said, but I want to keep the conversation respectful.",
            "The original text contained insulting language, so it was rewritten to remove the personal attack.",
        ),
        (
            ["shut up"],
            "Please give me a moment. I would prefer a calmer conversation.",
            "The original text was dismissive, so it was rewritten to sound calmer and more respectful.",
        ),
        (
            ["idiot", "moron", "dumb"],
            "I am frustrated, but I want to express that respectfully.",
            "The original text included insulting wording, so it was rewritten in a non-attacking way.",
        ),
    ]

    for triggers, rewrite, reason in fallback_patterns:
        if any(trigger in lower for trigger in triggers):
            return rewrite, reason

    return (
        "I feel upset about this situation, but I want to communicate it respectfully.",
        "The original text may come across as harsh, so it was rewritten to sound calmer and more supportive.",
    )


def postprocess_rewrite(original: str, rewritten: str) -> tuple[str, str]:
    rewritten = normalize_text(rewritten)

    if not rewritten:
        return safe_fallback_rewrite(original)

    lower_rewritten = rewritten.lower()

    strongly_hostile_markers = [
        "i hate you",
        "hate you",
        "shut up",
        "you're stupid",
        "you are stupid",
        "idiot",
        "moron",
        "dumb",
        "i don't like you",
    ]

    if any(marker in lower_rewritten for marker in strongly_hostile_markers):
        return safe_fallback_rewrite(original)

    if looks_too_similar(original, rewritten):
        return safe_fallback_rewrite(original)

    return (
        rewritten,
        "Suggested to make the text calmer, clearer, and more respectful before posting.",
    )


@router.get("/health")
def health():
    return {"status": "ok", "model": settings.REWRITE_MODEL}


@router.post("/rewrite", response_model=RewriteResponse)
def rewrite(payload: RewriteRequest):
    text = normalize_text(payload.text)

    if not text:
        return RewriteResponse(
            original_text="",
            rewritten_text="",
            model=settings.REWRITE_MODEL,
            reason="",
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
            num_beams=5,
            early_stopping=True,
            no_repeat_ngram_size=3,
        )

    rewritten = tokenizer.decode(outputs[0], skip_special_tokens=True)
    final_rewrite, reason = postprocess_rewrite(text, rewritten)

    return RewriteResponse(
        original_text=text,
        rewritten_text=final_rewrite,
        model=settings.REWRITE_MODEL,
        reason=reason,
    )