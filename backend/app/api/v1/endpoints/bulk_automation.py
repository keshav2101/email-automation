import asyncio
import random
import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.core.security import get_current_user
from app.models.user import User
from app.models.email import EmailDraft, EmailMessage, AuditLog, SuppressionList
from app.models.company import HRContact
from app.services.email_sender import send_email_unified

router = APIRouter()

# In-memory job state store for live monitoring
JOBS_STORE: Dict[str, Dict[str, Any]] = {}


class StartBulkRequest(BaseModel):
    draft_ids: Optional[List[int]] = None
    send_all_approved: bool = False
    delay_seconds: int = 10
    random_jitter: int = 3
    daily_limit: int = 50
    dry_run: bool = False


class BulkJobStatusResponse(BaseModel):
    job_id: str
    status: str  # running, completed, cancelled, failed
    total: int
    sent: int
    failed: int
    skipped: int
    progress_percent: float
    current_recipient: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    logs: List[Dict[str, Any]] = []


def _run_bulk_automation_worker(
    job_id: str,
    user_id: int,
    draft_ids: List[int],
    delay_seconds: int,
    random_jitter: int,
    daily_limit: int,
    dry_run: bool,
):
    """
    Background worker loop that sequentially dispatches emails with rate-limiting,
    quota tracking, and safety checks.
    """
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            JOBS_STORE[job_id]["status"] = "failed"
            JOBS_STORE[job_id]["logs"].append({
                "time": datetime.utcnow().strftime("%H:%M:%S"),
                "status": "error",
                "message": "User not found",
            })
            return

        # Check today's sent count
        today_start = datetime.combine(date.today(), datetime.min.time())
        sent_today = db.query(EmailMessage).filter(
            EmailMessage.user_id == user.id,
            EmailMessage.sent_at >= today_start,
        ).count()

        # Pre-fetch suppression list
        suppressed = set(
            s[0].lower()
            for s in db.query(SuppressionList.email).filter(SuppressionList.user_id == user.id).all()
            if s[0]
        )

        job = JOBS_STORE[job_id]

        for i, draft_id in enumerate(draft_ids):
            # Check cancellation flag
            if job.get("cancel_requested"):
                job["status"] = "cancelled"
                job["logs"].append({
                    "time": datetime.utcnow().strftime("%H:%M:%S"),
                    "status": "warning",
                    "message": "Bulk automation was stopped by user.",
                })
                break

            # Daily limit check
            if sent_today >= daily_limit:
                job["logs"].append({
                    "time": datetime.utcnow().strftime("%H:%M:%S"),
                    "status": "warning",
                    "message": f"Daily limit reached ({daily_limit} emails). Pausing dispatch.",
                })
                job["status"] = "completed"
                break

            draft = db.query(EmailDraft).filter(
                EmailDraft.id == draft_id,
                EmailDraft.user_id == user.id,
            ).first()

            if not draft:
                job["skipped"] += 1
                continue

            recipient = (draft.recipient_email or "").strip().lower()
            job["current_recipient"] = recipient

            # Suppression check
            if recipient in suppressed:
                job["skipped"] += 1
                draft.status = "suppressed"
                db.commit()
                job["logs"].append({
                    "time": datetime.utcnow().strftime("%H:%M:%S"),
                    "status": "skipped",
                    "recipient": recipient,
                    "company": draft.company_id,
                    "message": f"Skipped {recipient} (in suppression list)",
                })
                continue

            try:
                if dry_run or user.draft_only_mode:
                    # Dry run / simulation
                    sim_id = f"<dryrun-{uuid.uuid4().hex[:8]}@local>"
                    result = {
                        "success": True,
                        "message_id": sim_id,
                        "provider": "dry_run",
                    }
                else:
                    # Live send via connected plugin
                    result = send_email_unified(
                        user=user,
                        to_email=recipient,
                        subject=draft.subject or "Application Inquiry",
                        body_text=draft.body or "",
                    )

                # Record message
                msg = EmailMessage(
                    draft_id=draft.id,
                    user_id=user.id,
                    gmail_message_id=result.get("message_id"),
                    sent_at=datetime.utcnow(),
                    status="sent",
                )
                db.add(msg)

                # Update draft
                draft.status = "sent"
                draft.gmail_message_id = result.get("message_id")

                # Update contact
                if draft.hr_contact_id:
                    contact = db.query(HRContact).filter(HRContact.id == draft.hr_contact_id).first()
                    if contact:
                        contact.outreach_status = "emailed"
                        contact.last_contacted_at = datetime.utcnow()

                # Audit log
                audit = AuditLog(
                    user_id=user.id,
                    action="bulk_email_sent",
                    resource_type="email_draft",
                    resource_id=draft.id,
                    details={
                        "recipient": recipient,
                        "provider": result.get("provider", "unified"),
                        "message_id": result.get("message_id"),
                        "job_id": job_id,
                    },
                )
                db.add(audit)
                db.commit()

                sent_today += 1
                job["sent"] += 1
                job["logs"].append({
                    "time": datetime.utcnow().strftime("%H:%M:%S"),
                    "status": "success",
                    "recipient": recipient,
                    "subject": draft.subject,
                    "message_id": result.get("message_id"),
                    "message": f"Successfully sent to {recipient}",
                })

            except Exception as e:
                db.rollback()
                job["failed"] += 1
                draft.status = "failed"
                db.commit()
                job["logs"].append({
                    "time": datetime.utcnow().strftime("%H:%M:%S"),
                    "status": "error",
                    "recipient": recipient,
                    "message": f"Failed sending to {recipient}: {str(e)}",
                })

            # Calculate progress
            processed = job["sent"] + job["failed"] + job["skipped"]
            job["progress_percent"] = round((processed / job["total"]) * 100, 1) if job["total"] > 0 else 100.0

            # Safe Throttling delay with natural jitter if not the last item
            if i < len(draft_ids) - 1:
                jitter = random.randint(-abs(random_jitter), abs(random_jitter))
                sleep_dur = max(2, delay_seconds + jitter)
                import time
                time.sleep(sleep_dur)

        if job["status"] == "running":
            job["status"] = "completed"
        job["completed_at"] = datetime.utcnow().isoformat()
        job["current_recipient"] = None

    except Exception as exc:
        if job_id in JOBS_STORE:
            JOBS_STORE[job_id]["status"] = "failed"
            JOBS_STORE[job_id]["logs"].append({
                "time": datetime.utcnow().strftime("%H:%M:%S"),
                "status": "error",
                "message": f"Worker crashed: {str(exc)}",
            })
    finally:
        db.close()


