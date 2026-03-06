import os
import threading
from pathlib import Path
from typing import Any, Dict

from transformers import pipeline

from app.core.config import settings

_lock = threading.Lock()
_models: dict[str, Any] = {}


def _apply_cache_env() -> None:
    if settings.HF_HOME:
        os.environ["HF_HOME"] = settings.HF_HOME
    if settings.HF_HUB_CACHE:
        os.environ["HF_HUB_CACHE"] = settings.HF_HUB_CACHE
    if settings.TRANSFORMERS_CACHE:
        os.environ["TRANSFORMERS_CACHE"] = settings.TRANSFORMERS_CACHE
    if settings.HF_DATASETS_CACHE:
        os.environ["HF_DATASETS_CACHE"] = settings.HF_DATASETS_CACHE

    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


def _resolve_model_ref(model_ref: str) -> str:
    """
    If model_ref looks like a local path (exists as dir), return absolute path.
    Else return as-is (HF repo id).
    """
    p = Path(model_ref)
    if p.exists():
        return str(p.resolve())

    # If user provided "models/toxicity_model" (relative), resolve relative to nlp_service/
    base_dir = Path(__file__).resolve().parents[2]  # .../nlp_service
    candidate = (base_dir / model_ref).resolve()
    if candidate.exists():
        return str(candidate)

    return model_ref  # HF repo id fallback


def _build_text_classification_pipe(model_name: str):
    model_name = _resolve_model_ref(model_name)

    try:
        return pipeline(
            task="text-classification",
            model=model_name,
            top_k=None,
        )
    except TypeError:
        return pipeline(
            task="text-classification",
            model=model_name,
            return_all_scores=True,
        )


def _attach_toxicity_label_aliases(pipe_obj) -> None:
    aliases: Dict[str, str] = {}

    cfg = getattr(getattr(pipe_obj, "model", None), "config", None)
    id2label = getattr(cfg, "id2label", None)

    if isinstance(id2label, dict) and id2label:
        for _, lbl in id2label.items():
            raw = str(lbl)
            low = raw.lower().strip()
            if "non" in low and "toxic" in low:
                aliases[raw] = "non-toxic"
            elif "toxic" in low:
                aliases[raw] = "toxic"

    if not aliases:
        aliases = {
            "LABEL_0": "non-toxic",
            "LABEL_1": "toxic",
            "label_0": "non-toxic",
            "label_1": "toxic",
        }

    setattr(pipe_obj, "label_aliases", aliases)
    
def _attach_emotion_label_aliases(pipe_obj) -> None:
    """
    If emotion model outputs LABEL_0, LABEL_1... map them to real GoEmotions labels
    using labels.txt inside the model folder.
    """
    from pathlib import Path

    model_ref = getattr(pipe_obj, "model", None)
    cfg = getattr(model_ref, "config", None)
    if cfg is None:
        return

    id2label = getattr(cfg, "id2label", None)
    if isinstance(id2label, dict) and id2label:

        if all(isinstance(v, str) and not v.upper().startswith("LABEL_") for v in id2label.values()):
            return

    # Find model folder path
    model_dir = getattr(cfg, "_name_or_path", None)
    if not model_dir:
        return

    labels_file = Path(model_dir) / "labels.txt"
    if not labels_file.exists():
        return

    labels = [line.strip() for line in labels_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not labels:
        return

    new_id2label = {i: labels[i] for i in range(len(labels))}
    new_label2id = {v: k for k, v in new_id2label.items()}

    cfg.id2label = new_id2label
    cfg.label2id = new_label2id


def get_toxicity_pipe():
    _apply_cache_env()
    with _lock:
        if "toxicity" not in _models:
            tox = _build_text_classification_pipe(settings.TOXICITY_MODEL)
            _attach_toxicity_label_aliases(tox)
            _models["toxicity"] = tox
        return _models["toxicity"]


def get_emotion_pipe():
    _apply_cache_env()
    with _lock:
        if "emotion" not in _models:
            emo = _build_text_classification_pipe(settings.EMOTION_MODEL)
            _attach_emotion_label_aliases(emo)
            _models["emotion"] = emo
        return _models["emotion"]
    
    