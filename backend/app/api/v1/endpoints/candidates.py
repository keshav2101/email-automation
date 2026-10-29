import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.candidate import CandidateProfile, ResumeVersion
from app.services.resume_parser import parse_resume
from app.services.ai_service import extract_profile_from_resume

router = APIRouter()


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    university: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    graduation_year: Optional[int] = None
    gpa: Optional[str] = None
    technical_skills: List[Any] = []
    programming_languages: List[Any] = []
    frameworks: List[Any] = []
    tools: List[Any] = []
    projects: List[Any] = []
    work_experience: List[Any] = []
    internships: List[Any] = []
    research_papers: List[Any] = []
    certifications: List[Any] = []
    awards: List[Any] = []
    preferred_roles: List[Any] = []
    preferred_locations: List[Any] = []
    professional_summary: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/profile", response_model=ProfileResponse)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        profile = CandidateProfile(
            user_id=current_user.id,
            full_name=current_user.full_name,
            email=current_user.email,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.patch("/profile")
def update_profile(
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    allowed = {
        "full_name", "phone", "location", "linkedin_url", "github_url", "portfolio_url",
        "university", "degree", "field_of_study", "graduation_year", "gpa",
        "technical_skills", "programming_languages", "frameworks", "tools", "soft_skills",
        "work_experience", "internships", "projects", "research_papers", "certifications",
        "awards", "preferred_roles", "preferred_locations", "employment_types",
        "target_industries", "professional_summary",
    }
    for key, value in updates.items():
        if key in allowed:
            setattr(profile, key, value)

    db.commit()
    db.refresh(profile)
    return {"message": "Profile updated", "profile_id": profile.id}


@router.post("/resume/upload")
async def upload_resume(
    file: UploadFile = File(...),
    label: str = "My Resume",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fname = (file.filename or "").lower()
    allowed_exts = (".pdf", ".docx", ".doc", ".txt", ".rtf", ".md")
    if not any(fname.endswith(ext) for ext in allowed_exts):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported document format. Accepted: {', '.join(allowed_exts)}"
        )

    content = await file.read()
    size_kb = len(content) // 1024

    if size_kb > settings.MAX_UPLOAD_SIZE_MB * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    # Save file safely
    raw_ext = fname.split(".")[-1] if "." in fname else "pdf"
    unique_name = f"{current_user.id}_{uuid.uuid4().hex}.{raw_ext}"
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    # Extract text using multi-format parser
    raw_text = parse_resume(file_path, raw_ext)

    # Create DB record
    resume = ResumeVersion(
        user_id=current_user.id,
        label=label,
        filename=file.filename or f"resume.{raw_ext}",
        file_path=file_path,
        file_type=raw_ext,
        file_size_kb=size_kb,
        raw_text=raw_text,
        extraction_status="pending",
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)

    # Trigger extraction and update profile
    try:
        profile = db.query(CandidateProfile).filter(
            CandidateProfile.user_id == current_user.id
        ).first()
        if not profile:
            profile = CandidateProfile(
                user_id=current_user.id,
                full_name=current_user.full_name,
                email=current_user.email,
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

        extracted = await extract_profile_from_resume(raw_text)
        if extracted and profile:
            for key, value in extracted.items():
                if value and hasattr(profile, key):
                    setattr(profile, key, value)
            resume.extraction_status = "done"
            db.commit()
        else:
            resume.extraction_status = "done"
            db.commit()
    except Exception:
        resume.extraction_status = "partial"
        db.commit()

    return {
        "resume_id": resume.id,
        "filename": file.filename,
        "extraction_status": resume.extraction_status,
        "message": "Document uploaded and parsed successfully",
    }


@router.get("/resumes")
def list_resumes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resumes = db.query(ResumeVersion).filter(
        ResumeVersion.user_id == current_user.id
    ).order_by(ResumeVersion.id.desc()).all()
    return [
        {
            "id": r.id,
            "label": r.label,
            "filename": r.filename,
            "file_type": r.file_type,
            "file_size_kb": r.file_size_kb,
            "extraction_status": r.extraction_status,
            "is_default": r.is_default,
            "created_at": r.created_at,
        }
        for r in resumes
    ]


@router.post("/profile/reparse")
async def reparse_active_resume(
    resume_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-parse the latest or specified resume using the deep structural extraction engine."""
    q = db.query(ResumeVersion).filter(ResumeVersion.user_id == current_user.id)
    if resume_id:
        resume = q.filter(ResumeVersion.id == resume_id).first()
    else:
        # Prefer actual PDF/DOCX resume over markdown/text
        resume = q.filter(ResumeVersion.file_type.in_(["pdf", "docx", "doc"])).order_by(ResumeVersion.id.desc()).first()
        if not resume:
            resume = q.order_by(ResumeVersion.id.desc()).first()

    if not resume:
        raise HTTPException(status_code=404, detail="No uploaded resume found to parse.")

    raw_text = resume.raw_text
    if not raw_text and resume.file_path and os.path.exists(resume.file_path):
        raw_text = parse_resume(resume.file_path, resume.file_type)
        resume.raw_text = raw_text

    if not raw_text:
        raise HTTPException(status_code=400, detail="Could not extract text from document.")

    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        profile = CandidateProfile(
            user_id=current_user.id,
            full_name=current_user.full_name,
            email=current_user.email,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    extracted = await extract_profile_from_resume(raw_text)
    for key, value in extracted.items():
        if value is not None and hasattr(profile, key):
            setattr(profile, key, value)

    profile.active_resume_id = resume.id
    resume.extraction_status = "done"
    db.commit()
    db.refresh(profile)

    return {
        "success": True,
        "resume_id": resume.id,
        "filename": resume.filename,
        "extracted_name": profile.full_name,
        "skills_count": len(profile.technical_skills or []),
        "projects_count": len(profile.projects or []),
        "experience_count": len(profile.work_experience or []),
        "publications_count": len(profile.research_papers or []),
        "message": f"Successfully parsed and synced {resume.filename} to profile!",
    }
