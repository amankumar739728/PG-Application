@echo off
echo Stopping all running services...
taskkill /IM uvicorn.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting all services...
start /b cmd /c "call pgvenv\Scripts\activate.bat && cd auth_service && uvicorn main:app --host 0.0.0.0 --port 8000"
start /b cmd /c "call pgvenv\Scripts\activate.bat && cd feedback_service && uvicorn main:app --host 0.0.0.0 --port 8001"
start /b cmd /c "call pgvenv\Scripts\activate.bat && cd menu_service && uvicorn main:app --host 0.0.0.0 --port 8002"
start /b cmd /c "call pgvenv\Scripts\activate.bat && cd announcement_service && uvicorn main:app --host 0.0.0.0 --port 8003"
start /b cmd /c "call pgvenv\Scripts\activate.bat && cd room_service && uvicorn main:app --host 0.0.0.0 --port 8004"

echo All services have been restarted.
