from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, ForeignKey, JSON, Boolean
)
from app.core.database import Base


class EmailCampaign(Base):
    __tablename__ = "email_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text)
    target_role = Column(String(255))
    resume_version_id = Column(Integer, ForeignKey("resume_versions.id"), nullable=True)
    status = Column(String(50), default="draft")  # draft/active/paused/completed

    total_contacts = Column(Integer, default=0)
    emails_generated = Column(Integer, default=0)
    emails_approved = Column(Integer, default=0)
    emails_sent = Column(Integer, default=0)
    replies_received = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailDraft(Base):
    __tablename__ = "email_drafts"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("email_campaigns.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    hr_contact_id = Column(Integer, ForeignKey("hr_contacts.id"), nullable=True)
    job_opportunity_id = Column(Integer, ForeignKey("job_opportunities.id"), nullable=True)
    research_id = Column(Integer, ForeignKey("company_research.id"), nullable=True)
    resume_version_id = Column(Integer, ForeignKey("resume_versions.id"), nullable=True)

    # Email content
    subject = Column(String(500))
    body = Column(Text)
    style = Column(String(50), default="professional")  # professional/formal/conversational
    recipient_email = Column(String(255))
    recipient_name = Column(String(255))

    # Generation metadata
    target_role = Column(String(255))
    matching_skills = Column(JSON, default=list)
    highlighted_project = Column(String(500))
    personalization_notes = Column(Text)
    confidence_score = Column(Integer, default=0)  # 0–100
    source_urls = Column(JSON, default=list)

    # Alternative versions
    formal_version = Column(Text)
    concise_version = Column(Text)
    conversational_version = Column(Text)

    # Status
    status = Column(String(50), default="draft")
    # draft/approved/scheduled/sent/failed/suppressed
    approved_at = Column(DateTime, nullable=True)
    scheduled_for = Column(DateTime, nullable=True)
    attach_resume = Column(Boolean, default=True)

    # Gmail
    gmail_draft_id = Column(String(255), nullable=True)
    gmail_message_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailMessage(Base):
    __tablename__ = "email_messages"

    id = Column(Integer, primary_key=True, index=True)
    draft_id = Column(Integer, ForeignKey("email_drafts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    gmail_message_id = Column(String(255), nullable=True)
    gmail_thread_id = Column(String(255), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="pending")  # pending/sent/bounced/delivered

    reply_received = Column(Boolean, default=False)
    reply_at = Column(DateTime, nullable=True)
    reply_message_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class FollowUpTask(Base):
    __tablename__ = "follow_up_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_draft_id = Column(Integer, ForeignKey("email_drafts.id"), nullable=False)
    hr_contact_id = Column(Integer, ForeignKey("hr_contacts.id"), nullable=True)

    sequence_number = Column(Integer, default=1)  # 1 = first follow-up, 2 = final
    scheduled_for = Column(DateTime)
    subject = Column(String(500))
    body = Column(Text)

    status = Column(String(50), default="pending")  # pending/sent/cancelled/skipped
    cancel_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class EmailEvent(Base):
    __tablename__ = "email_events"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("email_messages.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    event_type = Column(String(50))  # sent/delivered/opened/clicked/bounced/replied
    occurred_at = Column(DateTime, default=datetime.utcnow)
    event_metadata = Column("metadata", JSON, default=dict)
    is_verified = Column(Boolean, default=False)  # is this from a reliable source?


class SuppressionList(Base):
    __tablename__ = "suppression_list"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    email = Column(String(255), nullable=False)
    reason = Column(String(100))  # opted_out/replied/bounced/manual
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    action = Column(String(100), nullable=False)  # email_sent, draft_approved, etc.
    entity_type = Column(String(100))              # email_draft, company, etc.
    entity_id = Column(Integer, nullable=True)
    details = Column(JSON, default=dict)
    ip_address = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
