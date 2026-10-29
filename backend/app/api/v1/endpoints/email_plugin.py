from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.email_sender import test_smtp_connection, send_email_via_smtp

router = APIRouter()

PRESETS = {
    "gmail": {
        "host": "smtp.gmail.com",
        "port": 587,
        "use_tls": True,
        "label": "Gmail / Google Workspace (App Password)",
    },
    "outlook": {
        "host": "smtp.office365.com",
        "port": 587,
        "use_tls": True,
        "label": "Microsoft Outlook / Office 365",
    },
    "yahoo": {
        "host": "smtp.mail.yahoo.com",
        "port": 587,
        "use_tls": True,
        "label": "Yahoo Mail",
    },
    "zoho": {
        "host": "smtp.zoho.com",
        "port": 587,
        "use_tls": True,
        "label": "Zoho Mail",
    },
    "custom": {
        "host": "",
        "port": 587,
        "use_tls": True,
        "label": "Custom SMTP Server",
    },
}


class ConnectSmtpRequest(BaseModel):
    provider: str = "gmail"  # gmail, outlook, yahoo, zoho, custom
    email: EmailStr
    password: Optional[str] = None  # App Password or SMTP password (optional if already connected)
    from_name: Optional[str] = None
    custom_host: Optional[str] = None
    custom_port: Optional[int] = 587
    use_tls: bool = True
    test_before_saving: bool = True


class TestConnectionRequest(BaseModel):
    provider: Optional[str] = "gmail"
    host: Optional[str] = None
    port: Optional[int] = 587
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    use_tls: Optional[bool] = True


@router.get("/status")
def get_email_plugin_status(current_user: User = Depends(get_current_user)):
    """Return active email plugin connection status and settings."""
    connected = bool(current_user.email_connected or current_user.gmail_connected)
    active_type = "gmail_oauth" if current_user.gmail_connected else (current_user.email_plugin_type or "simulation")
    active_email = current_user.smtp_user if current_user.email_connected else current_user.gmail_email

    return {
        "connected": connected,
        "plugin_type": active_type,
        "email": active_email or current_user.email,
        "sender_email": active_email or current_user.email,
        "from_name": current_user.smtp_from_name or current_user.full_name,
        "host": current_user.smtp_host,
        "port": current_user.smtp_port,
        "daily_limit": current_user.daily_send_limit,
        "draft_only_mode": current_user.draft_only_mode,
        "send_enabled": current_user.send_enabled,
        "connected_at": current_user.email_connected_at.isoformat() if current_user.email_connected_at else None,
        "available_presets": PRESETS,
    }


@router.post("/test-connection")
def test_connection_endpoint(
    data: TestConnectionRequest,
    current_user: User = Depends(get_current_user),
):
    """Perform a live handshake with an SMTP server to verify credentials."""
    preset = PRESETS.get(data.provider or "gmail", PRESETS["custom"])
    host = data.host or (preset["host"] if preset["host"] else current_user.smtp_host) or "smtp.gmail.com"
    port = data.port or preset["port"] or current_user.smtp_port or 587
    use_tls = data.use_tls if data.use_tls is not None else preset.get("use_tls", True)

    username = (data.email or data.username or current_user.smtp_user or current_user.email or "").strip()
    raw_password = data.password if data.password is not None else current_user.smtp_password

    if not username:
        raise HTTPException(status_code=400, detail="Please enter your email address for the handshake test")
    if not raw_password:
        raise HTTPException(status_code=400, detail="Please enter your 16-character App Password to test the connection")

    clean_password = raw_password.strip().replace(" ", "").replace("-", "")

    result = test_smtp_connection(
        host=host,
        port=port,
        username=username,
        password=clean_password,
        use_tls=use_tls,
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to connect to SMTP server"),
        )
    return result


