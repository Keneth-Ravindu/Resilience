import threading
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from app.core.config import settings

_lock = threading.Lock()
_bundle = {}


def get_rewrite_bundle():
    with _lock:
        if "model" not in _bundle:
            tokenizer = AutoTokenizer.from_pretrained(settings.REWRITE_MODEL)
            model = AutoModelForSeq2SeqLM.from_pretrained(settings.REWRITE_MODEL)

            if torch.cuda.is_available():
                model = model.to("cuda")

            model.eval()

            _bundle["model"] = model
            _bundle["tokenizer"] = tokenizer

        return _bundle["tokenizer"], _bundle["model"]