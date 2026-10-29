from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.company import HRContact

router = APIRouter()


class HRContactCreate(BaseModel):
    company_id: int
    name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[EmailStr] = None
    email_verified: bool = False
    email_source: Optional[str] = None
    linkedin_url: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None


class HRContactResponse(BaseModel):
    id: int
    company_id: int
    name: Optional[str]
    title: Optional[str]
    email: Optional[str]
    email_verified: bool
    outreach_status: str
    reply_received: bool
    opted_out: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=List[HRContactResponse])
def list_contacts(
    company_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(HRContact).filter(HRContact.user_id == current_user.id)
    if company_id:
        query = query.filter(HRContact.company_id == company_id)
    return query.offset(skip).limit(limit).all()


@router.post("/", response_model=HRContactResponse, status_code=201)
def create_contact(
    data: HRContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = HRContact(user_id=current_user.id, **data.dict())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("/{contact_id}", response_model=HRContactResponse)
def get_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(HRContact).filter(
        HRContact.id == contact_id, HRContact.user_id == current_user.id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.patch("/{contact_id}")
def update_contact(
    contact_id: int,
    updates: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(HRContact).filter(
        HRContact.id == contact_id, HRContact.user_id == current_user.id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    allowed = {
        "name", "title", "email", "email_verified", "email_source",
        "linkedin_url", "phone", "notes", "outreach_status", "opted_out",
    }
    for key, value in updates.items():
        if key in allowed:
            setattr(contact, key, value)

    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}")
def delete_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = db.query(HRContact).filter(
        HRContact.id == contact_id, HRContact.user_id == current_user.id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return {"message": "Contact deleted"}
