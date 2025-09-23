@echo off
echo Starting Announcement Service...
cd announcement_service
uvicorn main:app --host 0.0.0.0 --port 8003
pause
