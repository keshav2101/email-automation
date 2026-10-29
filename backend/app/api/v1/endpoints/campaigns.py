from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.email import EmailDraft, EmailCampaign

router = APIRouter()


class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    target_role: Optional[str] = None
    resume_version_id: Optional[int] = None


@router.get("/")
def list_campaigns(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(EmailCampaign).filter(EmailCampaign.user_id == current_user.id).all()


@router.post("/", status_code=201)
def create_campaign(
    data: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = EmailCampaign(user_id=current_user.id, **data.dict())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(EmailCampaign).filter(
        EmailCampaign.id == campaign_id, EmailCampaign.user_id == current_user.id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Get associated drafts
    drafts = db.query(EmailDraft).filter(
        EmailDraft.campaign_id == campaign_id
    ).all()

    return {
        "campaign": campaign,
        "drafts": [
            {
                "id": d.id,
                "company_id": d.company_id,
                "subject": d.subject,
                "status": d.status,
                "recipient_email": d.recipient_email,
            }
            for d in drafts
        ],
    }
