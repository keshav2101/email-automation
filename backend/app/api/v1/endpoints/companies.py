from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import csv
import io
from fastapi.responses import StreamingResponse

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import Company

router = APIRouter()


class CompanyCreate(BaseModel):
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None
    domain: Optional[str] = None
    description: Optional[str] = None
    size: Optional[str] = None
    location: Optional[str] = None
    careers_page: Optional[str] = None
    linkedin_url: Optional[str] = None
    priority: str = "medium"
    notes: Optional[str] = None
    tags: List[str] = []


class CompanyResponse(BaseModel):
    id: int
    name: str
    website: Optional[str]
    industry: Optional[str]
    domain: Optional[str]
    location: Optional[str]
    outreach_status: str
    priority: str
    tags: List

    class Config:
        from_attributes = True


@router.get("/", response_model=List[CompanyResponse])
def list_companies(
    search: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Company).filter(Company.user_id == current_user.id)
    if search:
        query = query.filter(Company.name.ilike(f"%{search}%"))
    if industry:
        query = query.filter(Company.industry == industry)
    if status:
        query = query.filter(Company.outreach_status == status)
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=CompanyResponse, status_code=201)
def create_company(
    data: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = Company(user_id=current_user.id, **data.dict())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}")
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(
        Company.id == company_id, Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.patch("/{company_id}")
def update_company(
    company_id: int,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(
        Company.id == company_id, Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    allowed = {
        "name", "website", "industry", "domain", "description", "size",
        "location", "careers_page", "linkedin_url", "priority",
        "outreach_status", "notes", "tags",
    }
    for key, value in updates.items():
        if key in allowed:
            setattr(company, key, value)

    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}")
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = db.query(Company).filter(
        Company.id == company_id, Company.user_id == current_user.id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    db.delete(company)
    db.commit()
    return {"message": "Company deleted"}


@router.post("/import-csv")
async def import_companies_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import companies from CSV. Expected columns: name, website, industry, domain, location"""
    raw_bytes = await file.read()
    content = raw_bytes.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(content))
    imported = 0
    errors = []
    for i, row in enumerate(reader):
        try:
            company = Company(
                user_id=current_user.id,
                name=row.get("name", "").strip(),
                website=row.get("website", "").strip() or None,
                industry=row.get("industry", "").strip() or None,
                domain=row.get("domain", "").strip() or None,
                location=row.get("location", "").strip() or None,
            )
            db.add(company)
            imported += 1
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    db.commit()
    return {"imported": imported, "errors": errors}


@router.get("/export/csv")
def export_companies_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    companies = db.query(Company).filter(Company.user_id == current_user.id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["name", "website", "industry", "domain", "location", "outreach_status", "priority"])
    for c in companies:
        writer.writerow([c.name, c.website, c.industry, c.domain, c.location, c.outreach_status, c.priority])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=companies.csv"
    })
