from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import Company, CompanyResearch
from app.models.candidate import CandidateProfile
from app.services.ai_service import research_company

router = APIRouter()


class ResearchRequest(BaseModel):
    company_id: int


@router.post("/")
async def run_company_research(
    data: ResearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(
        Company.id == data.company_id, Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    profile = db.query(CandidateProfile).filter(
        CandidateProfile.user_id == current_user.id
    ).first()

    candidate_skills = []
    candidate_projects = []
    if profile:
        candidate_skills = (profile.technical_skills or []) + (profile.programming_languages or [])
        candidate_projects = profile.projects or []

    # Run AI research
    result = await research_company(
        company_name=company.name,
        company_website=company.website or "",
        industry=company.industry or company.domain or "",
        candidate_skills=candidate_skills,
        candidate_projects=candidate_projects,
    )

    # Save or update research
    research = db.query(CompanyResearch).filter(
        CompanyResearch.company_id == company.id,
        CompanyResearch.user_id == current_user.id,
    ).first()

    if not research:
        research = CompanyResearch(
            company_id=company.id,
            user_id=current_user.id,
        )
        db.add(research)

    research.business_summary = result.get("business_summary", "")
    research.key_products = result.get("key_products", [])
    research.tech_stack = result.get("tech_stack", [])
    research.hiring_signals = result.get("hiring_signals", [])
    research.candidate_match_explanation = result.get("candidate_match_explanation", "")
    research.matching_skills = result.get("matching_skills", [])
    research.matching_projects = result.get("matching_projects", [])
    research.suggested_role = result.get("suggested_role", "")
    research.match_confidence = result.get("match_confidence", 0.0)
    research.is_stale = False

    # Update company status
    company.outreach_status = "researching" if company.outreach_status == "not_started" else company.outreach_status

    db.commit()
    db.refresh(research)

    return {
        "research_id": research.id,
        "business_summary": research.business_summary,
        "key_products": research.key_products,
        "tech_stack": research.tech_stack,
        "suggested_role": research.suggested_role,
        "candidate_match_explanation": research.candidate_match_explanation,
        "matching_skills": research.matching_skills,
        "matching_projects": research.matching_projects,
        "match_confidence": research.match_confidence,
    }


@router.get("/{company_id}")
def get_research(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    research = db.query(CompanyResearch).filter(
        CompanyResearch.company_id == company_id,
        CompanyResearch.user_id == current_user.id,
    ).first()
    if not research:
        raise HTTPException(status_code=404, detail="Research not found. Run research first.")
    return research
