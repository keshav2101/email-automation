from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    gmail_connected: bool
    draft_only_mode: bool
    send_enabled: bool
    daily_send_limit: int

    class Config:
        from_attributes = True


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    draft_only_mode: Optional[bool] = None
    send_enabled: Optional[bool] = None
    daily_send_limit: Optional[int] = None


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    request: UpdateUserRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if request.full_name is not None:
        current_user.full_name = request.full_name
    if request.draft_only_mode is not None:
        current_user.draft_only_mode = request.draft_only_mode
    if request.send_enabled is not None:
        current_user.send_enabled = request.send_enabled
    if request.daily_send_limit is not None:
        current_user.daily_send_limit = min(request.daily_send_limit, 200)

    db.commit()
    db.refresh(current_user)
    return current_user
