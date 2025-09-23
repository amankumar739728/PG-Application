# PG Management Services - Startup Guide

## How to Start Services Using Batch Files

### Prerequisites
1. Ensure you have Python 3.11+ installed
2. Activate your virtual environment (if using one)
3. Install dependencies: `pip install -r requirements.txt`

### Starting Services Individually

**Method 1: Using the batch files (Windows)**
Double-click on each batch file to start the corresponding service:

1. **Auth Service** - `start_auth_service.bat`
   - Runs on port 8000
   - Provides authentication and user management

2. **Feedback Service** - `start_feedback_service.bat`
   - Runs on port 8001
   - Handles guest feedback

3. **Menu Service** - `start_menu_service.bat`
   - Runs on port 8002
   - Manages meal menus

4. **Announcement Service** - `start_announcement_service.bat`
   - Runs on port 8003
   - Handles announcements

5. **Room Service** - `start_room_service.bat`
   - Runs on port 8004
   - Manages room information

6. **Search Service** - `start_search_service.bat`
   - Runs on port 8005
   - Provides search functionality

**Method 2: Manual Command Line**
Open separate terminal windows and run:
```bash
# Terminal 1 - Auth Service
cd auth_service && uvicorn main:app --host 0.0.0.0 --port 8000

# Terminal 2 - Feedback Service  
cd feedback_service && uvicorn main:app --host 0.0.0.0 --port 8001

# Terminal 3 - Menu Service
cd menu_service && uvicorn main:app --host 0.0.0.0 --port 8002

# Terminal 4 - Announcement Service
cd announcement_service && uvicorn main:app --host 0.0.0.0 --port 8003

# Terminal 5 - Room Service
cd room_service && uvicorn main:app --host 0.0.0.0 --port 8004

# Terminal 6 - Search Service
cd search_service && uvicorn main:app --host 0.0.0.0 --port 8005
```

### Testing the Services

After starting all services, run the test script:
```bash
python test_services.py
```

Or test manually using curl:
```bash
# Test Auth Service
curl http://localhost:8000/docs

# Test Feedback Service
curl http://localhost:8001/feedbacks

# Test Menu Service
curl http://localhost:8002/menu

# Test Announcement Service
curl http://localhost:8003/announcements

# Test Room Service
curl http://localhost:8004/rooms

# Test Search Service
curl http://localhost:8005/search?q=test
```

### Important Notes

1. **MongoDB Required**: Ensure MongoDB is running on localhost:27017
2. **Port Availability**: Make sure ports 8000-8005 are not in use
3. **Environment**: All services expect MongoDB at `mongodb://localhost:27017`
4. **Order**: Start Auth Service first as other services may depend on it

### Troubleshooting

- If services fail to start, check if MongoDB is running
- Verify Python dependencies are installed
- Check that ports are not already in use
- Look for error messages in the terminal output

### Service URLs
- Auth: http://localhost:8000/docs
- Feedback: http://localhost:8001/docs
- Menu: http://localhost:8002/docs
- Announcement: http://localhost:8003/docs
- Room: http://localhost:8004/docs
- Search: http://localhost:8005/docs
