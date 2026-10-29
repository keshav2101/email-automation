import io
import re
import math
from typing import List, Optional, Dict, Any
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import Company, HRContact, JobOpportunity

router = APIRouter()

EMAIL_REGEX = r"^[\w\.-]+@[\w\.-]+\.\w+$"
URL_REGEX = r"^https?://[^\s/$.?#].[^\s]*$"
PHONE_REGEX = r"^\+?[0-9\s\-\(\)\.]{7,20}$"


class ColumnInfo(BaseModel):
    name: str
    data_type: str
    non_null_count: int
    total_count: int
    fill_rate_percent: float
    unique_count: int
    sample_values: List[str]
    suggested_mapping: Optional[str] = None


class ValidationSummary(BaseModel):
    total_rows: int
    total_columns: int
    total_cells: int
    non_empty_cells: int
    overall_fill_rate: float
    detected_email_column: Optional[str] = None
    valid_email_count: int = 0
    invalid_email_count: int = 0
    duplicate_email_count: int = 0


class ExtractDataResponse(BaseModel):
    filename: str
    file_type: str
    file_size_bytes: int
    sheets: List[str]
    current_sheet: str
    total_rows: int
    total_columns: int
    columns: List[ColumnInfo]
    rows: List[Dict[str, Any]]
    suggested_mapping: Dict[str, str]
    summary: ValidationSummary


class ImportCrmRequest(BaseModel):
    rows: List[Dict[str, Any]]
    mapping: Dict[str, str]
    create_companies: bool = True
    create_contacts: bool = True
    create_jobs: bool = True
    default_priority: str = "medium"


class ImportCrmResponse(BaseModel):
    companies_created: int
    companies_updated: int
    contacts_created: int
    contacts_updated: int
    jobs_created: int
    skipped_rows: int
    errors: List[str]


def _infer_column_type(series: pd.Series) -> str:
    """Infer semantic and physical data type of a pandas Series."""
    valid_items = series.dropna().astype(str).str.strip()
    valid_items = valid_items[valid_items != ""]
    if valid_items.empty:
        return "empty"

    sample = valid_items.head(50)
    
    # Check email
    email_matches = sum(bool(re.match(EMAIL_REGEX, val)) for val in sample)
    if email_matches / len(sample) >= 0.5:
        return "email"

    # Check URL
    url_matches = sum(bool(re.match(URL_REGEX, val, re.IGNORECASE)) for val in sample)
    if url_matches / len(sample) >= 0.5:
        return "url"

    # Check phone
    phone_matches = sum(bool(re.match(PHONE_REGEX, val)) for val in sample)
    if phone_matches / len(sample) >= 0.6:
        return "phone"

    # Check boolean
    bool_values = {"true", "false", "yes", "no", "1", "0", "y", "n"}
    if all(val.lower() in bool_values for val in sample):
        return "boolean"

    # Check numeric
    numeric_count = 0
    for val in sample:
        try:
            float(val.replace(",", ""))
            numeric_count += 1
        except ValueError:
            pass
    if numeric_count / len(sample) >= 0.8:
        return "number"

    # Check date
    date_count = 0
    for val in sample:
        if len(val) >= 6 and (
            "-" in val or "/" in val or "." in val or any(m in val.lower() for m in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])
        ):
            try:
                pd.to_datetime(val)
                date_count += 1
            except Exception:
                pass
    if date_count / len(sample) >= 0.7:
        return "date"

    return "text"


