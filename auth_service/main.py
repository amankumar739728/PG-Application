import os
from utils import get_password_hash, verify_jwt, AuthUtil
from pymongo.errors import DuplicateKeyError
from fastapi import FastAPI, HTTPException, Request
from routes import router, limiter
import logging
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.middleware import SlowAPIMiddleware

# Ensure logs directory exists
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_PATH = os.path.join(LOG_DIR, "pgapplication.log")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH),
        logging.StreamHandler()
    ]
)

app = FastAPI(title="Auth Service")
app.include_router(router)

# Middleware
origins = [
    "https://pg-application-frontend.onrender.com",
    "http://localhost:3000",  # For local development
]

app.add_middleware(
    CORSMiddleware,
    #allow_origins=["*"],
    allow_origins= origins,
    allow_credentials=True,
    #allow_methods=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"]
)
app.add_middleware(SlowAPIMiddleware)
# Register limiter with app state
app.state.limiter = limiter

# Create default super_admin at startup if not present
@app.on_event("startup")
def create_super_user():
    super_username = os.environ.get("SUPERADMIN_USERNAME")
    super_email = os.environ.get("SUPERADMIN_EMAIL")
    super_password = os.environ.get("SUPERADMIN_PASSWORD")
    super_role = os.environ.get("SUPERADMIN_ROLE")

    # Import users_col from routes
    from routes import users_col

    # Check if super user exists
    if not users_col.find_one({"username": super_username}):
        try:
            users_col.insert_one({
                "username": super_username,
                "email": super_email,
                "full_name": "Super Admin",
                "hashed_password": get_password_hash(super_password),
                "role": super_role,
                "disabled": False
            })
            print("Super user created.")
        except DuplicateKeyError:
            print("Super user already exists.")
    else:
        print("Super user already exists.")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    user = request.headers.get("authorization", "anonymous")
    logging.info(f"Request: {request.method} {request.url} by {user}")
    response = await call_next(request)
    logging.info(f"Response: {response.status_code} for {request.method} {request.url}")
    return response

@app.middleware("http")
async def validate_authenticity(request: Request, call_next):
    """Middleware to validate JWT token, but skip for token generation"""
    # Skip preflight requests
    if request.method == "OPTIONS":
        return await call_next(request)
    # Skip token authentication for login and signup
    if request.url.path.startswith("/docs") or request.url.path.startswith("/openapi.json"):
        return await call_next(request)
    if request.url.path.startswith("/login") or request.url.path.startswith("/signup") or request.url.path.startswith("/create-root-user"):
        return await call_next(request)
    if request.url.path.startswith("/refresh-token"):  # Skip token authentication for /refresh-token as well
        return await call_next(request)
    if request.url.path.startswith("/forgot-password"):  # Skip token authentication for /forgot-password as well
        return await call_next(request)
    if request.url.path.startswith("/reset-password"):  # Skip token authentication for /reset-password as well
        return await call_next(request)
    if request.url.path.startswith("/verify-email"):  # Skip token authentication for /verify-email as well
        return await call_next(request)

    authorization: str = request.headers.get('Authorization', '')
    if not authorization:
        logging.warning("No authorization header provided")
        return JSONResponse(status_code=401, content={"detail": "Authorization header is required"})
    
    schema, param = AuthUtil.get_authorization_scheme_param(authorization)

    if not authorization or schema.lower() != 'bearer':
        logging.warning(f"Invalid authorization scheme: {schema}")
        return JSONResponse(status_code=401, content={'detail': 'Authorization header must use Bearer scheme'})

    if not param:
        logging.warning("No token provided in authorization header")
        return JSONResponse(status_code=401, content={'detail': 'Token is required'})

    try:
        payload = await verify_jwt(request, param)
        request.state.security_context = payload
        logging.info(f"Token validated successfully for user: {payload.get('sub', 'unknown')}")
        return await call_next(request)
    except HTTPException as e:
        logging.warning(f"JWT validation failed: {e.detail}")
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
        return JSONResponse(status_code=e.status_code, content={'detail': e.detail}, headers=headers)
    except Exception as e:
        logging.error(f"Unexpected error during token validation: {str(e)}")
        headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
        return JSONResponse(status_code=500, content={'detail': 'Internal server error during authentication'}, headers=headers)
