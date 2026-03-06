from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]  # rewrite_service/app
MODELS_DIR = BASE_DIR / "models"


class Settings(BaseSettings):
    REWRITE_MODEL: str = str(MODELS_DIR / "detox_rewrite_model")

    PORT: int = 8002

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()