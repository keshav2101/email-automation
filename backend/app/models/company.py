from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, ForeignKey, JSON, Boolean, Float
)
from app.core.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String(255), nullable=False)
    website = Column(String(500))
    industry = Column(String(255))
    domain = Column(String(255))            # AI, SaaS, FinTech, etc.
    description = Column(Text)
    size = Column(String(50))               # startup, mid, enterprise
    location = Column(String(255))
    careers_page = Column(String(500))
    linkedin_url = Column(String(500))

    tags = Column(JSON, default=list)       # custom tags
    notes = Column(Text)
    priority = Column(String(20), default="medium")  # low/medium/high
    outreach_status = Column(String(50), default="not_started")
    # not_started / researching / ready / emailed / replied / closed

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HRContact(Base):
    __tablename__ = "hr_contacts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String(255))
    title = Column(String(255))             # e.g. "Talent Acquisition Manager"
    email = Column(String(255))
    email_verified = Column(Boolean, default=False)
    email_source = Column(String(500))      # URL where found

    linkedin_url = Column(String(500))
    phone = Column(String(50))
    notes = Column(Text)

    outreach_status = Column(String(50), default="not_contacted")
    last_contacted_at = Column(DateTime, nullable=True)
    reply_received = Column(Boolean, default=False)
    opted_out = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class JobOpportunity(Base):
    __tablename__ = "job_opportunities"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String(255), nullable=False)
    description = Column(Text)
    requirements = Column(JSON, default=list)    # list of requirement strings
    skills_required = Column(JSON, default=list)
    location = Column(String(255))
    employment_type = Column(String(50))         # full-time, internship, contract
    is_confirmed = Column(Boolean, default=False) # verified posting
    source_url = Column(String(500))
    posting_date = Column(DateTime, nullable=True)
    application_type = Column(String(50), default="speculative")
    # speculative / confirmed_posting / referral_request

    created_at = Column(DateTime, default=datetime.utcnow)


class CompanyResearch(Base):
    __tablename__ = "company_research"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # AI-generated research
    business_summary = Column(Text)
    key_products = Column(JSON, default=list)
    tech_stack = Column(JSON, default=list)
    recent_news = Column(JSON, default=list)
    hiring_signals = Column(JSON, default=list)

    # Candidate matching
    candidate_match_explanation = Column(Text)
    matching_skills = Column(JSON, default=list)
    matching_projects = Column(JSON, default=list)
    suggested_role = Column(String(255))
    match_confidence = Column(Float, default=0.0)  # 0–1

    source_urls = Column(JSON, default=list)
    researched_at = Column(DateTime, default=datetime.utcnow)
    is_stale = Column(Boolean, default=False)
