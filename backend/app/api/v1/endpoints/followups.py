from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.email import EmailDraft, FollowUpTask
from app.models.candidate import CandidateProfile
from app.services.ai_service import generate_followup_email

router = APIRouter()


class CreateFollowUpRequest(BaseModel):
    original_draft_id: int
    sequence_number: int = 1
    days_after: int = 7


@router.post("/schedule")
async def schedule_followup(
    data: CreateFollowUpRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = db.query(EmailDraft).filter(
        EmailDraft.id == data.original_draft_id,
        EmailDraft.user_id == current_user.id,
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Original draft not found")

    profile = db.query(CandidateProfile).filter(
        CandidateProfile.user_id == current_user.id
    ).first()

    # Generate follow-up content
    followup_content = await generate_followup_email(
        original_subject=draft.subject,
        original_body=draft.body,
        company_name=str(draft.company_id),  # Will be enriched with company name in production
        hr_name=draft.recipient_name,
        candidate_name=profile.full_name if profile else current_user.full_name,
        sequence_number=data.sequence_number,
    )

    scheduled_for = datetime.utcnow() + timedelta(days=data.days_after)

    task = FollowUpTask(
        user_id=current_user.id,
        original_draft_id=draft.id,
        hr_contact_id=draft.hr_contact_id,
        sequence_number=data.sequence_number,
        scheduled_for=scheduled_for,
        subject=followup_content.get("subject", f"Re: {draft.subject}"),
        body=followup_content.get("body", ""),
        status="pending",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "followup_id": task.id,
        "scheduled_for": task.scheduled_for,
        "subject": task.subject,
        "body": task.body,
        "sequence_number": task.sequence_number,
    }


@router.get("/")
def list_followups(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(FollowUpTask).filter(FollowUpTask.user_id == current_user.id)
    if status:
        query = query.filter(FollowUpTask.status == status)
    return query.order_by(FollowUpTask.scheduled_for).all()


@router.post("/{followup_id}/cancel")
def cancel_followup(
    followup_id: int,
    reason: str = "manual_cancel",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(FollowUpTask).filter(
        FollowUpTask.id == followup_id,
        FollowUpTask.user_id == current_user.id,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    task.status = "cancelled"
    task.cancel_reason = reason
    db.commit()
    return {"message": "Follow-up cancelled"}
