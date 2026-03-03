from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    HF_HOME: str = r"C:\AI_Models\huggingface"
    HF_HUB_CACHE: str = r"C:\AI_Models\huggingface\hub"
    TRANSFORMERS_CACHE: str = r"C:\AI_Models\huggingface\transformers"
    HF_DATASETS_CACHE: str = r"C:\AI_Models\huggingface\datasets"

    TOXICITY_MODEL: str = "unitary/unbiased-toxic-roberta"
    EMOTION_MODEL: str = "SamLowe/roberta-base-go_emotions"

    PORT: int = 8001

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()