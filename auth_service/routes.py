# --- Additional Auth Endpoints ---
from fastapi import Body
from typing import List

# from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from token_utils import generate_token, verify_token
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pymongo import MongoClient
from pydantic import EmailStr
from schemas import UserCreate, UserInDB, UserPublic, Token, TokenData,SignupResponse,ResetToken,ResetPasswordRequest

from utils import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token, verify_refresh_token,validate_password_complexity
from typing import Optional
import os
import logging
import secrets
from pydantic import BaseModel
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
from datetime import datetime, timedelta
from email_utils import send_reset_email, send_verification_email


load_dotenv()

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


MONGO_URL = os.environ.get('MONGO_URL')
print(f"Connecting to MongoDB at {MONGO_URL}")
# MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client["pgtracker"] # your database name
users_col = db["users"] # example collection
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")
oauth2_scheme = HTTPBearer()

# # Helper to get user from DB
# def get_user(username: str) -> Optional[UserInDB]:
#     user = users_col.find_one({"username": username})
#     if user:
#         return UserInDB(**user)
#     return None


# Helper to get user from DB by username or email
def get_user(identifier: str) -> Optional[UserInDB]:
    user = users_col.find_one({"$or": [{"username": identifier}, {"email": identifier}]})
    if user:
        return UserInDB(**user)
    return None


# Register new user
def create_user(user: UserCreate):
    # Check for existing fields and build a list
    existing_fields = []
    if users_col.find_one({"username": user.username}):
        existing_fields.append("username")
    if users_col.find_one({"email": user.email}):
        existing_fields.append("email")
    if users_col.find_one({"phone": user.phone}):
        existing_fields.append("phone")
    if users_col.find_one({"aadhar": user.aadhar}):
        existing_fields.append("aadhar")
    if existing_fields:
        if len(existing_fields) == 1:
            msg = f"{existing_fields[0]} is already used. Please try a different {existing_fields[0]}."
        else:
            msg = ", ".join(existing_fields[:-1]) + f" and {existing_fields[-1]} are already used. Please try a different combination."
        raise HTTPException(status_code=400, detail=msg)
    hashed_pw = get_password_hash(user.password)
    user_dict = user.dict()
    user_dict["hashed_password"] = hashed_pw
    user_dict["email_verified"] = False  # New users have unverified emails by default
    del user_dict["password"]
    users_col.insert_one(user_dict)
    return user_dict

blacklist_col = db["jwt_blacklist"]  # MongoDB collection for blacklisted JWTs
# Ensure TTL index on 'exp' field (token expiry) for automatic cleanup
def ensure_blacklist_ttl_index():
    try:
        # Check if collection exists by trying to get its indexes
        indexes = blacklist_col.index_information()
        # Create TTL index if not exists (expire after 0 seconds past 'exp' timestamp)
        if 'exp_1' not in indexes:
            blacklist_col.create_index('exp', expireAfterSeconds=0)
            print("TTL index created successfully")
    except Exception as e:
        # Collection doesn't exist yet, it will be created on first insert
        print(f"Collection doesn't exist yet, will create index on first insert: {e}")

ensure_blacklist_ttl_index()


@limiter.limit("5/minute")
@router.post("/signup", response_model=SignupResponse,tags=["Authentication"])
def signup(request: Request, user: UserCreate):
    from datetime import datetime, timedelta
    created_user = create_user(user)

    # Generate email verification token
    verification_token = generate_token(
        data={"sub": created_user["username"]},
        expires_delta=timedelta(minutes=30)
    )

    # Send verification email synchronously
    email_sent = send_verification_email(user.email, verification_token)
    if not email_sent:
        logging.error(f"Failed to send verification email to {user.email}")

    logging.info(f"New User '{user.username}' signed up with email '{user.email}'")
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')
    return {"message": f"User {created_user['username']} with role {created_user['role']} created successfully on {now}. Please check your email to verify your account."}

class LoginRequest(BaseModel):
    username: str = "aman123"
    password: str = "Legion@123"

