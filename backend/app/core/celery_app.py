from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "golf_swing_ai",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.analysis_task"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Seoul",
    enable_utc=False,
    task_track_started=True,
)