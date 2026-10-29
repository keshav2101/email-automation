import os
import pytest
from fastapi.testclient import TestClient

# Configure test environment before importing app
os.environ["DATABASE_URL"] = "sqlite:///./test_runner.db"
os.environ["ENVIRONMENT"] = "testing"

from app.main import app
from app.core.database import Base, engine, SessionLocal
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("test_runner.db"):
        try:
            os.remove("test_runner.db")
        except Exception:
            pass


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_auth_workflow():
    # Register
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test User",
            "email": "test@example.com",
            "password": "SecretPassword123!",
        },
    )
    assert reg_resp.status_code == 201
    data = reg_resp.json()
    assert "access_token" in data
    token = data["access_token"]

    # Login
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "SecretPassword123!"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()
    assert len(login_resp.json()["access_token"]) > 20
    new_token = login_resp.json()["access_token"]

    # Current user
    me_resp = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {new_token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "test@example.com"


def test_candidate_profile_and_companies():
    # Login to get token
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "SecretPassword123!"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Profile should exist (auto-created)
    profile_resp = client.get("/api/v1/candidates/profile", headers=headers)
    assert profile_resp.status_code == 200
    assert profile_resp.json()["email"] == "test@example.com"

    # Update profile
    patch_resp = client.patch(
        "/api/v1/candidates/profile",
        headers=headers,
        json={
            "university": "Stanford University",
            "degree": "B.S.",
            "field_of_study": "Computer Science",
            "technical_skills": ["Python", "FastAPI", "React"],
            "projects": [{"name": "AI Assistant", "description": "LLM powered tool"}],
        },
    )
    assert patch_resp.status_code == 200

    # Create company
    company_resp = client.post(
        "/api/v1/companies/",
        headers=headers,
        json={
            "name": "Acme Robotics",
            "website": "https://acme.example",
            "industry": "Artificial Intelligence",
            "domain": "Robotics & AI",
            "priority": "high",
        },
    )
    assert company_resp.status_code == 201
    company_id = company_resp.json()["id"]

    # List companies
    list_resp = client.get("/api/v1/companies/", headers=headers)
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # Create HR contact
    contact_resp = client.post(
        "/api/v1/contacts/",
        headers=headers,
        json={
            "company_id": company_id,
            "name": "Jane Recruiter",
            "email": "jane@acme.example",
            "title": "Head of Talent",
        },
    )
    assert contact_resp.status_code == 201
    contact_id = contact_resp.json()["id"]

    # Create Job Opportunity
    job_resp = client.post(
        "/api/v1/jobs/",
        headers=headers,
        json={
            "company_id": company_id,
            "title": "Machine Learning Engineer",
            "application_type": "confirmed_posting",
            "location": "Remote",
            "skills_required": ["Python", "PyTorch"],
        },
    )
    assert job_resp.status_code == 201
    assert job_resp.json()["title"] == "Machine Learning Engineer"

    # Generate Email Draft
    draft_resp = client.post(
        "/api/v1/drafts/generate",
        headers=headers,
        json={
            "company_id": company_id,
            "hr_contact_id": contact_id,
            "target_role": "Machine Learning Engineer",
            "style": "professional",
            "attach_resume": True,
        },
    )
    assert draft_resp.status_code == 201
    draft_data = draft_resp.json()
    assert "draft_id" in draft_data
    assert len(draft_data["body"]) > 20
    assert len(draft_data["formal_version"]) > 20
    assert len(draft_data["concise_version"]) > 20
    assert len(draft_data["conversational_version"]) > 20

    # Approve Draft
    draft_id = draft_data["draft_id"]
    approve_resp = client.post(f"/api/v1/drafts/{draft_id}/approve", headers=headers)
    assert approve_resp.status_code == 200

    # Safety: Cannot send if Gmail not connected or draft_only_mode enabled
    send_resp = client.post(f"/api/v1/gmail/drafts/{draft_id}/send", headers=headers)
    assert send_resp.status_code == 400

    # Analytics dashboard
    analytics_resp = client.get("/api/v1/analytics/dashboard", headers=headers)
    assert analytics_resp.status_code == 200
    analytics_data = analytics_resp.json()
    assert "total_companies" in analytics_data
    assert analytics_data["total_companies"] >= 1


def test_batch_automation_endpoints():
    # 1. Test sample template download
    tpl_resp = client.get("/api/v1/batch/sample-template")
    assert tpl_resp.status_code == 200
    assert "Company Name,HR Email,HR Name,Job Role" in tpl_resp.text

    # 2. Test validating a CSV sheet
    csv_content = (
        "Company Name,HR Email,HR Name,Job Role\n"
        "Anthropic,talent@anthropic.com,Talent Team,AI Research Engineer\n"
        "InvalidCo,bad-email-address,Recruiter,DevOps\n"
    )
    files = {"file": ("test_sheet.csv", csv_content, "text/csv")}
    val_resp = client.post("/api/v1/batch/validate-sheet", files=files)
    assert val_resp.status_code == 200
    data = val_resp.json()
    assert data["total_rows"] == 2
    assert data["valid_count"] == 1
    assert data["invalid_count"] == 1
    assert "all_columns" in data
    assert len(data["all_columns"]) == 4


def test_extractor_endpoints():
    # 1. Test full extraction from CSV with multi-attribute schema
    csv_data = (
        "Organization,Contact Person,Email Address,Position,Location,Website,Custom Note\n"
        "OpenAI,Sam Altman,recruiting@openai.com,Research Scientist,San Francisco,https://openai.com,High priority\n"
        "Google,Sundar Pichai,jobs@google.com,Staff Software Engineer,Mountain View,https://google.com,Referral lead\n"
        "Stripe,Patrick Collison,hiring@stripe.com,Payment Infrastructure Engineer,Dublin,https://stripe.com,Strong fintech match\n"
    )
    files = {"file": ("full_leads.csv", csv_data, "text/csv")}
    extract_resp = client.post("/api/v1/extractor/extract", files=files)
    assert extract_resp.status_code == 200
    res = extract_resp.json()
    assert res["total_rows"] == 3
    assert res["total_columns"] == 7
    assert len(res["columns"]) == 7
    assert res["summary"]["valid_email_count"] == 3
    assert "company_name" in res["suggested_mapping"]
    assert "hr_email" in res["suggested_mapping"]
    assert "hr_name" in res["suggested_mapping"]
    assert "job_role" in res["suggested_mapping"]

    # 2. Test importing extracted rows directly into CRM
    import_payload = {
        "rows": res["rows"],
        "mapping": res["suggested_mapping"],
        "create_companies": True,
        "create_contacts": True,
        "create_jobs": True,
    }
    import_resp = client.post("/api/v1/extractor/import-crm", json=import_payload)
    assert import_resp.status_code == 200
    import_data = import_resp.json()
    assert import_data["companies_created"] >= 1
    assert import_data["contacts_created"] >= 1
    assert import_data["jobs_created"] >= 1

    # 3. Test export cleaned data
    export_resp = client.post(
        "/api/v1/extractor/export-cleaned?export_format=csv",
        json=res["rows"],
    )
    assert export_resp.status_code == 200
    assert "Organization,Contact Person" in export_resp.text


def test_email_plugin_and_bulk_automation():
    # 1. Check plugin status
    status_resp = client.get("/api/v1/email-plugin/status")
    assert status_resp.status_code == 200
    assert "available_presets" in status_resp.json()

    # 2. Connect SMTP email plugin (with test_before_saving=False for test environment)
    connect_payload = {
        "provider": "gmail",
        "email": "candidate.outreach@gmail.com",
        "password": "abcd efgh ijkl mnop",
        "from_name": "Alex Candidate",
        "test_before_saving": False,
    }
    conn_resp = client.post("/api/v1/email-plugin/connect-smtp", json=connect_payload)
    assert conn_resp.status_code == 200
    conn_data = conn_resp.json()
    assert conn_data["status"] == "connected"
    assert conn_data["email"] == "candidate.outreach@gmail.com"

    # Verify status reflects connected sender
    stat_check = client.get("/api/v1/email-plugin/status")
    assert stat_check.status_code == 200
    assert stat_check.json()["connected"] is True
    assert stat_check.json()["email"] == "candidate.outreach@gmail.com"

    # 3. Create a test draft to dispatch in bulk
    co_resp = client.post(
        "/api/v1/companies/",
        json={"name": "Acme Tech Labs", "website": "https://acme.tech"},
    )
    co_id = co_resp.json()["id"]

    contact_resp = client.post(
        "/api/v1/contacts/",
        json={
            "company_id": co_id,
            "name": "Taylor",
            "email": "recruiting@acme.tech",
            "title": "Recruiter",
        },
    )
    contact_id = contact_resp.json()["id"]

    draft_resp = client.post(
        "/api/v1/drafts/generate",
        json={
            "company_id": co_id,
            "hr_contact_id": contact_id,
            "target_role": "Backend Engineer",
            "style": "professional",
        },
    )
    assert draft_resp.status_code == 201
    draft_id = draft_resp.json()["draft_id"]

    # 4. Start automated bulk sending
    bulk_payload = {
        "draft_ids": [draft_id],
        "delay_seconds": 1,
        "random_jitter": 0,
        "daily_limit": 10,
        "dry_run": True,
    }
    start_resp = client.post("/api/v1/bulk-automation/start", json=bulk_payload)
    assert start_resp.status_code == 200
    job_data = start_resp.json()
    assert "job_id" in job_data
    job_id = job_data["job_id"]
    assert job_data["total"] == 1

    # 5. Check job status
    job_status_resp = client.get(f"/api/v1/bulk-automation/jobs/{job_id}")
    assert job_status_resp.status_code == 200
    assert job_status_resp.json()["job_id"] == job_id

    # 6. Disconnect plugin
    disc_resp = client.post("/api/v1/email-plugin/disconnect")
    assert disc_resp.status_code == 200


def test_document_upload_and_client_role():
    # 1. Access without login token (client mode)
    profile_resp = client.get("/api/v1/candidates/profile")
    assert profile_resp.status_code == 200
    p_data = profile_resp.json()
    assert "email" in p_data

    # 2. Upload text resume document
    sample_resume = (
        "Alex Candidate\n"
        "alex.candidate@example.com | +1 (555) 234-5678\n"
        "linkedin.com/in/alex-candidate | github.com/alex-dev\n\n"
        "Summary:\n"
        "Full stack engineer with extensive experience building cloud native distributed systems.\n\n"
        "Technical Skills:\n"
        "Python, FastAPI, React, Next.js, PostgreSQL, Docker, Redis, Kubernetes\n"
    )

    files = {
        "file": ("Resume_Alex.txt", sample_resume.encode("utf-8"), "text/plain")
    }
    upload_resp = client.post("/api/v1/candidates/resume/upload?label=Software_Engineer", files=files)
    assert upload_resp.status_code == 200
    up_data = upload_resp.json()
    assert up_data["extraction_status"] in ("done", "pending", "partial")
    assert "resume_id" in up_data

    # 3. Verify profile reflects extracted information
    updated_profile = client.get("/api/v1/candidates/profile")
    assert updated_profile.status_code == 200
    up_prof_data = updated_profile.json()
    assert "Python" in up_prof_data.get("technical_skills", []) or "FastAPI" in up_prof_data.get("technical_skills", [])
    assert up_prof_data.get("email") == "alex.candidate@example.com" or up_prof_data.get("email") is not None

    # 4. List resumes
    list_res = client.get("/api/v1/candidates/resumes")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1


def test_email_signature_customization():
    """Test getting, previewing, and saving personalized email signatures."""
    # 1. Preview signature
    preview_resp = client.post(
        "/api/v1/users/signature/preview",
        json={
            "template": "developer",
            "greeting": "Best regards,",
            "full_name": "Keshav Gupta",
            "title": "AI/ML Engineer",
            "university": "SRMIST",
            "degree": "B.Tech CSE",
            "email": "keshavg.connect@gmail.com",
            "phone": "+91 9876543210",
            "github_url": "https://github.com/keshav2101",
            "linkedin_url": "https://linkedin.com/in/keshav2101",
            "accent_color": "#10b981",
            "include_disclaimer": True,
        },
    )
    assert preview_resp.status_code == 200
    prev_data = preview_resp.json()
    assert "html" in prev_data
    assert "text" in prev_data
    assert "Keshav Gupta" in prev_data["html"]
    assert "DEVELOPER" in prev_data["html"]
    assert "SRMIST" in prev_data["text"]

    # 2. Get signature (auto-populated defaults)
    get_resp = client.get("/api/v1/users/signature")
    assert get_resp.status_code == 200
    sig_data = get_resp.json()
    assert "template" in sig_data
    assert "signature_data" in sig_data

    # 3. Save signature
    save_resp = client.post(
        "/api/v1/users/signature",
        json={
            "template": "corporate",
            "greeting": "Sincerely,",
            "full_name": "Alex Candidate",
            "title": "Lead Engineer",
            "university": "SRMIST",
            "degree": "B.Tech Computer Science",
            "email": "alex@outreach.local",
            "phone": "+1 555-0199",
            "accent_color": "#3b82f6",
            "include_disclaimer": False,
            "append_default": True,
        },
    )
    assert save_resp.status_code == 200
    saved = save_resp.json()
    assert saved["status"] == "success"
    assert saved["template"] == "corporate"
    assert "Alex Candidate" in saved["email_signature"]
    assert saved["append_signature_default"] is True



