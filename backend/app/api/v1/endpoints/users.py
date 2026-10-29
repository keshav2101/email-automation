from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.candidate import CandidateProfile

router = APIRouter()


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    gmail_connected: bool
    draft_only_mode: bool
    send_enabled: bool
    daily_send_limit: int
    email_signature: Optional[str] = None
    signature_template: Optional[str] = "modern"
    signature_data: Optional[Dict[str, Any]] = None
    append_signature_default: Optional[bool] = True

    class Config:
        from_attributes = True


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    draft_only_mode: Optional[bool] = None
    send_enabled: Optional[bool] = None
    daily_send_limit: Optional[int] = None
    email_signature: Optional[str] = None
    signature_template: Optional[str] = None
    signature_data: Optional[Dict[str, Any]] = None
    append_signature_default: Optional[bool] = None


class SignaturePayload(BaseModel):
    template: str = "modern"  # modern, corporate, developer, academic, minimal, custom
    greeting: Optional[str] = "Best regards,"
    full_name: Optional[str] = None
    title: Optional[str] = None
    university: Optional[str] = None
    degree: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    accent_color: Optional[str] = "#3b82f6"
    include_disclaimer: bool = False
    custom_html: Optional[str] = None
    append_default: bool = True


def build_signature_html(data: Dict[str, Any], template: str = "modern") -> str:
    greeting = data.get("greeting", "Best regards,")
    name = data.get("full_name") or "Candidate"
    title = data.get("title") or "Software & AI Engineer"
    uni = data.get("university") or ""
    degree = data.get("degree") or ""
    email = data.get("email") or ""
    phone = data.get("phone") or ""
    linkedin = data.get("linkedin_url") or ""
    github = data.get("github_url") or ""
    portfolio = data.get("portfolio_url") or ""
    color = data.get("accent_color") or "#3b82f6"
    custom_html = data.get("custom_html") or ""
    include_disclaimer = data.get("include_disclaimer", False)

    if template == "custom" and custom_html:
        return custom_html

    edu_sub = f"{degree} • {uni}" if degree and uni else (degree or uni)

    links_html = []
    if email:
        links_html.append(f'<a href="mailto:{email}" style="color:{color};text-decoration:none;">{email}</a>')
    if phone:
        links_html.append(f'<span style="color:#64748b;">{phone}</span>')
    if linkedin:
        links_html.append(f'<a href="{linkedin}" style="color:{color};text-decoration:none;font-weight:600;">LinkedIn</a>')
    if github:
        links_html.append(f'<a href="{github}" style="color:{color};text-decoration:none;font-weight:600;">GitHub</a>')
    if portfolio:
        links_html.append(f'<a href="{portfolio}" style="color:{color};text-decoration:none;font-weight:600;">Portfolio</a>')

    links_line = " &nbsp;|&nbsp; ".join(links_html)

    disclaimer_html = ""
    if include_disclaimer:
        disclaimer_html = (
            '<p style="margin-top:12px;font-size:10px;color:#94a3b8;font-style:italic;line-height:1.4;">'
            'This message contains confidential information intended solely for the intended recipient. '
            'If you have received it in error, please notify the sender and delete immediately.'
            '</p>'
        )

    if template == "corporate":
        return f"""<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.5;margin-top:16px;">
  <p style="margin:0 0 10px 0;font-size:14px;color:#334155;">{greeting}</p>
  <table cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid {color};padding-top:10px;">
    <tr>
      <td>
        <div style="font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-0.2px;">{name}</div>
        <div style="font-size:13px;color:#475569;margin-top:2px;">{title}</div>
        {f'<div style="font-size:12px;color:#64748b;margin-top:2px;">{edu_sub}</div>' if edu_sub else ''}
        <div style="font-size:12px;margin-top:8px;color:#64748b;">{links_line}</div>
        {disclaimer_html}
      </td>
    </tr>
  </table>
</div>"""

    if template == "developer":
        tech_badge = f'<span style="background:{color}18;color:{color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;font-family:monospace;">DEVELOPER</span>'
        return f"""<div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#0f172a;line-height:1.6;margin-top:16px;">
  <p style="margin:0 0 8px 0;font-size:13px;color:#475569;">--<br />{greeting}</p>
  <div style="border-left:3px solid {color};padding-left:12px;">
    <div style="font-size:15px;font-weight:700;color:#0f172a;">{name} {tech_badge}</div>
    <div style="font-size:12px;color:#475569;margin-top:2px;">{title}</div>
    {f'<div style="font-size:11px;color:#64748b;">{edu_sub}</div>' if edu_sub else ''}
    <div style="font-size:11px;margin-top:6px;">{links_line}</div>
  </div>
  {disclaimer_html}
</div>"""

    if template == "academic":
        return f"""<div style="font-family:Georgia,serif;color:#1e293b;line-height:1.6;margin-top:16px;">
  <p style="margin:0 0 10px 0;font-size:14px;color:#334155;font-style:italic;">{greeting}</p>
  <div style="font-size:16px;font-weight:bold;color:#0f172a;">{name}</div>
  <div style="font-size:13px;color:#334155;">{title}</div>
  {f'<div style="font-size:12px;color:#475569;font-style:italic;">{edu_sub}</div>' if edu_sub else ''}
  <div style="font-size:12px;margin-top:6px;border-top:1px solid #e2e8f0;padding-top:6px;font-family:sans-serif;">{links_line}</div>
  {disclaimer_html}
</div>"""

    if template == "minimal":
        return f"""<div style="font-family:sans-serif;color:#334155;font-size:13px;line-height:1.5;margin-top:16px;">
  <p style="margin:0 0 6px 0;color:#64748b;">{greeting}</p>
  <strong>{name}</strong> • {title}
  <div style="font-size:12px;color:#64748b;margin-top:3px;">{links_line}</div>
</div>"""

    # Default: modern
    return f"""<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.5;margin-top:16px;">
  <p style="margin:0 0 10px 0;font-size:14px;color:#334155;">{greeting}</p>
  <table cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="border-left:3px solid {color};padding-left:12px;">
        <div style="font-size:15px;font-weight:700;color:#0f172a;">{name}</div>
        <div style="font-size:13px;color:#475569;margin-top:1px;">{title}</div>
        {f'<div style="font-size:12px;color:#64748b;margin-top:1px;">{edu_sub}</div>' if edu_sub else ''}
        <div style="font-size:12px;margin-top:6px;">{links_line}</div>
        {disclaimer_html}
      </td>
    </tr>
  </table>
</div>"""


