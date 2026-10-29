from datetime import datetime
from app.tasks.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.email import FollowUpTask, EmailDraft, EmailMessage, AuditLog
from app.models.company import HRContact
from app.services.gmail_service import send_message, check_for_replies
import structlog

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.email_tasks.send_scheduled_followups")
def send_scheduled_followups():
    """Send follow-up emails that are due and haven't been replied to."""
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        pending = db.query(FollowUpTask).filter(
            FollowUpTask.status == "pending",
            FollowUpTask.scheduled_for <= now,
        ).all()

        sent_count = 0
        for task in pending:
            try:
                # Check if original email got a reply
                original_draft = db.query(EmailDraft).get(task.original_draft_id)
                if not original_draft:
                    task.status = "cancelled"
                    task.cancel_reason = "original_draft_not_found"
                    continue

                # Check HR contact opt-out
                if task.hr_contact_id:
                    contact = db.query(HRContact).get(task.hr_contact_id)
                    if contact and (contact.opted_out or contact.reply_received):
                        task.status = "skipped"
                        task.cancel_reason = "reply_received_or_opted_out"
                        continue

                # Check if we have the user and Gmail connected
                from app.models.user import User
                user = db.query(User).get(task.user_id)
                if not user or not user.gmail_connected or user.draft_only_mode:
                    continue

                # Send follow-up
                recipient_email = original_draft.recipient_email
                if not recipient_email:
                    task.status = "cancelled"
                    task.cancel_reason = "no_recipient_email"
                    continue

                result = send_message(
                    user=user,
                    to=recipient_email,
                    subject=task.subject,
                    body=task.body,
                )

                task.status = "sent"
                msg = EmailMessage(
                    draft_id=original_draft.id,
                    user_id=task.user_id,
                    gmail_message_id=result.get("id"),
                    sent_at=now,
                    status="sent",
                )
                db.add(msg)

                audit = AuditLog(
                    user_id=task.user_id,
                    action="followup_sent",
                    entity_type="follow_up_task",
                    entity_id=task.id,
                    details={"sequence": task.sequence_number, "to": recipient_email},
                )
                db.add(audit)
                sent_count += 1

            except Exception as e:
                logger.error("Failed to send follow-up", task_id=task.id, error=str(e))

        db.commit()
        logger.info("Follow-up task completed", sent=sent_count, checked=len(pending))

    finally:
        db.close()


@celery_app.task(name="app.tasks.email_tasks.sync_gmail_replies")
def sync_gmail_replies():
    """Check sent emails for replies."""
    db = SessionLocal()
    try:
        sent_messages = db.query(EmailMessage).filter(
            EmailMessage.status == "sent",
            EmailMessage.reply_received == False,
            EmailMessage.gmail_thread_id.isnot(None),
        ).all()

        for msg in sent_messages:
            try:
                from app.models.user import User
                user = db.query(User).get(msg.user_id)
                if not user or not user.gmail_connected:
                    continue

                has_reply = check_for_replies(user, msg.gmail_thread_id)
                if has_reply:
                    msg.reply_received = True
                    msg.reply_at = datetime.utcnow()

                    # Update HR contact
                    draft = db.query(EmailDraft).get(msg.draft_id)
                    if draft and draft.hr_contact_id:
                        contact = db.query(HRContact).get(draft.hr_contact_id)
                        if contact:
                            contact.reply_received = True

                    # Cancel pending follow-ups for this draft
                    db.query(FollowUpTask).filter(
                        FollowUpTask.original_draft_id == msg.draft_id,
                        FollowUpTask.status == "pending",
                    ).update({"status": "cancelled", "cancel_reason": "reply_received"})

            except Exception as e:
                logger.error("Reply sync failed", message_id=msg.id, error=str(e))

        db.commit()
    finally:
        db.close()
