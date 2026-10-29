from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import JobOpportunity

router = APIRouter()


class JobCreate(BaseModel):
    company_id: int
    title: str
    description: Optional[str] = None
    requirements: List[str] = []
    skills_required: List[str] = []
    location: Optional[str] = None
    employment_type: str = "full-time"
    is_confirmed: bool = False
    source_url: Optional[str] = None
    application_type: str = "speculative"


@router.get("/")
def list_jobs(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(JobOpportunity).filter(JobOpportunity.user_id == current_user.id)
    if company_id:
        query = query.filter(JobOpportunity.company_id == company_id)
    return query.all()


@router.post("/", status_code=201)
def create_job(
    data: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = JobOpportunity(user_id=current_user.id, **data.dict())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/{job_id}")
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(JobOpportunity).filter(
        JobOpportunity.id == job_id, JobOpportunity.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(JobOpportunity).filter(
        JobOpportunity.id == job_id, JobOpportunity.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"message": "Job deleted"}
