from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env",), extra="ignore")

    database_url: str = "postgresql+asyncpg://bimai:bimai@127.0.0.1:5545/bimai"
    cors_origins: str = "http://127.0.0.1:2000,http://localhost:2000,http://127.0.0.1:5173"

    def cors_origins_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
