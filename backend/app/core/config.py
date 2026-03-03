from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Resilience API"
    ENV: str = "dev"

    # CORS (React dev server)
    CORS_ORIGINS: str = "http://localhost:5173"

    # Database
    DATABASE_URL: str = "postgresql+psycopg://resilience_user:resilience_pass@localhost:5432/resilience_db"

    # Auth / JWT
    JWT_SECRET_KEY: str = "CHANGE_ME_SUPER_SECRET"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Microservices
    NLP_SERVICE_URL: str = "http://127.0.0.1:8001"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()