@echo off
title HR Outreach & Email Automation System
cls
echo =====================================================================
echo           HR Outreach & Email Automation System - Unified Hub
echo =====================================================================
echo.
echo Choose an option to launch:
echo   [1] Launch Unified Web Platform (Next.js 14 + FastAPI) [Recommended]
echo   [2] Launch Streamlit Batch Automation App (Port 8501)
echo   [3] Launch Everything (FastAPI + Next.js + Streamlit)
echo   [4] Launch with Docker Compose (Production Stack)
echo   [5] Run Backend Test Suite (pytest)
echo.
set /p choice="Enter your choice [1-5]: "

if "%choice%"=="1" goto run_unified
if "%choice%"=="2" goto run_streamlit
if "%choice%"=="3" goto run_all
if "%choice%"=="4" goto run_docker
if "%choice%"=="5" goto run_tests
goto invalid

:run_unified
echo.
echo Starting FastAPI backend on http://localhost:8000 ...
start "Backend - FastAPI" cmd /k "cd backend && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
echo Starting Next.js frontend on http://localhost:3000 ...
start "Frontend - Next.js" cmd /k "cd frontend && npm run dev"
echo.
echo Done! Open http://localhost:3000 in your browser.
goto end

:run_streamlit
echo.
echo Starting Streamlit app on http://localhost:8501 ...
cd backend && call .venv\Scripts\activate.bat && cd .. && streamlit run streamlit_app.py --server.port 8501
goto end

:run_all
echo.
echo Starting FastAPI backend on http://localhost:8000 ...
start "Backend - FastAPI" cmd /k "cd backend && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000"
echo Starting Next.js frontend on http://localhost:3000 ...
start "Frontend - Next.js" cmd /k "cd frontend && npm run dev"
echo Starting Streamlit on http://localhost:8501 ...
start "Streamlit App" cmd /k "cd backend && call .venv\Scripts\activate.bat && cd .. && streamlit run streamlit_app.py --server.port 8501"
echo.
echo All services launched!
echo - Web App:    http://localhost:3000
echo - API Docs:   http://localhost:8000/docs
echo - Streamlit:  http://localhost:8501
goto end

:run_docker
echo.
echo Launching Docker Compose stack...
docker compose up --build -d
echo.
echo Containers started!
echo - Web App:    http://localhost:3000
echo - API Docs:   http://localhost:8000/docs
goto end

:run_tests
echo.
echo Running pytest test suite...
cd backend && call .venv\Scripts\activate.bat && pytest tests/ -v
pause
goto end

:invalid
echo Invalid choice. Exiting.
:end
