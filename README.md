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