def _suggest_mapping(col_name: str, inferred_type: str) -> Optional[str]:
    """Smartly match column name and type to a standard CRM outreach field."""
    name_clean = col_name.strip().lower().replace("_", " ").replace("-", " ")

    if inferred_type == "email" or "email" in name_clean or "mail" in name_clean:
        return "hr_email"

    if any(k in name_clean for k in ["company", "organization", "org", "employer", "firm", "business", "client"]):
        return "company_name"

    if any(k in name_clean for k in ["recruiter", "hr name", "contact name", "person", "full name", "representative"]) or (
        "name" in name_clean and "company" not in name_clean and "file" not in name_clean
    ):
        return "hr_name"

    if any(k in name_clean for k in ["role", "position", "title", "job", "designation", "vacancy", "opening"]):
        return "job_role"

    if any(k in name_clean for k in ["linkedin", "li url", "profile url", "social"]):
        return "linkedin_url"

    if any(k in name_clean for k in ["website", "site", "web url", "homepage", "domain"]):
        return "website"

    if any(k in name_clean for k in ["location", "city", "country", "state", "address", "region", "headquarters"]):
        return "location"

    if any(k in name_clean for k in ["phone", "mobile", "tel", "cell", "contact number"]):
        return "phone"

    if any(k in name_clean for k in ["industry", "sector", "domain category", "vertical"]):
        return "industry"

    if any(k in name_clean for k in ["note", "comment", "remark", "description", "details", "feedback", "snippet"]):
        return "notes"

    return None


@router.post("/extract", response_model=ExtractDataResponse)
async def extract_all_data(
    file: UploadFile = File(...),
    sheet_name: Optional[str] = Query(None),
    max_preview_rows: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """
    Extract ALL data from an Excel (.xlsx, .xls) or CSV file.
    Preserves all original columns, detects sheets, infers data types,
    and calculates data quality metrics.
    """
    raw_bytes = await file.read()
    file_size = len(raw_bytes)
    filename = file.filename or "uploaded_data"
    fn_lower = filename.lower()

    if not fn_lower.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.",
        )

    sheet_names: List[str] = []
    current_sheet = ""

    try:
        if fn_lower.endswith((".xlsx", ".xls")):
            excel_file = pd.ExcelFile(io.BytesIO(raw_bytes))
            sheet_names = excel_file.sheet_names
            current_sheet = sheet_name if sheet_name and sheet_name in sheet_names else sheet_names[0]
            df = pd.read_excel(excel_file, sheet_name=current_sheet)
        else:
            # CSV file
            sheet_names = ["Sheet1"]
            current_sheet = "Sheet1"
            # Auto-detect encoding and separator
            try:
                df = pd.read_csv(io.BytesIO(raw_bytes), sep=None, engine="python")
            except Exception:
                df = pd.read_csv(io.BytesIO(raw_bytes), sep=",")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="The selected spreadsheet contains no data.")

    # Remove completely empty rows
    df = df.dropna(how="all")

    # Clean column headers
    df.columns = [str(c).strip() if pd.notna(c) and str(c).strip() else f"Column_{i+1}" for i, c in enumerate(df.columns)]

    total_rows = len(df)
    total_columns = len(df.columns)

    # Column-level intelligence
    columns_info: List[ColumnInfo] = []
    suggested_mapping: Dict[str, str] = {}
    detected_email_column: Optional[str] = None

    for col in df.columns:
        series = df[col]
        non_null_count = int(series.notna().sum())
        fill_rate = round((non_null_count / total_rows) * 100, 1) if total_rows > 0 else 0.0
        unique_count = int(series.nunique(dropna=True))
        
        # Sample values
        clean_samples = [str(val).strip() for val in series.dropna().unique() if str(val).strip()][:5]
        
        inferred_type = _infer_column_type(series)
        mapping_field = _suggest_mapping(col, inferred_type)

        if mapping_field and mapping_field not in suggested_mapping:
            suggested_mapping[mapping_field] = col

        if inferred_type == "email" and not detected_email_column:
            detected_email_column = col

        columns_info.append(
            ColumnInfo(
                name=col,
                data_type=inferred_type,
                non_null_count=non_null_count,
                total_count=total_rows,
                fill_rate_percent=fill_rate,
                unique_count=unique_count,
                sample_values=clean_samples,
                suggested_mapping=mapping_field,
            )
        )

    # Email analysis if email column exists
    valid_email_count = 0
    invalid_email_count = 0
    duplicate_email_count = 0

    if not detected_email_column and "hr_email" in suggested_mapping:
        detected_email_column = suggested_mapping["hr_email"]

    if detected_email_column and detected_email_column in df.columns:
        seen_emails = set()
        for email_val in df[detected_email_column].dropna():
            cleaned = str(email_val).strip().lower()
            if not cleaned:
                continue
            if re.match(EMAIL_REGEX, cleaned):
                valid_email_count += 1
                if cleaned in seen_emails:
                    duplicate_email_count += 1
                else:
                    seen_emails.add(cleaned)
            else:
                invalid_email_count += 1

    # Convert DataFrame to JSON-safe dictionary records
    # Replace NaN, NaT, and infinity with None
    df_clean = df.replace({float("nan"): None, float("inf"): None, float("-inf"): None})
    
    if max_preview_rows and max_preview_rows > 0:
        display_df = df_clean.head(max_preview_rows)
    else:
        display_df = df_clean

    records = display_df.to_dict(orient="records")
    
    # Ensure all values are JSON serializable
    clean_records: List[Dict[str, Any]] = []
    for r in records:
        clean_row = {}
        for k, v in r.items():
            if pd.isna(v) or v is None:
                clean_row[k] = ""
            elif isinstance(v, (datetime, pd.Timestamp)):
                clean_row[k] = v.strftime("%Y-%m-%d %H:%M:%S")
            elif isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean_row[k] = ""
            else:
                clean_row[k] = str(v)
        clean_records.append(clean_row)

    total_cells = total_rows * total_columns
    non_empty_cells = sum(c.non_null_count for c in columns_info)
    overall_fill_rate = round((non_empty_cells / total_cells) * 100, 1) if total_cells > 0 else 0.0

    summary = ValidationSummary(
        total_rows=total_rows,
        total_columns=total_columns,
        total_cells=total_cells,
        non_empty_cells=non_empty_cells,
        overall_fill_rate=overall_fill_rate,
        detected_email_column=detected_email_column,
        valid_email_count=valid_email_count,
        invalid_email_count=invalid_email_count,
        duplicate_email_count=duplicate_email_count,
    )

    return ExtractDataResponse(
        filename=filename,
        file_type="excel" if fn_lower.endswith((".xlsx", ".xls")) else "csv",
        file_size_bytes=file_size,
        sheets=sheet_names,
        current_sheet=current_sheet,
        total_rows=total_rows,
        total_columns=total_columns,
        columns=columns_info,
        rows=clean_records,
        suggested_mapping=suggested_mapping,
        summary=summary,
    )


