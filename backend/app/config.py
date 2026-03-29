from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    llm_provider: str = "anthropic"          # "anthropic" or "openai"
    llm_api_key: str = ""
    llm_base_url: str = ""                   # leave empty for default provider URL
    llm_model: str = "claude-sonnet-4-20250514"
    llm_model_deep: str = "claude-sonnet-4-20250514"
    upload_dir: str = str(Path(__file__).parent.parent / "uploads")
    max_file_size_mb: int = 50
    database_url: str = f"sqlite+aiosqlite:///{Path(__file__).parent.parent / 'anatomy.db'}"

    model_config = {
        "env_file": [
            ".env",                                          # if CWD is backend/
            str(Path(__file__).parent.parent / ".env"),       # absolute path to backend/.env
        ],
        "env_prefix": "ANATOMY_",
    }


settings = Settings()
