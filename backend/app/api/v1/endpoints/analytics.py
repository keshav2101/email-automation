from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import Company, HRContact
from app.models.email import EmailDraft, EmailMessage, FollowUpTask

router = APIRouter()


@router.get("/dashboard")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    uid = current_user.id

    total_companies = db.query(func.count(Company.id)).filter(Company.user_id == uid).scalar()
    total_contacts = db.query(func.count(HRContact.id)).filter(HRContact.user_id == uid).scalar()

    drafts = db.query(func.count(EmailDraft.id)).filter(EmailDraft.user_id == uid).scalar()
    approved = db.query(func.count(EmailDraft.id)).filter(
        EmailDraft.user_id == uid, EmailDraft.status == "approved"
    ).scalar()
    sent = db.query(func.count(EmailDraft.id)).filter(
        EmailDraft.user_id == uid, EmailDraft.status == "sent"
    ).scalar()

    replies = db.query(func.count(EmailMessage.id)).filter(
        EmailMessage.user_id == uid, EmailMessage.reply_received == True
    ).scalar()

    followups_due = db.query(func.count(FollowUpTask.id)).filter(
        FollowUpTask.user_id == uid, FollowUpTask.status == "pending"
    ).scalar()

    # Company status breakdown
    status_counts = db.query(
        Company.outreach_status, func.count(Company.id)
    ).filter(Company.user_id == uid).group_by(Company.outreach_status).all()
    status_breakdown = {s: c for s, c in status_counts}

    is_connected = bool(current_user.email_connected or current_user.gmail_connected)
    connected_email = current_user.smtp_user if current_user.email_connected else current_user.gmail_email
    plugin_type = current_user.email_plugin_type or ("gmail_oauth" if current_user.gmail_connected else "simulation")

    return {
        "total_companies": total_companies,
        "total_contacts": total_contacts,
        "emails_drafted": drafts,
        "emails_approved": approved,
        "emails_sent": sent,
        "replies_received": replies,
        "followups_due": followups_due,
        "company_status_breakdown": status_breakdown,
        "gmail_connected": is_connected,
        "email_connected": is_connected,
        "connected_email": connected_email,
        "plugin_type": plugin_type,
        "draft_only_mode": current_user.draft_only_mode,
        "send_enabled": current_user.send_enabled,
    }