@router.post("/import-crm", response_model=ImportCrmResponse)
def import_extracted_to_crm(
    payload: ImportCrmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Import extracted spreadsheet data into Company, HRContact, and JobOpportunity models.
    Uses custom or auto-detected column mappings.
    """
    mapping = payload.mapping
    rows = payload.rows

    company_col = mapping.get("company_name")
    email_col = mapping.get("hr_email")
    name_col = mapping.get("hr_name")
    role_col = mapping.get("job_role")
    website_col = mapping.get("website")
    location_col = mapping.get("location")
    linkedin_col = mapping.get("linkedin_url")
    phone_col = mapping.get("phone")
    industry_col = mapping.get("industry")
    notes_col = mapping.get("notes")

    if not company_col and not email_col:
        raise HTTPException(
            status_code=400,
            detail="At least a 'Company Name' or 'HR Email' mapping is required to import to CRM.",
        )

    # Pre-cache user's existing companies by lowercase name
    existing_companies = {
        c.name.strip().lower(): c
        for c in db.query(Company).filter(Company.user_id == current_user.id).all()
        if c.name
    }

    # Pre-cache user's existing contacts by lowercase email
    existing_contacts = {
        ct.email.strip().lower(): ct
        for ct in db.query(HRContact).filter(HRContact.user_id == current_user.id).all()
        if ct.email
    }

    companies_created = 0
    companies_updated = 0
    contacts_created = 0
    contacts_updated = 0
    jobs_created = 0
    skipped = 0
    errors = []

    for idx, row in enumerate(rows):
        comp_name = str(row.get(company_col, "")).strip() if company_col else ""
        hr_email = str(row.get(email_col, "")).strip() if email_col else ""
        hr_name = str(row.get(name_col, "")).strip() if name_col else ""
        job_role = str(row.get(role_col, "")).strip() if role_col else ""
        website = str(row.get(website_col, "")).strip() if website_col else ""
        location = str(row.get(location_col, "")).strip() if location_col else ""
        linkedin = str(row.get(linkedin_col, "")).strip() if linkedin_col else ""
        phone = str(row.get(phone_col, "")).strip() if phone_col else ""
        industry = str(row.get(industry_col, "")).strip() if industry_col else ""
        notes = str(row.get(notes_col, "")).strip() if notes_col else ""

        if not comp_name and not hr_email:
            skipped += 1
            continue

        try:
            # 1. Resolve Company
            company = None
            if comp_name:
                comp_key = comp_name.lower()
                if comp_key in existing_companies:
                    company = existing_companies[comp_key]
                    updated = False
                    if website and not company.website:
                        company.website = website
                        updated = True
                    if location and not company.location:
                        company.location = location
                        updated = True
                    if industry and not company.industry:
                        company.industry = industry
                        updated = True
                    if updated:
                        companies_updated += 1
                elif payload.create_companies:
                    company = Company(
                        user_id=current_user.id,
                        name=comp_name,
                        website=website or None,
                        location=location or None,
                        industry=industry or None,
                        priority=payload.default_priority,
                        tags=["extracted-sheet"],
                        notes=notes or None,
                    )
                    db.add(company)
                    db.flush()
                    existing_companies[comp_key] = company
                    companies_created += 1

            # 2. Resolve HR Contact
            if hr_email and payload.create_contacts:
                email_key = hr_email.lower()
                if email_key in existing_contacts:
                    contact = existing_contacts[email_key]
                    updated = False
                    if hr_name and not contact.name:
                        contact.name = hr_name
                        updated = True
                    if job_role and not contact.title:
                        contact.title = job_role
                        updated = True
                    if linkedin and not contact.linkedin_url:
                        contact.linkedin_url = linkedin
                        updated = True
                    if updated:
                        contacts_updated += 1
                else:
                    if not company:
                        default_co = db.query(Company).filter(Company.user_id == current_user.id, Company.name == "Independent Contacts").first()
                        if not default_co:
                            default_co = Company(user_id=current_user.id, name="Independent Contacts", tags=["default"])
                            db.add(default_co)
                            db.flush()
                        company = default_co

                    contact = HRContact(
                        user_id=current_user.id,
                        company_id=company.id,
                        name=hr_name or None,
                        email=hr_email,
                        title=job_role or "Recruiter / Talent Acquisition",
                        linkedin_url=linkedin or None,
                        phone=phone or None,
                        email_source="sheet_extraction",
                        notes=notes or None,
                    )
                    db.add(contact)
                    db.flush()
                    existing_contacts[email_key] = contact
                    contacts_created += 1

            # 3. Resolve Job Opportunity
            if job_role and company and payload.create_jobs:
                existing_job = db.query(JobOpportunity).filter(
                    JobOpportunity.company_id == company.id,
                    JobOpportunity.user_id == current_user.id,
                    JobOpportunity.title.ilike(job_role.strip()),
                ).first()
                if not existing_job:
                    job = JobOpportunity(
                        user_id=current_user.id,
                        company_id=company.id,
                        title=job_role,
                        location=location or None,
                        description=f"Extracted from spreadsheet. Recruiter: {hr_name} ({hr_email})" if hr_email else "Extracted from spreadsheet",
                        application_type="speculative",
                    )
                    db.add(job)
                    jobs_created += 1

        except Exception as e:
            errors.append(f"Row {idx+1}: {str(e)}")

    db.commit()

    return ImportCrmResponse(
        companies_created=companies_created,
        companies_updated=companies_updated,
        contacts_created=contacts_created,
        contacts_updated=contacts_updated,
        jobs_created=jobs_created,
        skipped_rows=skipped,
        errors=errors[:10],
    )


@router.post("/export-cleaned")
def export_cleaned_data(
    rows: List[Dict[str, Any]] = Body(...),
    export_format: str = Query("csv", pattern="^(csv|json)$"),
):
    """Export the extracted or cleaned data as CSV or JSON."""
    if not rows:
        raise HTTPException(status_code=400, detail="No rows provided for export")

    if export_format == "json":
        import json
        output = io.StringIO()
        json.dump(rows, output, indent=2)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=extracted_data.json"},
        )
    else:
        df = pd.DataFrame(rows)
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=extracted_data.csv"},
        )
