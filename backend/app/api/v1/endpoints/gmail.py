from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.email import EmailDraft, EmailMessage, AuditLog, SuppressionList
from app.services.gmail_service import create_draft, send_message, get_auth_url, exchange_code_for_tokens, get_user_email

router = APIRouter()


@router.get("/auth-url")
def gmail_auth_url(current_user: User = Depends(get_current_user)):
    from app.core.config import settings
    cid = settings.GOOGLE_CLIENT_ID or ""
    csec = settings.GOOGLE_CLIENT_SECRET or ""
    if not cid or "your-google" in cid or not csec or "your-google" in csec:
        raise HTTPException(
            status_code=400,
            detail="Google Cloud OAuth credentials not configured in .env. Recommended: Connect Gmail in 15 seconds using the Gmail App Password plugin in Settings (zero Google Cloud setup required)."
        )
    try:
        return {"auth_url": get_auth_url()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google OAuth configuration error: {str(e)}")


@router.get("/callback")
def gmail_callback(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tokens = exchange_code_for_tokens(code)
    current_user.gmail_access_token = tokens["access_token"]
    current_user.gmail_refresh_token = tokens.get("refresh_token")
    current_user.gmail_connected = True

    gmail_email = get_user_email(current_user)
    if gmail_email:
        current_user.gmail_email = gmail_email

    db.commit()
    return {"message": "Gmail connected successfully", "gmail_email": gmail_email}


@router.post("/disconnect")
def gmail_disconnect(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.gmail_access_token = None
    current_user.gmail_refresh_token = None
    current_user.gmail_connected = False
    current_user.gmail_email = None
    db.commit()
    return {"message": "Gmail disconnected"}


@router.post("/drafts/{draft_id}/push-to-gmail")
def push_draft_to_gmail(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a Gmail draft from an approved draft."""
    if not current_user.gmail_connected:
        raise HTTPException(status_code=400, detail="Gmail not connected. Please connect Gmail first.")

    draft = db.query(EmailDraft).filter(
        EmailDraft.id == draft_id, EmailDraft.user_id == current_user.id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status not in ("approved", "draft"):
        raise HTTPException(status_code=400, detail=f"Draft status is {draft.status}")
    if not draft.recipient_email:
        raise HTTPException(status_code=400, detail="No recipient email set")

    try:
        gmail_draft_id = create_draft(
            user=current_user,
            to=draft.recipient_email,
            subject=draft.subject,
            body=draft.body,
        )
        draft.gmail_draft_id = gmail_draft_id
        draft.status = "approved"

        audit = AuditLog(
            user_id=current_user.id,
            action="gmail_draft_created",
            entity_type="email_draft",
            entity_id=draft.id,
            details={"gmail_draft_id": gmail_draft_id, "to": draft.recipient_email},
        )
        db.add(audit)
        db.commit()
        return {"message": "Draft pushed to Gmail", "gmail_draft_id": gmail_draft_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail error: {str(e)}")


@router.post("/drafts/{draft_id}/send")
def send_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send an approved draft via Gmail API."""
    if current_user.draft_only_mode:
        raise HTTPException(
            status_code=400,
            detail="Draft-only mode is enabled. Disable it in Settings to send emails."
        )
    if not current_user.send_enabled:
        raise HTTPException(status_code=400, detail="Email sending is not enabled. Enable it in Settings.")
    if not current_user.gmail_connected:
        raise HTTPException(status_code=400, detail="Gmail not connected.")

    draft = db.query(EmailDraft).filter(
        EmailDraft.id == draft_id, EmailDraft.user_id == current_user.id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status != "approved":
        raise HTTPException(status_code=400, detail="Draft must be approved before sending")
    if not draft.recipient_email:
        raise HTTPException(status_code=400, detail="No recipient email")

    # Check suppression
    suppressed = db.query(SuppressionList).filter(
        SuppressionList.user_id == current_user.id,
        SuppressionList.email == draft.recipient_email,
    ).first()
    if suppressed:
        draft.status = "suppressed"
        db.commit()
        raise HTTPException(status_code=400, detail="Recipient is suppressed")

    try:
        result = send_message(
            user=current_user,
            to=draft.recipient_email,
            subject=draft.subject,
            body=draft.body,
        )
        draft.status = "sent"
        draft.gmail_message_id = result.get("id")

        msg = EmailMessage(
            draft_id=draft.id,
            user_id=current_user.id,
            gmail_message_id=result.get("id"),
            gmail_thread_id=result.get("threadId"),
            sent_at=datetime.utcnow(),
            status="sent",
        )
        db.add(msg)

        audit = AuditLog(
            user_id=current_user.id,
            action="email_sent",
            entity_type="email_draft",
            entity_id=draft.id,
            details={"to": draft.recipient_email, "subject": draft.subject},
        )
        db.add(audit)
        db.commit()
        return {"message": "Email sent successfully", "gmail_message_id": result.get("id")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Send failed: {str(e)}")