@router.post("/start", response_model=BulkJobStatusResponse)
def start_bulk_automation(
    payload: StartBulkRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start an automated bulk email sending job in the background.
    Respects provider throttling, daily quotas, and deliverability limits.
    """
    draft_ids = payload.draft_ids or []

    if payload.send_all_approved and not draft_ids:
        approved_drafts = db.query(EmailDraft.id).filter(
            EmailDraft.user_id == current_user.id,
            EmailDraft.status.in_(["approved", "draft"]),
            EmailDraft.recipient_email.isnot(None),
        ).all()
        draft_ids = [d[0] for d in approved_drafts]

    if not draft_ids:
        raise HTTPException(
            status_code=400,
            detail="No eligible drafts selected for bulk automation. Please approve drafts first.",
        )

    job_id = f"job-{uuid.uuid4().hex[:10]}"

    job_state = {
        "job_id": job_id,
        "user_id": current_user.id,
        "status": "running",
        "total": len(draft_ids),
        "sent": 0,
        "failed": 0,
        "skipped": 0,
        "progress_percent": 0.0,
        "current_recipient": None,
        "created_at": datetime.utcnow().isoformat(),
        "completed_at": None,
        "cancel_requested": False,
        "logs": [{
            "time": datetime.utcnow().strftime("%H:%M:%S"),
            "status": "info",
            "message": f"Bulk automation initiated for {len(draft_ids)} emails (delay: {payload.delay_seconds}s)",
        }],
    }

    JOBS_STORE[job_id] = job_state

    # Launch background thread / task
    background_tasks.add_task(
        _run_bulk_automation_worker,
        job_id=job_id,
        user_id=current_user.id,
        draft_ids=draft_ids,
        delay_seconds=payload.delay_seconds,
        random_jitter=payload.random_jitter,
        daily_limit=payload.daily_limit,
        dry_run=payload.dry_run,
    )

    return BulkJobStatusResponse(**job_state)


@router.get("/jobs/{job_id}", response_model=BulkJobStatusResponse)
def get_bulk_job_status(job_id: str, current_user: User = Depends(get_current_user)):
    """Retrieve real-time metrics and delivery logs for a bulk sending job."""
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")

    job = JOBS_STORE[job_id]
    if job.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to job")

    return BulkJobStatusResponse(**job)


@router.post("/jobs/{job_id}/cancel")
def cancel_bulk_job(job_id: str, current_user: User = Depends(get_current_user)):
    """Safely abort an active bulk sending automation."""
    if job_id not in JOBS_STORE:
        raise HTTPException(status_code=404, detail="Job not found")

    job = JOBS_STORE[job_id]
    if job.get("user_id") != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    job["cancel_requested"] = True
    job["logs"].append({
        "time": datetime.utcnow().strftime("%H:%M:%S"),
        "status": "warning",
        "message": "Cancellation requested. Finishing current email before halt...",
    })
    return {"message": "Job cancellation initiated", "job_id": job_id}


@router.get("/history", response_model=List[BulkJobStatusResponse])
def get_bulk_jobs_history(current_user: User = Depends(get_current_user)):
    """Return all recent bulk jobs for the current user."""
    user_jobs = [
        BulkJobStatusResponse(**j)
        for j in JOBS_STORE.values()
        if j.get("user_id") == current_user.id
    ]
    user_jobs.reverse()
    return user_jobs[:20]