def build_signature_text(data: Dict[str, Any], template: str = "modern") -> str:
    greeting = data.get("greeting", "Best regards,")
    name = data.get("full_name") or "Candidate"
    title = data.get("title") or "Software & AI Engineer"
    uni = data.get("university") or ""
    degree = data.get("degree") or ""
    email = data.get("email") or ""
    phone = data.get("phone") or ""
    linkedin = data.get("linkedin_url") or ""
    github = data.get("github_url") or ""
    portfolio = data.get("portfolio_url") or ""

    lines = [greeting, "", name, title]
    if degree and uni:
        lines.append(f"{degree} | {uni}")
    elif degree or uni:
        lines.append(degree or uni)

    contact_parts = []
    if email:
        contact_parts.append(f"Email: {email}")
    if phone:
        contact_parts.append(f"Tel: {phone}")
    if contact_parts:
        lines.append(" | ".join(contact_parts))

    links_parts = []
    if linkedin:
        links_parts.append(f"LinkedIn: {linkedin}")
    if github:
        links_parts.append(f"GitHub: {github}")
    if portfolio:
        links_parts.append(f"Portfolio: {portfolio}")
    if links_parts:
        lines.append(" | ".join(links_parts))

    return "\n".join(lines)


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
    if request.email_signature is not None:
        current_user.email_signature = request.email_signature
    if request.signature_template is not None:
        current_user.signature_template = request.signature_template
    if request.signature_data is not None:
        current_user.signature_data = request.signature_data
    if request.append_signature_default is not None:
        current_user.append_signature_default = request.append_signature_default

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/signature")
def get_signature(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(CandidateProfile).filter(CandidateProfile.user_id == current_user.id).first()
    data = current_user.signature_data or {}
    
    # Auto-fill sensible defaults from profile if not yet configured
    if not data:
        data = {
            "greeting": "Best regards,",
            "full_name": profile.full_name if profile and profile.full_name else current_user.full_name,
            "title": (profile.preferred_roles[0] if profile and profile.preferred_roles else "Software Engineer"),
            "university": profile.university if profile else "",
            "degree": profile.degree if profile else "",
            "email": profile.email if profile and profile.email else current_user.email,
            "phone": profile.phone if profile else "",
            "linkedin_url": profile.linkedin_url if profile else "",
            "github_url": profile.github_url if profile else "",
            "portfolio_url": profile.portfolio_url if profile else "",
            "accent_color": "#3b82f6",
            "include_disclaimer": False,
        }

    template = current_user.signature_template or "modern"
    html_rendered = current_user.email_signature or build_signature_html(data, template)
    text_rendered = build_signature_text(data, template)

    return {
        "template": template,
        "signature_data": data,
        "email_signature": html_rendered,
        "signature_text": text_rendered,
        "append_signature_default": current_user.append_signature_default if current_user.append_signature_default is not None else True,
    }


@router.post("/signature")
def save_signature(
    payload: SignaturePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data_dict = payload.dict()
    html_rendered = build_signature_html(data_dict, payload.template)
    text_rendered = build_signature_text(data_dict, payload.template)

    current_user.signature_template = payload.template
    current_user.signature_data = data_dict
    current_user.email_signature = html_rendered
    current_user.append_signature_default = payload.append_default

    db.commit()
    db.refresh(current_user)

    return {
        "status": "success",
        "message": "Signature saved successfully",
        "template": current_user.signature_template,
        "signature_data": current_user.signature_data,
        "email_signature": html_rendered,
        "signature_text": text_rendered,
        "append_signature_default": current_user.append_signature_default,
    }


@router.post("/signature/preview")
def preview_signature(payload: SignaturePayload):
    data_dict = payload.dict()
    return {
        "template": payload.template,
        "html": build_signature_html(data_dict, payload.template),
        "text": build_signature_text(data_dict, payload.template),
    }
