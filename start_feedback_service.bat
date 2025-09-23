@echo off
echo Starting Feedback Service...
cd feedback_service
uvicorn main:app --host 0.0.0.0 --port 8001
pause
