from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    candidates,
    companies,
    hr_contacts,
    jobs,
    research,
    email_drafts,
    campaigns,
    gmail,
    analytics,
    followups,
    batch,
    extractor,
    email_plugin,
    bulk_automation,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(candidates.router, prefix="/candidates", tags=["Candidate Profile"])
api_router.include_router(companies.router, prefix="/companies", tags=["Companies"])
api_router.include_router(hr_contacts.router, prefix="/contacts", tags=["HR Contacts"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["Job Opportunities"])
api_router.include_router(research.router, prefix="/research", tags=["AI Research"])
api_router.include_router(email_drafts.router, prefix="/drafts", tags=["Email Drafts"])
api_router.include_router(campaigns.router, prefix="/campaigns", tags=["Campaigns"])
api_router.include_router(gmail.router, prefix="/gmail", tags=["Gmail Integration"])
api_router.include_router(email_plugin.router, prefix="/email-plugin", tags=["Email Plugin"])
api_router.include_router(bulk_automation.router, prefix="/bulk-automation", tags=["Bulk Automation"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(followups.router, prefix="/followups", tags=["Follow-Ups"])
api_router.include_router(batch.router, prefix="/batch", tags=["Batch Automation"])
api_router.include_router(extractor.router, prefix="/extractor", tags=["Data Extractor"])
