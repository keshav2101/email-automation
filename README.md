# 🚀 HR Outreach & AI Cold Email Automation Platform

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-000000?style=for-the-badge&logo=vercel)](https://vercel.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

> A full-stack, AI-powered HR and recruiter outreach automation platform that unifies an enterprise **HR CRM & Cold Email Studio** with a **5-Step Excel/CSV Batch Automation Pipeline**. Upload your resume once, import recruiter lists, pre-validate emails & duplicates, generate 100–150 word company-tailored emails, and dispatch via Gmail with deliverability controls.

---

## 🌟 Key Highlights & Features

### 📄 1. Deep Resume Parser & Candidate Profile
- **Single Source of Truth:** Extracts and organizes your profile directly from uploaded resumes (PDF, DOCX, DOC, TXT, RTF) without fabricating credentials.
- **Comprehensive Section Parsing:**
  - **Academic Background:** University, Degree, Field of Study, Graduation Year, and Dual CGPA/Honours.
  - **Experience & Internships:** Categorizes entries into professional research roles and industry internships with durations and bulleted accomplishments.
  - **Projects:** Extracts project titles, descriptions, and technology stacks.
  - **Peer-Reviewed Publications:** Detects research papers with journal/venue names, years, and verified clickable DOIs.
  - **Categorized Skills:** Programming Languages, Frameworks & Libraries, Technical & Domain Skills, and Developer Tools.
  - **Achievements & Certifications:** Hackathons, honors, certifications, and filed patents.
- **1-Click Profile Re-Sync:** Re-analyze and synchronize profile data instantly from any previously uploaded document.

### 📊 2. Universal Excel & CSV Data Extractor
- **Zero-Schema Restrictions:** Ingests any `.xlsx`, `.xls`, or `.csv` workbook regardless of formatting.
- **Multi-Sheet Navigation:** Interactive tabbed interface for workbooks containing multiple sheets.
- **Automatic Column Profiling:** Detects semantic data types (`Email`, `URL`, `Phone`, `Number`, `Date`, `Boolean`, `Text`).
- **Data Quality Healthcheck:** Live column fill rates, unique counts, non-empty counts, and sample previews.
- **1-Click Sync to CRM:** Synchronize parsed recruiters, companies, and jobs directly into the database with automatic deduplication.

### ✉️ 3. 5-Step Excel/CSV Batch Outreach Pipeline
- **Auto-Column Mapping:** Automatically matches columns for Company Name, HR Name, HR Email, and Job Title.
- **Pre-Validation Engine:** Flags invalid email syntax, duplicates within the spreadsheet, and contacts already emailed previously.
- **Concise 100–150 Word Cold Emails:** Generates hyper-tailored emails referencing the candidate's exact background and matching the company's domain.
- **Inline Editor:** Inspect, edit, and fine-tune each cold email before queuing.
- **Deliverability & Safety Throttle:** Configurable inter-email sending delays (e.g., 5s, 10s, 30s) and daily quota safeguards.

### 🔒 4. Seamless Gmail Integration & Handshake Verification
- **Google App Password Authentication:** Connect your Gmail account using a 16-character Google App Password.
- **Real-Time SMTP Handshake:** Validates sender credentials against `smtp.gmail.com` with zero OAuth redirect friction.
- **Direct Client Mode:** Instant access to all dashboard tools without mandatory login walls.

---

## 🏗️ Architecture

```
Email Automation/
├── frontend/                     # Next.js 14 App Router (Tailwind CSS, Lucide, Axios)
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   │   ├── profile/          # Resume extraction & candidate profile
│   │   │   │   ├── excel-automation/ # 5-Step batch cold email pipeline
│   │   │   │   ├── data-extractor/   # Universal Excel/CSV sheet analyzer
│   │   │   │   ├── studio/           # AI Cold Email Studio & playground
│   │   │   │   ├── settings/         # Gmail connection & handshake test
│   │   │   │   ├── companies/        # Company CRM
│   │   │   │   ├── contacts/         # HR Recruiter CRM
│   │   │   │   ├── jobs/             # Job opportunity tracking
│   │   │   │   └── analytics/        # Outreach metrics & deliverability logs
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/               # Reusable UI components & Sidebar
│   │   └── lib/                      # API client, TypeScript definitions & state
│   ├── package.json
│   └── vercel.json                   # Vercel deployment configuration
│
├── backend/                      # FastAPI Backend
│   ├── app/
│   │   ├── api/v1/endpoints/         # REST APIs (candidates, batch, extractor, drafts...)
│   │   ├── core/                     # Config, auto-guest auth, database connection
│   │   ├── models/                   # SQLAlchemy ORM models (Candidate, Drafts, Companies...)
│   │   ├── schemas/                  # Pydantic validation schemas
│   │   ├── services/                 # AI resume parsing, email dispatch, rate limiters
│   │   └── main.py                   # FastAPI application entrypoint
│   ├── tests/                        # Pytest test suite (100% passing)
│   └── requirements.txt
│
├── docker-compose.yml            # Multi-container orchestration (Web, API, Postgres, Redis)
├── vercel.json                   # Monorepo root configuration for Vercel
├── start.bat                     # Windows 1-click startup script
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended) **OR** Python 3.11+ and Node.js 18+

### Option A: Docker Compose (Fastest & Recommended)
```bash
# 1. Clone the repository
git clone https://github.com/keshav2101/email-automation.git
cd email-automation

# 2. Start all services
docker compose up -d
```
All services will initialize automatically:
- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **FastAPI Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **PostgreSQL Database:** `localhost:5434`
- **Redis Cache:** `localhost:6380`

---

### Option B: Windows 1-Click Launcher
Run the built-in batch script in PowerShell or Command Prompt:
```cmd
.\start.bat
```
Select an option:
- `[1]` Launch Web Platform (Frontend + Backend)
- `[3]` Launch Everything
- `[4]` Launch with Docker Compose
- `[5]` Run Pytest Test Suite

---

### Option C: Manual Setup

#### 1. Backend Setup
```bash
cd backend
python -m venv .venv

# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🌐 Deploying Frontend on Vercel

The frontend is fully configured for zero-config deployment on [Vercel](https://vercel.com/):

### Method 1: Deploy with Vercel Web Dashboard (1-Click)
1. Push this repository to your GitHub account (`https://github.com/keshav2101/email-automation`).
2. Log in to [Vercel](https://vercel.com/) and click **"Add New Project"** > **"Import Git Repository"**.
3. Select your `email-automation` repository.
4. Configure the project settings:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Select `frontend` (or leave default with the included `vercel.json`)
   - **Environment Variables:**
     - `NEXT_PUBLIC_API_URL`: Your deployed backend URL (e.g. `https://your-api.onrender.com/api/v1` or `http://localhost:8000/api/v1`)
5. Click **Deploy**. Vercel will build and assign you a live HTTPS domain (`https://your-app.vercel.app`).

### Method 2: Deploy with Vercel CLI
```bash
cd frontend
npx vercel
```
Follow the interactive prompts to link and deploy to your Vercel account. For production release:
```bash
npx vercel --prod
```

---

## 🛠️ Backend Cloud Deployment

The FastAPI backend can be deployed for free on platforms like **Render**, **Railway**, or **Fly.io**:

### Deploying to Render / Railway
1. **Database:** Create a managed PostgreSQL instance (e.g., on Render or Supabase) and copy the connection string.
2. **Web Service:** Create a new Web Service pointing to the `backend/` directory or root Dockerfile.
3. **Environment Variables:**
   - `DATABASE_URL`: Your cloud PostgreSQL URL
   - `SECRET_KEY`: Any secure random 32+ character string
   - `GEMINI_API_KEY`: *(Optional)* Your Google AI Gemini key
   - `FRONTEND_URL`: Your deployed Vercel frontend domain (`https://your-app.vercel.app`)

---

## 🧪 Testing & Validation

The backend includes comprehensive integration tests covering authentication bypass, candidate profile extraction, batch Excel workflows, and CRM lifecycle:

```bash
cd backend
.\.venv\Scripts\activate
pytest tests/ -v
```

**Results:**
```
============================= test session starts =============================
test_api.py::test_health_check PASSED                                    [ 14%]
test_api.py::test_auth_workflow PASSED                                   [ 28%]
test_api.py::test_candidate_profile_and_companies PASSED                 [ 42%]
test_api.py::test_batch_automation_endpoints PASSED                      [ 57%]
test_api.py::test_extractor_endpoints PASSED                             [ 71%]
test_api.py::test_email_plugin_and_bulk_automation PASSED                [ 85%]
test_api.py::test_document_upload_and_client_role PASSED                 [100%]
============================== 7 passed in 7.18s ==============================
```

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use, modify, and distribute for personal or commercial projects.
