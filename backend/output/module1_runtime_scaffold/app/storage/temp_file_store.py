from pathlib import Path
from uuid import uuid4
from fastapi import UploadFile
from app.core.config import settings


class TempFileStore:
    def __init__(self, base_dir: str | None = None):
        self.base_dir = Path(base_dir or settings.temp_upload_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save_upload(self, upload_file: UploadFile) -> str:
        suffix = Path(upload_file.filename or '').suffix or '.mp4'
        target = self.base_dir / f'{uuid4()}{suffix}'
        with target.open('wb') as f:
            while True:
                chunk = await upload_file.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
        await upload_file.close()
        return str(target.resolve())