@router.post("/connect-smtp")
def connect_smtp_plugin(
    data: ConnectSmtpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Connect an email account via SMTP plugin (Gmail App Password, Outlook, etc.).
    Verifies credentials and saves connection.
    """
    preset = PRESETS.get(data.provider, PRESETS["custom"])
    host = data.custom_host if data.provider == "custom" and data.custom_host else preset["host"]
    port = data.custom_port if data.provider == "custom" and data.custom_port else preset["port"]
    use_tls = data.use_tls

    if not host:
        raise HTTPException(status_code=400, detail="SMTP Host cannot be empty")

    clean_password = (data.password.strip().replace(" ", "").replace("-", "") if data.password else current_user.smtp_password) or ""
    if not clean_password:
        raise HTTPException(status_code=400, detail="Please enter your 16-character App Password")

    # Optional test verification before saving
    if data.test_before_saving:
        test_res = test_smtp_connection(
            host=host,
            port=port,
            username=str(data.email).strip(),
            password=clean_password,
            use_tls=use_tls,
        )
        if not test_res.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Verification failed: {test_res.get('error')}",
            )

    # Save to user record
    current_user.email_plugin_type = f"smtp_{data.provider}"
    current_user.smtp_host = host
    current_user.smtp_port = port
    current_user.smtp_user = str(data.email).strip()
    current_user.smtp_password = clean_password
    current_user.smtp_use_tls = use_tls
    current_user.smtp_from_name = data.from_name or current_user.full_name
    current_user.email_connected = True
    current_user.email_connected_at = datetime.utcnow()
    current_user.send_enabled = True

    db.commit()

    return {
        "status": "connected",
        "plugin_type": current_user.email_plugin_type,
        "email": current_user.smtp_user,
        "sender_email": current_user.smtp_user,
        "from_name": current_user.smtp_from_name,
        "host": current_user.smtp_host,
        "message": f"Successfully connected email plugin ({data.provider.capitalize()})",
    }


@router.post("/disconnect")
def disconnect_email_plugin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disconnect active email plugin and remove saved credentials."""
    current_user.email_connected = False
    current_user.smtp_password = None
    current_user.email_plugin_type = "simulation"
    db.commit()
    return {"message": "Email plugin disconnected successfully"}


class SendTestEmailRequest(BaseModel):
    to_email: Optional[str] = None


@router.post("/send-test")
def send_test_email_endpoint(
    data: Optional[SendTestEmailRequest] = None,
    current_user: User = Depends(get_current_user),
):
    """Send a live test email to verify mailbox transmission end-to-end."""
    if not (current_user.email_connected and current_user.smtp_password):
        raise HTTPException(
            status_code=400,
            detail="No email plugin is connected. Please connect your Gmail or SMTP account first.",
        )

    target_email = (data.to_email if data and data.to_email else current_user.smtp_user or current_user.email or "").strip()
    if not target_email:
        raise HTTPException(status_code=400, detail="Recipient email cannot be empty.")

    sender_name = current_user.smtp_from_name or current_user.full_name or "Alex Candidate"
    subject = "HR Email Automation — Plugin Test Successful! 🎉"
    body_text = (
        f"Hi {sender_name},\n\n"
        "Congratulations! Your Gmail connection has been verified and configured successfully.\n\n"
        f"• Connected Sender: {current_user.smtp_user}\n"
        f"• SMTP Protocol: {current_user.smtp_host}:{current_user.smtp_port} (STARTTLS)\n"
        f"• Timestamp: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
        "Your automated bulk outreach and resume extraction pipelines are ready to deliver emails.\n\n"
        "— HR Outreach AI Automation Engine"
    )
    body_html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div style="background: #10b981; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">✓</div>
        <h2 style="margin: 0; color: #0f172a; font-size: 20px;">Email Plugin Verified &amp; Active</h2>
      </div>
      <p style="color: #334155; line-height: 1.6; font-size: 14px;">
        Hi <strong>{sender_name}</strong>,
      </p>
      <p style="color: #334155; line-height: 1.6; font-size: 14px;">
        Great news! Your connected Gmail sender plugin is functioning smoothly. Automated personalized outreach can now be dispatched directly from your mailbox.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; font-size: 13px; color: #475569; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; font-weight: 600; width: 140px;">Sender Mailbox:</td><td>{current_user.smtp_user}</td></tr>
          <tr><td style="padding: 4px 0; font-weight: 600;">SMTP Protocol:</td><td>{current_user.smtp_host}:{current_user.smtp_port} (STARTTLS)</td></tr>
          <tr><td style="padding: 4px 0; font-weight: 600;">Security Status:</td><td>16-Character App Password Authenticated</td></tr>
          <tr><td style="padding: 4px 0; font-weight: 600;">Timestamp:</td><td>{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</td></tr>
        </table>
      </div>
      <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        Sent via HR Email Automation Platform.
      </p>
    </div>
    """

    try:
        result = send_email_via_smtp(
            user=current_user,
            to_email=target_email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
        )
        return {
            "success": True,
            "to_email": target_email,
            "message_id": result.get("message_id"),
            "sent_at": result.get("sent_at"),
            "message": f"Test email sent successfully to {target_email}! Please check your inbox.",
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to transmit test email: {str(e)}",
        )
