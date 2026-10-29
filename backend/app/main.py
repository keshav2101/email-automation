from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import structlog

from app.core.config import settings
from app.api.v1.router import api_router
from app.core.database import engine
from app.models import base  # noqa: F401

logger = structlog.get_logger()

app = FastAPI(
    title="HR Email Automation API",
    description="AI-Powered HR Outreach & Email Automation System",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploads
import os
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include API router
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.on_event("startup")
async def startup_event():
    logger.info("HR Email Automation API starting up", environment=settings.ENVIRONMENT)
    try:
        base.Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize database tables", error=str(e))
