# PG Management Service - Microservices Architecture

A comprehensive PG (Paying Guest) management system built with microservices architecture using FastAPI and MongoDB.

## Services Overview

- **Auth Service** (Port 8000): User authentication, authorization, and management
- **Feedback Service** (Port 8001): Guest feedback management
- **Menu Service** (Port 8002): Meal menu management
- **Announcement Service** (Port 8003): Announcements and notifications
- **Room Service** (Port 8004): Room management and status
- **Search Service** (Port 8005): Search functionality

## Prerequisites

- Docker and Docker Compose
- Python 3.11+ (for local development)

## Quick Start with Docker Compose

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f
   ```

3. **Stop services:**
   ```bash
   docker-compose down
   ```

## Service URLs

After starting the services, access them at:

- **Auth Service**: http://localhost:8000/docs
- **Feedback Service**: http://localhost:8001/docs
- **Menu Service**: http://localhost:8002/docs
- **Announcement Service**: http://localhost:8003/docs
- **Room Service**: http://localhost:8004/docs
- **Search Service**: http://localhost:8005/docs

## Testing the Services

1. **Run the test script:**
   ```bash
   python test_services.py
   ```

2. **Manual testing with curl:**
   ```bash
   # Test auth service
   curl -X POST http://localhost:8000/signup -H "Content-Type: application/json" -d '{
     "username": "testuser",
     "email": "test@example.com",
     "password": "Test@12345",
     "full_name": "Test User",
     "phone": "1234567890",
     "aadhar": "123456789012",
     "role": "guest"
   }'

   # Test feedback service
   curl http://localhost:8001/feedbacks

   # Test menu service
   curl http://localhost:8002/menu

   # Test announcement service
   curl http://localhost:8003/announcements

   # Test room service
   curl http://localhost:8004/rooms

   # Test search service
   curl http://localhost:8005/search?q=test
   ```

## Environment Variables

The services use the following environment variables:

- `MONGO_URL`: MongoDB connection string (default: mongodb://mongo:27017)
- `SUPERADMIN_USERNAME`: Super admin username
- `SUPERADMIN_EMAIL`: Super admin email
- `SUPERADMIN_PASSWORD`: Super admin password
- `SUPERADMIN_ROLE`: Super admin role

## Development

### Running Services Individually

Each service can be run individually:

```bash
cd auth_service
uvicorn main:app --host 0.0.0.0 --port 8000

cd ../feedback_service
uvicorn main:app --host 0.0.0.0 --port 8001

# ... and so on for other services
```

### Building Individual Services

```bash
cd auth_service
docker build -t pg_auth_service .
docker run -p 8000:8000 pg_auth_service
```

## Project Structure

```
.
├── auth_service/          # Authentication microservice
│   ├── main.py
│   ├── routes.py
│   ├── schemas.py
│   ├── utils.py
│   ├── token_utils.py
│   ├── email_utils.py
│   ├── Dockerfile
│   └── requirements.txt
├── feedback_service/      # Feedback management
├── menu_service/         # Menu management
├── announcement_service/ # Announcements
├── room_service/         # Room management
├── search_service/       # Search functionality
├── common/               # Shared utilities
├── docker-compose.yml    # Multi-container setup
├── test_services.py      # Service testing script
└── README.md
```

## Next Steps for Improvement

1. **Add authentication middleware** to all services
2. **Implement API Gateway** for centralized routing
3. **Create shared utilities** in common module
4. **Add comprehensive testing** for each service
5. **Implement proper error handling** and validation
6. **Set up monitoring** and logging

## Troubleshooting

1. **Port conflicts**: Ensure ports 8000-8005 are available
2. **MongoDB connection**: Check if MongoDB container is running
3. **Service dependencies**: Services depend on MongoDB and Auth service

## Support

For issues and questions, check the service logs and ensure all containers are running properly.



## SMTP to Sendgrid Migration guide in existing code:


# This file will provide the guide on switching to sendgrid from smtp(working locally) but
# for production we needed sendgrid(free for 3 month then change it)
# db.py will be used for sending mail using smtp
# db_sendgrid will be used for sending mail using sendgrid but need to create an account on sendgrid
# after account creation need to verify the same and then after need to generate API_KEY for integration


# SendGrid Migration Complete Guide

## Phase 1: SendGrid Account Setup (Do This First)

### About Local Testing vs Production

**Local Development (Your Computer):**
- You can continue using SMTP (your old setup) for local testing
- Or switch to SendGrid API locally too (recommended for consistency)
- No need to change anything - your current SMTP setup works fine locally

**Production on Render:**
- MUST use SendGrid API (SMTP is blocked by Render)
- This is why we're migrating

**Recommendation:** Keep your old SMTP setup for local testing, but also test SendGrid locally to ensure everything works. When deploying to Render, use SendGrid.

---

### Step 1: Create SendGrid Account
1. Go to https://sendgrid.com/
2. Click "Sign up for free"
3. Fill in your details:
   - Email: Your email address
   - Password: Create strong password
   - Company: Your company name (or just PG Tracker)
   - Click "Create Account"
4. Verify your email by clicking the verification link

### Step 2: Generate SendGrid API Key
1. After login, go to **Settings** → **API Keys**
2. Click **"Create API Key"**
3. Give it a name: `PG-Tracker-Room-Service`
4. Select **Full Access** (or select these permissions):
   - Mail Send
   - Mail Settings
   - Read
5. Click **"Create & Activate"**
6. **COPY THE API KEY** (you won't be able to see it again!)
7. Save it in a safe place

### Step 3: Verify Sender Email (Critical!)
1. Go to **Settings** → **Sender Authentication**
2. Click **"Verify a Single Sender"** (or "Create a Domain")
3. Enter your email address (this is the "From" email for notifications)
4. Complete the verification process
5. Use this email as your `MAIL_FROM` environment variable

**Important:** Only verified sender emails can send emails via SendGrid!

---

## Phase 2: Update Backend Requirements

### Step 4: Update requirements.txt

Open `room_service/requirements.txt` and add SendGrid:

```txt
fastapi==0.104.1
uvicorn==0.24.0
pymongo==4.6.1
python-multipart==0.0.6
python-dotenv==1.0.0
bcrypt==4.3.0
pydantic==2.5.0
httpx==0.25.1
sendgrid==6.11.0
python-http-client==3.3.7
```

Make sure `sendgrid==6.11.0` is added.

---

## Phase 3: Replace db.py File

### Step 5: Backup Current db.py
```bash
# In terminal, navigate to room_service folder
cp db.py db_smtp_backup.py
```

### Step 6: Use New db_sendgrid.py
The new db file with complete SendGrid implementation is ready. Replace your current db.py:

```bash
# Replace the current db.py with the SendGrid version
cp db_sendgrid.py db.py
```

**OR** manually copy all content from the provided `db_sendgrid.py` to your existing `db.py` file.

**Key changes in new db.py:**
- Removed SMTP imports and code
- Added SendGrid imports: `from sendgrid import SendGridAPIClient`
- All email functions now use SendGrid API instead of SMTP
- Environment variables changed:
  - `SENDGRID_API_KEY` - Your API key from step 2
  - `MAIL_FROM` - Your verified sender email from step 3
  - Removed: `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`

---

## Phase 4: Update main.py (Email Endpoints)

### Step 7: Update Async Pattern in main.py

Find these two endpoints in your `room_service/main.py` and update them:

**Endpoint 1: send_bulk_notifications_endpoint**

```python
from threading import Thread

