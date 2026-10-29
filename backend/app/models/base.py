# Re-export Base and import all models so Alembic can detect them
from app.core.database import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.candidate import CandidateProfile, ResumeVersion  # noqa: F401
from app.models.company import Company, HRContact, JobOpportunity, CompanyResearch  # noqa: F401
from app.models.email import (  # noqa: F401
    EmailCampaign,
    EmailDraft,
    EmailMessage,
    FollowUpTask,
    EmailEvent,
    SuppressionList,
    AuditLog,
)

__all__ = ["Base"]
