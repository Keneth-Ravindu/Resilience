from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]  # .../nlp_service
MODELS_DIR = BASE_DIR / "models"


class Settings(BaseSettings):
    # Optional cache dirs
    HF_HOME: str | None = None
    HF_HUB_CACHE: str | None = None
    TRANSFORMERS_CACHE: str | None = None
    HF_DATASETS_CACHE: str | None = None

    # LOCAL models (relative inside project)
    TOXICITY_MODEL: str = str(MODELS_DIR / "toxicity_model")
    EMOTION_MODEL: str = str(MODELS_DIR / "emotion_model")

    PORT: int = 8001

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()