@echo off
echo Starting Room Service...
cd room_service
uvicorn main:app --host 0.0.0.0 --port 8004
pause
