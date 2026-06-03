from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Golf Swing Coach API"
    app_env: str = "local"
    app_debug: bool = True
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    api_prefix: str = "/api"

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "golf_swing_ai"

    secret_key: str = "change-this-secret-key"
    access_token_expire_minutes: int = 10080

    redis_url: str = "redis://localhost:6379/0"

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:8b"
    ollama_fallback_model: str = "gemma2:2b"
    ollama_timeout_seconds: int = 120

    max_upload_mb: int = 200
    temp_upload_dir: str = "./tmp/uploads"
    result_image_dir: str = "./tmp/results"
    max_video_duration_sec: int = 180
    pose_visibility_threshold: float = 0.5
    default_polling_interval_sec: int = 2
    session_compare_limit: int = 3
    chat_recent_messages_limit: int = 10
    chat_summary_trigger_count: int = 20

    swingnet_model_path: str = "./models/swingnet_1800.pth.tar"
    rcnn_model_path: str = "./models/keypointrcnn_resnet50_fpn.pth"
    reference_stats_path: str = "./data/reference_stats_v1.json"

    firebase_project_id: str = "your-firebase-project-id"
    firebase_credentials_path: str = "./firebase-adminsdk.json"
    firebase_storage_bucket: str = "your-project.appspot.com"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()