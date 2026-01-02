from typing import List, Optional

from pydantic import AnyUrl, BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRES_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRES_DAYS: int = 7
    CORS_ORIGINS: Optional[str] = "http://localhost:3000"
    ENV: str = "development"
    GOOGLE_CLIENT_ID: Optional[str] = None

    # Sessions
    REQUIRE_SESSION_CLAIM: bool = True
    SESSION_TOUCH_ENABLED: bool = True
    SESSION_TOUCH_TTL_SECONDS: int = 300

    # Observability
    METRICS_ENABLED: bool = True

    # Rate limiting (Redis)
    RATE_LIMIT_FAIL_OPEN: bool = True
    TRUST_PROXY_HEADERS: bool = False

    # Global HTTP rate limit (best-effort)
    RATE_LIMIT_HTTP_PER_MINUTE: int = 300

    # WebSocket connect rate limit (best-effort)
    RATE_LIMIT_WS_CONNECT_PER_MINUTE: int = 60

    RATE_LIMIT_LOGIN_PER_MINUTE: int = 10
    RATE_LIMIT_LOGIN_PER_MINUTE_PER_USER: int = 5
    RATE_LIMIT_REFRESH_PER_MINUTE: int = 30
    RATE_LIMIT_REGISTER_PER_HOUR: int = 20
    RATE_LIMIT_POST_MESSAGE_PER_10_SECONDS: int = 20

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def get_settings() -> Settings:
    return Settings()
