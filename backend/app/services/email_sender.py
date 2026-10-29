import smtplib
import ssl
import time
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from datetime import datetime
from typing import Dict, Any, Optional

from app.models.user import User


def test_smtp_connection(
    host: str,
    port: int,
    username: str,
    password: str,
    use_tls: bool = True,
    timeout: int = 15,
) -> Dict[str, Any]:
    """
    Test connectivity and credentials against an SMTP server.
    Returns latency, server greeting, and success status.
    """
    u = username.strip()
    # Strip spaces and dashes from App Passwords (e.g. Google's 4x4 format "abcd efgh ijkl mnop")
    p = password.strip().replace(" ", "").replace("-", "") if (len(password.strip()) in (16, 19) or "gmail" in host.lower()) else password.strip()

    start_time = time.time()
    server = None
    try:
        if port == 465:
            # SSL directly
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(host, port, context=context, timeout=timeout)
        else:
            # STARTTLS
            server = smtplib.SMTP(host, port, timeout=timeout)
            server.ehlo()
            if use_tls:
                context = ssl.create_default_context()
                server.starttls(context=context)
                server.ehlo()

        # Modern mail servers (like Google SMTP) drop the TCP connection immediately upon invalid auth.
        # smtplib's default login() tries fallback auth mechanisms on that closed socket, throwing
        # SMTPServerDisconnected instead of SMTPAuthenticationError. We restrict to PLAIN to get clean feedback.
        if server.has_extn("auth"):
            authlist = server.esmtp_features["auth"].split()
            if "PLAIN" in authlist:
                server.esmtp_features["auth"] = "PLAIN"

        # Authenticate
        server.login(u, p)
        server.quit()

        latency_ms = round((time.time() - start_time) * 1000)
        return {
            "success": True,
            "latency_ms": latency_ms,
            "message": f"Successfully authenticated with {host} ({latency_ms}ms)",
        }
    except smtplib.SMTPAuthenticationError as e:
        err_msg = (
            "Gmail Authentication Failed (535 5.7.8 Bad Credentials). "
            "Please check: 1) 2-Step Verification is turned ON in your Google account, 2) You are using the 16-character App Password generated at myaccount.google.com/apppasswords (do NOT use your normal Gmail account password)."
            if "gmail" in host.lower()
            else f"SMTP Authentication failed for {u}: Invalid password or username."
        )
        return {
            "success": False,
            "error": err_msg,
            "details": str(e),
        }
    except smtplib.SMTPServerDisconnected as e:
        err_msg = (
            "Gmail Handshake Rejected (535 Bad Credentials). "
            "Google rejected the credentials and closed the connection. "
            "Please check: 1) 2-Step Verification is enabled on your Google account, 2) You are using the 16-letter App Password generated at myaccount.google.com/apppasswords."
            if "gmail" in host.lower()
            else f"Connection closed by {host}:{port} during authentication. Please check credentials or firewall."
        )
        return {
            "success": False,
            "error": err_msg,
            "details": str(e),
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to connect to {host}:{port} — {str(e)}",
            "details": str(e),
        }
    finally:
        if server:
            try:
                server.close()
            except Exception:
                pass


def send_email_via_smtp(
    user: User,
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    in_reply_to: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send an email using the user's connected SMTP plugin credentials.
    """
    host = user.smtp_host or "smtp.gmail.com"
    port = user.smtp_port or 587
    username = (user.smtp_user or user.email).strip()
    raw_password = (user.smtp_password or "").strip()
    password = raw_password.replace(" ", "").replace("-", "") if (len(raw_password) in (16, 19) or "gmail" in host.lower()) else raw_password
    use_tls = user.smtp_use_tls if user.smtp_use_tls is not None else True
    from_name = user.smtp_from_name or user.full_name or "Recruiter Outreach"

    if not password:
        raise ValueError("SMTP password / app password is not configured")

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{from_name} <{username}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    
    # Generate unique Message-ID
    domain = username.split("@")[-1] if "@" in username else "outreach.local"
    msg_id = make_msgid(domain=domain)
    msg["Message-ID"] = msg_id

    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to

    # Attach plain text
    part_text = MIMEText(body_text, "plain", "utf-8")
    msg.attach(part_text)

    # Attach HTML version if provided
    if body_html:
        part_html = MIMEText(body_html, "html", "utf-8")
        msg.attach(part_html)

    # Connect and send
    server = None
    try:
        if port == 465:
            context = ssl.create_default_context()
            server = smtplib.SMTP_SSL(host, port, context=context, timeout=20)
        else:
            server = smtplib.SMTP(host, port, timeout=20)
            server.ehlo()
            if use_tls:
                context = ssl.create_default_context()
                server.starttls(context=context)
                server.ehlo()

        if server.has_extn("auth"):
            authlist = server.esmtp_features["auth"].split()
            if "PLAIN" in authlist:
                server.esmtp_features["auth"] = "PLAIN"

        server.login(username, password)
        server.sendmail(username, [to_email], msg.as_string())
        server.quit()
    finally:
        if server:
            try:
                server.close()
            except Exception:
                pass

    return {
        "success": True,
        "message_id": msg_id,
        "sent_at": datetime.utcnow().isoformat(),
        "provider": user.email_plugin_type or "smtp",
    }


def send_email_unified(
    user: User,
    to_email: str,
    subject: str,
    body_text: str,
    body_html: Optional[str] = None,
    in_reply_to: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Unified router that sends via the active connected plugin:
    1. SMTP Plugin (Gmail App Password, Outlook, Custom)
    2. Gmail OAuth (if tokens present)
    3. Simulation mode (if simulation or draft_only_mode)
    """
    # Check if SMTP plugin is connected
    if user.email_connected and user.smtp_password:
        return send_email_via_smtp(
            user=user,
            to_email=to_email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            in_reply_to=in_reply_to,
        )

    # Check if Gmail OAuth is connected
    if user.gmail_connected and user.gmail_access_token:
        from app.services.gmail_service import send_message as send_gmail_oauth
        return send_gmail_oauth(
            user=user,
            to=to_email,
            subject=subject,
            body=body_text,
        )

    # Fallback to simulation mode
    sim_id = f"<sim-{uuid.uuid4().hex[:12]}@simulation.local>"
    return {
        "success": True,
        "message_id": sim_id,
        "sent_at": datetime.utcnow().isoformat(),
        "provider": "simulation",
        "note": "Sent in simulation mode (connect an email plugin in Settings for live sending)",
    }
