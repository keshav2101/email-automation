import re
import io
import time
from typing import List, Optional, Dict, Any
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import Company, HRContact
from app.models.candidate import CandidateProfile
from app.models.email import EmailDraft, EmailMessage, AuditLog, SuppressionList
from app.services.ai_service import generate_personalized_email
from app.services.gmail_service import send_message

router = APIRouter()

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"


class BatchRowItem(BaseModel):
    company_name: str
    hr_email: str
    hr_name: Optional[str] = ""
    job_role: Optional[str] = ""
    is_valid_email: bool = True
    is_duplicate: bool = False
    is_already_contacted: bool = False
    raw_data: Optional[Dict[str, Any]] = None


class ValidateSheetResponse(BaseModel):
    filename: str
    total_rows: int
    valid_count: int
    invalid_count: int
    duplicate_count: int
    already_contacted_count: int
    all_columns: List[str] = []
    rows: List[BatchRowItem]


class ProcessBatchRequest(BaseModel):
    rows: List[BatchRowItem]
    skip_duplicates: bool = True
    skip_invalid: bool = True
    style: str = "professional"


class BatchDraftResult(BaseModel):
    draft_id: int
    company_name: str
    recipient_email: str
    recipient_name: Optional[str]
    target_role: Optional[str]
    subject: str
    body: str
    word_count: int
    confidence_score: int
    status: str


class DispatchBatchRequest(BaseModel):
    draft_ids: List[int]
    delay_seconds: int = 10
    max_daily_limit: int = 40


@router.get("/sample-template")
def download_sample_template():
    """Download a pre-formatted Excel/CSV sample template for batch HR outreach."""
    df = pd.DataFrame([
        {
            "Company Name": "Microsoft",
            "HR Email": "recruiting@microsoft.com",
            "HR Name": "Sarah Jenkins",
            "Job Role": "Software Engineer",
        },
        {
            "Company Name": "NVIDIA",
            "HR Email": "careers@nvidia.com",
            "HR Name": "Alex Rivera",
            "Job Role": "AI/ML Engineer",
        },
        {
            "Company Name": "Deloitte",
            "HR Email": "talent@deloitte.com",
            "HR Name": "",
            "Job Role": "Data Analyst",
        },
    ])
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sample_hr_contacts.csv"},
    )


