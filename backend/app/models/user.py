from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, JSON
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # nullable for OAuth users
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Gmail OAuth tokens (encrypted at rest in production)
    gmail_access_token = Column(Text, nullable=True)
    gmail_refresh_token = Column(Text, nullable=True)
    gmail_token_expiry = Column(DateTime, nullable=True)
    gmail_email = Column(String(255), nullable=True)
    gmail_connected = Column(Boolean, default=False)

    # Universal Email Plugin Integration (SMTP / Gmail / Outlook / Custom)
    email_plugin_type = Column(String(50), default="simulation")  # smtp_gmail, smtp_outlook, smtp_custom, gmail_oauth, simulation
    smtp_host = Column(String(255), nullable=True)
    smtp_port = Column(Integer, default=587)
    smtp_user = Column(String(255), nullable=True)
    smtp_password = Column(Text, nullable=True)
    smtp_use_tls = Column(Boolean, default=True)
    smtp_from_name = Column(String(255), nullable=True)
    email_connected = Column(Boolean, default=False)
    email_connected_at = Column(DateTime, nullable=True)

    # Email Signature Customization
    email_signature = Column(Text, nullable=True)
    signature_template = Column(String(50), default="modern")
    signature_data = Column(JSON, default=dict)
    append_signature_default = Column(Boolean, default=True)

    # Sending preferences
    daily_send_limit = Column(Integer, default=50)
    send_enabled = Column(Boolean, default=True)
    draft_only_mode = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
