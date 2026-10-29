from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, ForeignKey, JSON, Boolean
)
from app.core.database import Base


class CandidateProfile(Base):
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Personal
    full_name = Column(String(255))
    email = Column(String(255))
    phone = Column(String(50))
    location = Column(String(255))
    linkedin_url = Column(String(500))
    github_url = Column(String(500))
    portfolio_url = Column(String(500))

    # Education
    university = Column(String(255))
    degree = Column(String(255))
    field_of_study = Column(String(255))
    graduation_year = Column(Integer)
    gpa = Column(String(100))

    # Skills (stored as JSON arrays)
    technical_skills = Column(JSON, default=list)         # ["Python", "PyTorch", ...]
    programming_languages = Column(JSON, default=list)
    frameworks = Column(JSON, default=list)
    tools = Column(JSON, default=list)
    soft_skills = Column(JSON, default=list)

    # Experience (stored as JSON array of objects)
    work_experience = Column(JSON, default=list)
    internships = Column(JSON, default=list)
    projects = Column(JSON, default=list)
    research_papers = Column(JSON, default=list)
    certifications = Column(JSON, default=list)
    awards = Column(JSON, default=list)

    # Job preferences
    preferred_roles = Column(JSON, default=list)
    preferred_locations = Column(JSON, default=list)
    employment_types = Column(JSON, default=list)   # full-time, internship, etc.
    target_industries = Column(JSON, default=list)

    # Summary
    professional_summary = Column(Text)

    active_resume_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    profile_id = Column(Integer, ForeignKey("candidate_profiles.id"), nullable=True)

    label = Column(String(255))           # e.g. "AI/ML Resume", "SWE Resume"
    filename = Column(String(500))
    file_path = Column(String(1000))
    file_type = Column(String(10))        # pdf or docx
    file_size_kb = Column(Integer)

    raw_text = Column(Text)               # Extracted text content
    is_default = Column(Boolean, default=False)
    extraction_status = Column(String(50), default="pending")  # pending/done/failed

    created_at = Column(DateTime, default=datetime.utcnow)
