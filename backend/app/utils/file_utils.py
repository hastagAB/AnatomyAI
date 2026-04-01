import os
import uuid
from pathlib import Path
from app.config import settings


def ensure_upload_dir() -> Path:
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_upload(file_bytes: bytes, filename: str) -> str:
    upload_dir = ensure_upload_dir()
    unique_name = f"{uuid.uuid4()}_{filename}"
    file_path = upload_dir / unique_name
    file_path.write_bytes(file_bytes)
    return str(file_path)


def cleanup_file(file_path: str):
    try:
        os.unlink(file_path)
    except OSError:
        pass
