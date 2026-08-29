from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


API_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[3]

class Settings(BaseSettings):
    app_name: str = "TrustFlow Sentinel API"
    app_env: str = "development"
    api_prefix: str = "/api"
    database_path: str = "./trustflow.db"
    upload_dir: str = "./uploads"
    frontend_origin: str = "http://localhost:5173"

    nutrient_api_key: str | None = None
    nutrient_api_url: str = "https://api.nutrient.io/extraction/extract"
    serpapi_api_key: str | None = None
    serpapi_url: str = "https://serpapi.com/search.json"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:4b"

    use_mock_nutrient: bool = True
    use_mock_serpapi: bool = True
    use_mock_llm: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_prefix="TRUSTFLOW_", extra="ignore")

    def resolve_upload_dir(self) -> Path:
        p = Path(self.upload_dir)
        if not p.is_absolute():
            p = API_ROOT / p
        return p

    def ensure_dirs(self) -> None:
        self.resolve_upload_dir().mkdir(parents=True, exist_ok=True)

@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_dirs()
    return settings