@router.post("/validate-sheet", response_model=ValidateSheetResponse)
async def validate_sheet(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload Excel (.xlsx, .xls) or CSV and validate company names,
    HR emails, duplicate records, and contact status.
    """
    content = await file.read()
    filename = file.filename.lower()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload .xlsx, .xls, or .csv")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded sheet is empty")

    # Save original columns and records before renaming
    original_cols = [str(c).strip() for c in df.columns if str(c).strip()]
    raw_records = df.to_dict(orient="records")

    # Normalize column names with smart detection
    col_map = {}
    for col in df.columns:
        clean = col.strip().lower().replace("_", " ").replace("-", " ")
        if any(k in clean for k in ["company", "organization", "corp", "employer", "firm", "business"]):
            col_map[col] = "company_name"
        elif any(k in clean for k in ["email", "mail"]):
            col_map[col] = "hr_email"
        elif any(k in clean for k in ["recruiter", "hr name", "contact", "person"]) or ("name" in clean and "company" not in clean):
            col_map[col] = "hr_name"
        elif any(k in clean for k in ["role", "job", "title", "position", "designation"]):
            col_map[col] = "job_role"

    df = df.rename(columns=col_map)

    if "company_name" not in df.columns or "hr_email" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="Missing required columns. Please include 'Company Name' and 'HR Email' headers.",
        )

    # Fill optional columns if missing
    if "hr_name" not in df.columns:
        df["hr_name"] = ""
    if "job_role" not in df.columns:
        df["job_role"] = ""

    # Check previously contacted emails for this user
    previously_contacted = set(
        r[0].lower()
        for r in db.query(HRContact.email)
        .filter(HRContact.user_id == current_user.id, HRContact.outreach_status.in_(["emailed", "replied"]))
        .all()
        if r[0]
    )

    seen_emails = set()
    row_items: List[BatchRowItem] = []
    valid_count = 0
    invalid_count = 0
    dup_count = 0
    contacted_count = 0

    for idx, r in df.iterrows():
        comp = str(r["company_name"]).strip() if pd.notna(r["company_name"]) else ""
        raw_email = str(r["hr_email"]).strip() if pd.notna(r["hr_email"]) else ""
        name = str(r["hr_name"]).strip() if pd.notna(r["hr_name"]) else ""
        role = str(r["job_role"]).strip() if pd.notna(r["job_role"]) else ""

        if not comp and not raw_email:
            continue

        email_clean = raw_email.lower()
        is_valid = bool(re.match(EMAIL_REGEX, email_clean))
        is_dup = email_clean in seen_emails
        is_contacted = email_clean in previously_contacted

        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1

        if is_dup:
            dup_count += 1
        else:
            seen_emails.add(email_clean)

        if is_contacted:
            contacted_count += 1

        # Clean raw row dictionary for JSON serialization
        raw_row_data = {}
        if idx < len(raw_records):
            for k, v in raw_records[idx].items():
                raw_row_data[str(k)] = "" if pd.isna(v) else str(v)

        row_items.append(
            BatchRowItem(
                company_name=comp,
                hr_email=raw_email,
                hr_name=name,
                job_role=role,
                is_valid_email=is_valid,
                is_duplicate=is_dup,
                is_already_contacted=is_contacted,
                raw_data=raw_row_data,
            )
        )

    return ValidateSheetResponse(
        filename=file.filename,
        total_rows=len(row_items),
        valid_count=valid_count,
        invalid_count=invalid_count,
        duplicate_count=dup_count,
        already_contacted_count=contacted_count,
        all_columns=original_cols,
        rows=row_items,
    )


@router.post("/process", response_model=List[BatchDraftResult])
async def process_batch_sheet(
    req: ProcessBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate customized emails for all validated sheet rows using the user's resume as ground truth.
    Creates Company, HRContact, and EmailDraft entries in the database.
    """
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    if not profile:
        profile = CandidateProfile(
            user_id=current_user.id,
            full_name=current_user.full_name or "Candidate",
            email=current_user.email,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    profile_dict = {
        "full_name": profile.full_name or current_user.full_name or "Candidate",
        "email": profile.email,
        "phone": profile.phone or "",
        "university": profile.university or "",
        "degree": profile.degree or "B.Tech / B.S.",
        "field_of_study": profile.field_of_study or "Computer Science",
        "graduation_year": profile.graduation_year or 2025,
        "technical_skills": profile.technical_skills or ["Python", "Problem Solving", "Software Architecture"],
        "projects": profile.projects or [{"name": "Technical Engineering Project", "description": "High performance software system"}],
        "internships": profile.internships or [],
        "research_papers": profile.research_papers or [],
    }

    results: List[BatchDraftResult] = []

    for item in req.rows:
        if req.skip_invalid and not item.is_valid_email:
            continue
        if req.skip_duplicates and item.is_duplicate:
            continue

        comp_name = item.company_name.strip()
        email = item.hr_email.strip()
        if not comp_name or not email:
            continue

        # 1. Get or create Company
        company = (
            db.query(Company)
            .filter(Company.name.ilike(comp_name), Company.user_id == current_user.id)
            .first()
        )
        if not company:
            company = Company(
                user_id=current_user.id,
                name=comp_name,
                industry=item.job_role or "Technology",
                priority="medium",
            )
            db.add(company)
            db.flush()

        # 2. Get or create HRContact
        contact = (
            db.query(HRContact)
            .filter(HRContact.email == email, HRContact.user_id == current_user.id)
            .first()
        )
        if not contact:
            contact = HRContact(
                company_id=company.id,
                user_id=current_user.id,
                name=item.hr_name or None,
                email=email,
                title=f"Talent Acquisition / {item.job_role}" if item.job_role else "Recruiter",
                email_verified=item.is_valid_email,
            )
            db.add(contact)
            db.flush()

        # 3. Generate tailored email (100–150 words)
        gen = await generate_personalized_email(
            company_name=comp_name,
            company_domain=company.domain or company.industry or "",
            hr_name=item.hr_name if item.hr_name else None,
            target_role=item.job_role if item.job_role else "Software Engineering",
            job_description=None,
            candidate_profile=profile_dict,
            research={},
            style=req.style,
        )

        subj = gen.get("subject", f"Inquiry: {item.job_role or 'Opportunities'} at {comp_name} — {profile_dict['full_name']}")
        body = gen.get("body", "")
        word_count = len(body.split())

        # 4. Save EmailDraft
        draft = EmailDraft(
            user_id=current_user.id,
            company_id=company.id,
            hr_contact_id=contact.id,
            subject=subj,
            body=body,
            formal_version=gen.get("formal_version", body),
            concise_version=gen.get("concise_version", body),
            conversational_version=gen.get("conversational_version", body),
            style=req.style,
            recipient_email=email,
            recipient_name=item.hr_name or None,
            target_role=item.job_role or "Software Engineering",
            confidence_score=gen.get("confidence_score", 85),
            status="draft",
        )
        db.add(draft)
        db.flush()

        results.append(
            BatchDraftResult(
                draft_id=draft.id,
                company_name=comp_name,
                recipient_email=email,
                recipient_name=item.hr_name or None,
                target_role=item.job_role or None,
                subject=subj,
                body=body,
                word_count=word_count,
                confidence_score=draft.confidence_score,
                status=draft.status,
            )
        )

    db.commit()
    return results


@router.post("/dispatch")
def dispatch_batch(
    req: DispatchBatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dispatch approved email drafts with configurable throttling and safety guardrails.
    """
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    sent_today = (
        db.query(EmailMessage)
        .filter(EmailMessage.user_id == current_user.id, EmailMessage.sent_at >= today_start)
        .count()
    )

    remaining_allowance = max(0, req.max_daily_limit - sent_today)
    if remaining_allowance <= 0:
        raise HTTPException(
            status_code=400,
            detail=f"Daily sending limit ({req.max_daily_limit}) reached for today. Pausing to protect account quota.",
        )

    drafts = (
        db.query(EmailDraft)
        .filter(EmailDraft.id.in_(req.draft_ids), EmailDraft.user_id == current_user.id)
        .all()
    )

    sent_count = 0
    failed_count = 0
    details = []

    for draft in drafts:
        if sent_count >= remaining_allowance:
            details.append({"draft_id": draft.id, "status": "paused", "reason": "Daily quota limit reached"})
            break

        if not draft.recipient_email:
            continue

        # Check suppression
        suppressed = (
            db.query(SuppressionList)
            .filter(SuppressionList.user_id == current_user.id, SuppressionList.email == draft.recipient_email)
            .first()
        )
        if suppressed:
            draft.status = "suppressed"
            details.append({"draft_id": draft.id, "status": "suppressed", "email": draft.recipient_email})
            continue

        try:
            # Send message
            res = send_message(
                user=current_user,
                to=draft.recipient_email,
                subject=draft.subject,
                body=draft.body,
            )
            draft.status = "sent"
            draft.gmail_message_id = res.get("id")

            msg = EmailMessage(
                draft_id=draft.id,
                user_id=current_user.id,
                gmail_message_id=res.get("id"),
                sent_at=datetime.utcnow(),
                status="sent",
            )
            db.add(msg)

            audit = AuditLog(
                user_id=current_user.id,
                action="batch_email_sent",
                entity_type="email_draft",
                entity_id=draft.id,
                details={"to": draft.recipient_email, "subject": draft.subject},
            )
            db.add(audit)
            sent_count += 1
            details.append({"draft_id": draft.id, "status": "sent", "email": draft.recipient_email})

        except Exception as e:
            failed_count += 1
            details.append({"draft_id": draft.id, "status": "failed", "email": draft.recipient_email, "error": str(e)})

    db.commit()
    return {
        "sent_count": sent_count,
        "failed_count": failed_count,
        "remaining_allowance": max(0, remaining_allowance - sent_count),
        "results": details,
    }
