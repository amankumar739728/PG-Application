@echo off
echo Starting Menu Service...
cd menu_service
uvicorn main:app --host 0.0.0.0 --port 8002
pause
