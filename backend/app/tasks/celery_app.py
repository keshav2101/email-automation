from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "hr_automation",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "send-scheduled-followups": {
            "task": "app.tasks.email_tasks.send_scheduled_followups",
            "schedule": 3600.0,  # Every hour
        },
        "sync-gmail-replies": {
            "task": "app.tasks.email_tasks.sync_gmail_replies",
            "schedule": 1800.0,  # Every 30 minutes
        },
    },
)
