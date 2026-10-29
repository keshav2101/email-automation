"""
Gmail service: handles OAuth 2.0 flow, draft creation, sending, and reply sync.
"""
import json
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional
from datetime import datetime, timedelta

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import Flow

from app.core.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
]


def get_oauth_flow() -> Flow:
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=SCOPES)
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    return flow


def get_auth_url() -> str:
    flow = get_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
    )
    return auth_url


def exchange_code_for_tokens(code: str) -> dict:
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    credentials = flow.credentials
    return {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
    }


def _get_credentials(user) -> Credentials:
    return Credentials(
        token=user.gmail_access_token,
        refresh_token=user.gmail_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
    )


def _get_gmail_service(user):
    creds = _get_credentials(user)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return build("gmail", "v1", credentials=creds)


def create_draft(
    user,
    to: str,
    subject: str,
    body: str,
    attachment_path: Optional[str] = None,
) -> str:
    """Create a Gmail draft. Returns the draft ID."""
    service = _get_gmail_service(user)

    message = MIMEMultipart()
    message["to"] = to
    message["subject"] = subject
    message.attach(MIMEText(body, "plain"))

    if attachment_path:
        try:
            with open(attachment_path, "rb") as f:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f'attachment; filename="{attachment_path.split("/")[-1]}"',
            )
            message.attach(part)
        except Exception:
            pass

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    draft = service.users().drafts().create(
        userId="me", body={"message": {"raw": raw}}
    ).execute()
    return draft["id"]


def send_message(
    user,
    to: Optional[str] = None,
    subject: str = "",
    body: Optional[str] = None,
    attachment_path: Optional[str] = None,
    to_email: Optional[str] = None,
    body_text: Optional[str] = None,
) -> dict:
    """Send an email via Gmail API. Returns message info."""
    service = _get_gmail_service(user)

    target_to = to or to_email or ""
    content_body = body or body_text or ""

    message = MIMEMultipart()
    message["to"] = target_to
    message["subject"] = subject
    message.attach(MIMEText(content_body, "plain"))

    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    result = service.users().messages().send(
        userId="me", body={"raw": raw}
    ).execute()
    return result


def check_for_replies(user, thread_id: str) -> bool:
    """Check if a thread has received a reply."""
    try:
        service = _get_gmail_service(user)
        thread = service.users().threads().get(userId="me", id=thread_id).execute()
        messages = thread.get("messages", [])
        return len(messages) > 1  # Original + at least one reply
    except Exception:
        return False


def get_user_email(user) -> Optional[str]:
    """Get authenticated user's Gmail address."""
    try:
        service = _get_gmail_service(user)
        profile = service.users().getProfile(userId="me").execute()
        return profile.get("emailAddress")
    except Exception:
        return None
