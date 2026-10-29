from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import Company, HRContact, CompanyResearch
from app.models.candidate import CandidateProfile
from app.models.email import EmailDraft, SuppressionList, AuditLog
from app.services.ai_service import generate_personalized_email

router = APIRouter()


class GenerateDraftRequest(BaseModel):
    company_id: int
    hr_contact_id: Optional[int] = None
    job_opportunity_id: Optional[int] = None
    target_role: str
    job_description: Optional[str] = None
    style: str = "professional"
    attach_resume: bool = True
    resume_version_id: Optional[int] = None
    application_type: str = "speculative"


class DraftResponse(BaseModel):
    id: int
    company_id: int
    subject: str
    body: str
    recipient_email: Optional[str]
    recipient_name: Optional[str]
    target_role: Optional[str]
    style: str
    status: str
    confidence_score: int
    personalization_notes: Optional[str]
    source_urls: List

    class Config:
        from_attributes = True


@router.post("/generate", status_code=201)
async def generate_draft(
    data: GenerateDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get company
    company = db.query(Company).filter(
        Company.id == data.company_id, Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Check suppression
    hr_contact = None
    if data.hr_contact_id:
        hr_contact = db.query(HRContact).filter(HRContact.id == data.hr_contact_id).first()
        if hr_contact and hr_contact.email:
            suppressed = db.query(SuppressionList).filter(
                SuppressionList.user_id == current_user.id,
                SuppressionList.email == hr_contact.email,
            ).first()
            if suppressed:
                raise HTTPException(status_code=400, detail="Recipient is on suppression list")

    # Get research
    research = db.query(CompanyResearch).filter(
        CompanyResearch.company_id == company.id,
        CompanyResearch.user_id == current_user.id,
    ).first()
    research_dict = {}
    if research:
        research_dict = {
            "matching_skills": research.matching_skills or [],
            "matching_projects": research.matching_projects or [],
            "candidate_match_explanation": research.candidate_match_explanation or "",
        }

    # Get candidate profile
    profile = db.query(CandidateProfile).filter(
        CandidateProfile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Candidate profile not found. Please set up your profile first.")

    profile_dict = {
        "full_name": profile.full_name or current_user.full_name,
        "email": profile.email,
        "phone": profile.phone,
        "linkedin_url": profile.linkedin_url,
        "github_url": profile.github_url,
        "university": profile.university,
        "degree": profile.degree,
        "field_of_study": profile.field_of_study,
        "graduation_year": profile.graduation_year,
        "technical_skills": profile.technical_skills or [],
        "programming_languages": profile.programming_languages or [],
        "projects": profile.projects or [],
        "internships": profile.internships or [],
        "research_papers": profile.research_papers or [],
    }

    # Generate email
    result = await generate_personalized_email(
        company_name=company.name,
        company_domain=company.domain or company.industry or "",
        hr_name=hr_contact.name if hr_contact else None,
        target_role=data.target_role,
        job_description=data.job_description,
        candidate_profile=profile_dict,
        research=research_dict,
        style=data.style,
    )

    # Save draft
    draft = EmailDraft(
        user_id=current_user.id,
        company_id=company.id,
        hr_contact_id=data.hr_contact_id,
        job_opportunity_id=data.job_opportunity_id,
        research_id=research.id if research else None,
        resume_version_id=data.resume_version_id,
        subject=result.get("subject", f"Application — {data.target_role}"),
        body=result.get("body", ""),
        formal_version=result.get("formal_version", ""),
        concise_version=result.get("concise_version", ""),
        conversational_version=result.get("conversational_version", ""),
        style=data.style,
        recipient_email=hr_contact.email if hr_contact else None,
        recipient_name=hr_contact.name if hr_contact else None,
        target_role=data.target_role,
        matching_skills=result.get("matching_skills", research_dict.get("matching_skills", [])),
        highlighted_project=result.get("highlighted_project", ""),
        personalization_notes=result.get("personalization_notes", ""),
        confidence_score=result.get("confidence_score", 0),
        status="draft",
        attach_resume=data.attach_resume,
    )
    db.add(draft)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="draft_generated",
        entity_type="email_draft",
        details={"company": company.name, "role": data.target_role},
    )
    db.add(audit)
    db.commit()
    db.refresh(draft)

    return {
        "draft_id": draft.id,
        "subject": draft.subject,
        "body": draft.body,
        "formal_version": draft.formal_version,
        "concise_version": draft.concise_version,
        "conversational_version": draft.conversational_version,
        "personalization_notes": draft.personalization_notes,
        "confidence_score": draft.confidence_score,
        "highlighted_project": draft.highlighted_project,
        "status": draft.status,
    }


@router.get("/")
def list_drafts(
    status: Optional[str] = None,
    company_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(EmailDraft).filter(EmailDraft.user_id == current_user.id)
    if status:
        query = query.filter(EmailDraft.status == status)
    if company_id:
        query = query.filter(EmailDraft.company_id == company_id)
    drafts = query.order_by(EmailDraft.id.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": d.id,
            "company_id": d.company_id,
            "subject": d.subject,
            "recipient_email": d.recipient_email,
            "recipient_name": d.recipient_name,
            "target_role": d.target_role,
            "status": d.status,
            "confidence_score": d.confidence_score,
            "created_at": d.created_at,
        }
        for d in drafts
    ]


@router.get("/{draft_id}")
def get_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = db.query(EmailDraft).filter(
        EmailDraft.id == draft_id, EmailDraft.user_id == current_user.id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return draft


@router.patch("/{draft_id}")
def update_draft(
    draft_id: int,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = db.query(EmailDraft).filter(
        EmailDraft.id == draft_id, EmailDraft.user_id == current_user.id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status in ("sent", "suppressed"):
        raise HTTPException(status_code=400, detail="Cannot edit a sent draft")

    allowed = {"subject", "body", "style", "scheduled_for", "attach_resume", "resume_version_id"}
    for key, value in updates.items():
        if key in allowed:
            setattr(draft, key, value)

    db.commit()
    db.refresh(draft)
    return {"message": "Draft updated", "draft_id": draft.id}


@router.post("/{draft_id}/approve")
def approve_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = db.query(EmailDraft).filter(
        EmailDraft.id == draft_id, EmailDraft.user_id == current_user.id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if draft.status != "draft":
        raise HTTPException(status_code=400, detail=f"Draft is already {draft.status}")

    draft.status = "approved"
    draft.approved_at = datetime.utcnow()

    audit = AuditLog(
        user_id=current_user.id,
        action="draft_approved",
        entity_type="email_draft",
        entity_id=draft.id,
        details={"subject": draft.subject},
    )
    db.add(audit)
    db.commit()
    return {"message": "Draft approved and ready to send", "draft_id": draft.id}


@router.delete("/{draft_id}")
def delete_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    draft = db.query(EmailDraft).filter(
        EmailDraft.id == draft_id, EmailDraft.user_id == current_user.id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    db.delete(draft)
    db.commit()
    return {"message": "Draft deleted"}
