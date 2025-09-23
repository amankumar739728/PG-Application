@echo off
echo Starting Auth Service...
cd auth_service
uvicorn main:app --host 0.0.0.0 --port 8000
pause