@app.post("/payments/send-notifications", response_model=dict, tags=["Payment"])
def send_bulk_notifications_endpoint(
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Send bulk payment notifications to all guests asynchronously (Admin only)"""
    def send_notifications_background():
        try:
            result = send_bulk_payment_notifications()
            logger.info(f"Bulk notifications completed: Sent {result['sent']}, Failed {result['failed']}")
        except Exception as e:
            logger.error(f"Error sending bulk notifications in background: {e}", exc_info=True)
    
    # Spawn background thread and return immediately
    thread = Thread(target=send_notifications_background, daemon=True)
    thread.start()
    
    return {
        "message": "Notifications are being sent in the background. You will receive updates shortly.",
        "status": "processing"
    }
```

**Endpoint 2: send_monthly_rent_reminders_endpoint**

```python
@app.post("/payments/send-monthly-reminders", response_model=dict, tags=["Payment"])
def send_monthly_rent_reminders_endpoint(
    user: dict = Depends(require_role(ADMIN_ROLES)),
    force: bool = Query(False, description="Force send reminders even if not the 5th of the month (for testing)")
):
    """Send monthly rent reminders asynchronously to all guests who haven't paid for the current month (Admin only)"""
    def send_reminders_background():
        try:
            result = send_monthly_rent_reminders(force=force)
            if result.get("skipped"):
                logger.info("Monthly reminders skipped: not the 5th of the month")
            else:
                logger.info(f"Monthly reminders completed: Sent {result.get('sent', 0)}, Failed {result.get('failed', 0)}")
        except Exception as e:
            logger.error(f"Error sending monthly reminders in background: {e}", exc_info=True)
    
    # Spawn background thread and return immediately
    thread = Thread(target=send_reminders_background, daemon=True)
    thread.start()
    
    return {
        "message": "Monthly reminders are being sent in the background. You will receive updates shortly.",
        "status": "processing"
    }
```

---

## Phase 5: Configure Render Environment Variables

### Step 8: Set Environment Variables in Render

1. Go to your Render dashboard: https://dashboard.render.com/
2. Select your **room_service** project
3. Go to **Settings** → **Environment**
4. Add/Update these environment variables:

```
SENDGRID_API_KEY = your_api_key_from_step_2
MAIL_FROM = your_verified_email_from_step_3
MONGO_URL = your_existing_mongo_url
```

**Example:**
```
SENDGRID_API_KEY = SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAIL_FROM = notifications@pgtracker.com
MONGO_URL = mongodb+srv://username:password@cluster.mongodb.net/pgtracker
```

**IMPORTANT:** Make sure to keep your MONGO_URL and other existing variables!

### Step 9: Remove Old SMTP Variables (Optional but Recommended)
If your Render environment has these old variables, you can delete them:
- `MAIL_SERVER`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`