@limiter.limit("10/minute")
@router.post("/login", response_model=Token,tags=["Authentication"])
def login(request: Request, login_req: LoginRequest):
    user = get_user(login_req.username)
    if not user or not verify_password(login_req.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    # Check if email is verified
    if not user.email_verified:
        raise HTTPException(
            status_code=403, 
            detail="Email not verified. Please check your email for the verification link."
        )
    
    access_token = create_access_token({"sub": user.username, "role": user.role})
    refresh_token = create_refresh_token({"sub": user.username, "role": user.role})
    logging.info(f"User '{user.username}' logged in successfully at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    return Token(access_token=access_token, refresh_token=refresh_token,token_type="bearer")

# Dependency to get current user
def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    # Check MongoDB blacklist
    try:
        # Extract the actual token string if it's an HTTPAuthorizationCredentials object
        if hasattr(token, 'credentials'):
            token_str = token.credentials
        else:
            token_str = token
            
        if blacklist_col.find_one({"token": token_str}):
            raise HTTPException(status_code=401, detail="Token has been revoked. Please log in again.")
    except Exception as e:
        logging.error(f"MongoDB blacklist check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during authentication")
    
    payload = decode_token(token)
    if not payload:
        logging.warning(f"Failed to decode token: {token}")
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Check if token has expired
    if "exp" in payload:
        from datetime import datetime, timezone
        current_time = datetime.utcnow().timestamp()
        logging.info(f"Routes token validation: exp={payload['exp']}, current_utc={current_time}")
        if payload["exp"] < current_time:
            logging.warning(f"Token expired: exp={payload['exp']}, current={current_time}")
            raise HTTPException(status_code=401, detail="Token has expired")
    
    if "sub" not in payload:
        logging.warning(f"Token missing 'sub' claim: {payload}")
        raise HTTPException(status_code=401, detail="Invalid token: missing user identifier")
    
    user = get_user(payload["sub"])
    if not user:
        logging.warning(f"User not found for token sub: {payload['sub']}")
        raise HTTPException(status_code=401, detail="User not found")
    
    logging.info(f"User authenticated successfully: {user.username}")
    return user

@router.get("/current_user", response_model=UserPublic, tags=["Authentication"])
def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    return UserPublic(**current_user.dict())

# Only owner can update aadhar/phone
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    aadhar: Optional[str] = None
    phone: Optional[str] = None
    target_username: Optional[str] = None  # Only admin can use this

#admin and super admin can update user details.but guests cannot update aadhar or phone
@router.patch("/update/details", response_model=UserPublic, tags=["User Management"])
def update_user_details(
    update: UserUpdate, 
    current_user: UserInDB = Depends(get_current_user)
):
    # Determine which user to update
    if current_user.role  in ["admin", "super_admin"] and update.target_username:
        username = update.target_username
    else:
        username = current_user.username

    # Guests cannot update aadhar or phone
    if current_user.role not in ["admin", "super_admin"]:
        # Guests cannot update aadhar or phone
        if update.aadhar is not None or update.phone is not None:
            raise HTTPException(status_code=403, detail="Guest does not have proper previleges to update aadhar/phone.Contact admin for assistance.")

    update_dict = update.dict(exclude_unset=True)
    update_dict.pop("target_username", None)  # Remove from update fields

    # Add tracking info
    from datetime import datetime
    update_dict["updated_by"] = current_user.username
    update_dict["updated_at"] = datetime.utcnow()

    users_col.update_one({"username": username}, {"$set": update_dict})
    logging.info(f"Username '{current_user.username}' updated to '{username}' by '{current_user.username}'")
    user = get_user(username)
    return UserPublic(**user.dict())




# only admin can delete the user (admin can delete any user except admin, super_admin can even delete both normal and admin users)
import logging
from fastapi import Body

class DeleteUserRequest(BaseModel):
    target_username: str

@router.delete("/delete", response_model=dict, tags=["User Management"])
def delete_user(
    req: DeleteUserRequest = Body(...),
    current_user: UserInDB = Depends(get_current_user)
):
    # Only admin or super_admin can delete
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admin or super_admin can delete users.")

    # Prevent admin from deleting other admins or super_admins
    target = get_user(req.target_username)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")

    if current_user.role == "admin" and target.role in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin cannot delete other admins or super_admins.")

    # super_admin can delete anyone
    result = users_col.delete_one({"username": req.target_username})
    if result.deleted_count == 1:
        logging.info(f"User '{req.target_username}' deleted by '{current_user.username}' successfully.")
        return {"detail": f"User '{req.target_username}' deleted by '{current_user.username}' successfully."}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete user.")



# 1. Refresh Token
class RefreshTokenRequest(BaseModel):
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # in seconds
    
@router.post("/refresh-token", response_model=TokenResponse, tags=["Authentication"])
async def refresh_token(request: RefreshTokenRequest):
    try:
        # Verify the refresh token
        payload = verify_refresh_token(request.refresh_token)
        if not payload:
            logging.error("Refresh token verification failed - payload is None")
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        
        if 'sub' not in payload:
            logging.error(f"Refresh token missing 'sub' claim: {payload}")
            raise HTTPException(status_code=401, detail="Invalid refresh token: missing user identifier")
        
        username = payload['sub']
        user = get_user(username)
        if not user:
            logging.error(f"User not found for refresh token sub: {username}")
            raise HTTPException(status_code=401, detail="User not found")
        
        # Create new access token
        access_token = create_access_token(
            data={"sub": payload["sub"],"role":payload["role"]},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        
        logging.info(f"Refresh token successful for user: {username}")
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    except HTTPException:
        # Re-raise HTTP exceptions as they are
        raise
    except Exception as e:
        logging.error(f"Unexpected error in refresh token endpoint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during token refresh"
        )

# 2. Logout (token blacklisting/session management required)

@router.post("/logout",tags=["Authentication"])
def logout(request: Request, current_user: UserInDB = Depends(get_current_user)):
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=400, detail="No token found in request.")
    token = auth_header.split()[1]
    payload = decode_token(token)
    
    exp_unix = payload.get("exp")
    current_time = datetime.utcnow().timestamp()

    # Only blacklist if token has not expired
    if exp_unix and exp_unix > current_time:
        exp_datetime = datetime.utcfromtimestamp(exp_unix)
        blacklist_col.insert_one({
            "token": token,
            "exp": exp_datetime,  # # Store as BSON datetime for TTL index
            "blacklisted_at": datetime.utcnow()
        })
        return {"message": "Logged out successfully (token blacklisted)."}
    else:
        return {"message": "Logged out successfully (token was already expired; no need to blacklist)."}

# 3. Change Password
class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str

# @router.post("/change-password")
# def change_password(req: ChangePasswordRequest, current_user: UserInDB = Depends(get_current_user)):
#     # Verify old password
#     if not verify_password(req.old_password, current_user.hashed_password):
#         raise HTTPException(status_code=400, detail="Old password is incorrect.")
#     # Set new password
#     new_hashed = get_password_hash(req.new_password)
#     users_col.update_one({"username": current_user.username}, {"$set": {"hashed_password": new_hashed}})
#     return {"message": "Password changed successfully."}

@router.post("/change-password", tags=["Authentication"])
def change_password(request_data: ChangePasswordRequest,current_user: dict = Depends(get_current_user)):
    """
    Change password for authenticated user with full validation:
    - Requires current password, new password, and confirm password
    - Validates password complexity
    - Checks new passwords match
    - Verifies current password
    - Ensures new password is different
    """
    # Find the user in database
    user = get_user(current_user.username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Extract passwords from request_data
    current_password = request_data.old_password
    new_password = request_data.new_password
    confirm_password = request_data.confirm_password

    # Validate all fields are present
    if not all([current_password, new_password, confirm_password]):
        raise HTTPException(
            status_code=400,
            detail="Current password, new password and confirm password are required"
        )

    # Verify new passwords match
    if new_password != confirm_password:
        raise HTTPException(
            status_code=400,
            detail="New password and confirm password do not match"
        )

    # Verify current password is correct
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Current password is incorrect"
        )

    # Validate new password complexity
    is_valid, message = validate_password_complexity(new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    # Check if new password is different from current password
    if verify_password(new_password, user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from current password"
        )

    # Hash new password and update in DB
    hashed_new_password = get_password_hash(new_password)
    users_col.update_one({"username": user.username}, {"$set": {"hashed_password": hashed_new_password}})

    return {
        "success": True,
        "message": "Password changed successfully"
    }

# 4. Forgot Password (send email/OTP)
# Model for Forgot Password request
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@limiter.limit("5/minute")
@router.post("/forgot-password", tags=["Authentication"])
def forgot_password(request: Request, forgot_request: ForgotPasswordRequest):
    """Step 1: User requests a password reset."""
    user = get_user(forgot_request.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate a reset token
    reset_token = secrets.token_urlsafe(32)

    # Create ResetToken object and convert to dictionary
    reset_token_obj = ResetToken(
        email=user.email,
        token=reset_token,
        expires_at=datetime.utcnow() + timedelta(minutes=30)
    )
    reset_token_dict = reset_token_obj.dict()

    # Store token in MongoDB with expiration time (e.g., 1 hour)
    db["reset_tokens"].insert_one(reset_token_dict)

    # Send reset email synchronously
    email_sent = send_reset_email(user.email, reset_token)
    if not email_sent:
        logging.error(f"Failed to send reset email to {user.email}")
        raise HTTPException(status_code=500, detail="Failed to send reset email")

    print(f"Generated Token for {forgot_request.email}: {reset_token}")

    return {
        "message": f"Password reset link sent to your email: {user.email}",
        "reset_link": f"https://pg-application-frontend.onrender.com/reset-password?token={reset_token}"
    }


@limiter.limit("5/minute")
@router.post("/reset-password", tags=["Authentication"])
async def reset_password(request: ResetPasswordRequest):
    """Step 2: User submits new password with token."""
    
    # Find the token in MongoDB
    token_entry = db["reset_tokens"].find_one({"token": request.token})
    
    if not token_entry or token_entry["expires_at"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # Find the user associated with this token
    user = get_user(token_entry["email"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Hash the new password before saving
    hashed_password = get_password_hash(request.new_password)
    users_col.update_one({"username": user.username}, {"$set": {"hashed_password": hashed_password}})

    # Delete the used token
    db["reset_tokens"].delete_one({"token": request.token})

    return {"message": "Password has been reset successfully"}



# 6. Verify Email
class VerifyEmailRequest(BaseModel):
    token: str

@limiter.limit("5/minute")
@router.post("/verify-email", tags=["Authentication"])
def verify_email(request: VerifyEmailRequest):
    payload = verify_token(request.token)
    if not payload or 'sub' not in payload:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token.")
    username = payload['sub']
    user = get_user(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    users_col.update_one({"username": username}, {"$set": {"email_verified": True}})
    return {"message": "Email verified successfully."}

# 7. Resend Verification Email
class ResendVerificationRequest(BaseModel):
    email: EmailStr

@limiter.limit("3/minute")
@router.post("/resend-verification",tags=["Authentication"])
def resend_verification(request: ResendVerificationRequest):
    """Resend email verification link."""
    user = get_user(request.email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if email is already verified
    if user.email_verified:
        raise HTTPException(status_code=400, detail="Email is already verified")

    # Generate new verification token
    verification_token = generate_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=30)
    )

    # Send verification email synchronously
    email_sent = send_verification_email(user.email, verification_token)
    if not email_sent:
        logging.error(f"Failed to send verification email to {user.email}")
        raise HTTPException(status_code=500, detail="Failed to send verification email")

    logging.info(f"Resent verification email to '{user.email}'")
    return {"message": f"Verification email sent to {user.email}"}

# 7. List Users (Admin only)
@router.get("/list-users", response_model=List[UserPublic], tags=["User Management"])
def list_users(current_user: UserInDB = Depends(get_current_user)):
    # Only admin or super_admin can list users
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admin or super_admin can list users.")
    users = list(users_col.find())
    return [UserPublic(**u) for u in users]

# 8. Disable User (Admin only)
class UserActionRequest(BaseModel):
    username: str

@router.post("/disable-user",tags=["User Management"])
def disable_user(req: UserActionRequest, current_user: UserInDB = Depends(get_current_user)):
    # Only admin or super_admin can disable users
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admin or super_admin can disable users.")
    result = users_col.update_one({"username": req.username}, {"$set": {"disabled": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"message": f"User {req.username} disabled."}

# 9. Activate User (Admin only)
@router.post("/activate-user",tags=["User Management"])
def activate_user(req: UserActionRequest, current_user: UserInDB = Depends(get_current_user)):
    # Only admin or super_admin can activate users
    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only admin or super_admin can activate users.")
    result = users_col.update_one({"username": req.username}, {"$set": {"disabled": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"message": f"User {req.username} activated."}
