# nlp_service/app/services/model_loader.py

import os
import threading
from typing import Any, Dict, Optional

from transformers import pipeline

from app.core.config import settings

_lock = threading.Lock()
_models: dict[str, Any] = {}


def _apply_cache_env() -> None:
    if settings.HF_HOME:
        os.environ["HF_HOME"] = settings.HF_HOME

    os.environ["HF_HUB_CACHE"] = os.path.join(settings.HF_HOME, "hub")
    os.environ["TRANSFORMERS_CACHE"] = os.path.join(settings.HF_HOME, "transformers")
    os.environ["HF_DATASETS_CACHE"] = os.path.join(settings.HF_HOME, "datasets")

    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

    if getattr(settings, "HF_HUB_CACHE", None):
        os.environ["HF_HUB_CACHE"] = settings.HF_HUB_CACHE

    if settings.TRANSFORMERS_CACHE:
        os.environ["TRANSFORMERS_CACHE"] = settings.TRANSFORMERS_CACHE

    if getattr(settings, "HF_DATASETS_CACHE", None):
        os.environ["HF_DATASETS_CACHE"] = settings.HF_DATASETS_CACHE

    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


def _build_text_classification_pipe(model_name: str):
    """
    Build a text-classification pipeline that returns *all* label scores.
    Transformers has changed the API across versions; this tries the
    most compatible options.
    """
    _apply_cache_env()

    # Newer style (transformers 4.26+ / 5.x): top_k=None returns all labels
    try:
        return pipeline(
            task="text-classification",
            model=model_name,
            top_k=None,
        )
    except TypeError:
        # Older style: return_all_scores=True
        return pipeline(
            task="text-classification",
            model=model_name,
            return_all_scores=True,
        )


def _attach_toxicity_label_aliases(pipe_obj) -> None:
    """
    Some models output labels like LABEL_0 / LABEL_1.
    We attach a mapping so the API layer can always normalize to:
      - "toxic"
      - "non-toxic"
    """
    aliases: Dict[str, str] = {}

    # Try to read the model's id2label (best source of truth)
    cfg = getattr(getattr(pipe_obj, "model", None), "config", None)
    id2label = getattr(cfg, "id2label", None)

    if isinstance(id2label, dict) and id2label:
        for _id, lbl in id2label.items():
            raw = str(lbl)
            low = raw.lower().strip()
            if "non" in low and "toxic" in low:
                aliases[raw] = "non-toxic"
            elif "toxic" in low:
                aliases[raw] = "toxic"

    # Fallback for common binary classifiers: LABEL_1 = toxic
    if not aliases:
        aliases = {
            "LABEL_0": "non-toxic",
            "LABEL_1": "toxic",
            "label_0": "non-toxic",
            "label_1": "toxic",
        }

    setattr(pipe_obj, "label_aliases", aliases)


def get_toxicity_pipe():
    with _lock:
        if "toxicity" not in _models:
            tox = _build_text_classification_pipe(settings.TOXICITY_MODEL)
            _attach_toxicity_label_aliases(tox)
            _models["toxicity"] = tox
        return _models["toxicity"]


def get_emotion_pipe():
    with _lock:
        if "emotion" not in _models:
            emo = _build_text_classification_pipe(settings.EMOTION_MODEL)
            _models["emotion"] = emo
        return _models["emotion"]