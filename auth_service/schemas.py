from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from beanie import Document
from datetime import datetime, timedelta


# class UserBase(BaseModel):
#     username: str
#     email: EmailStr
#     full_name: Optional[str] = None
#     role: str = "guest"  # guest or admin
#     disabled: Optional[bool] = False

class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "guest"  # guest or admin
    disabled: Optional[bool] = False
    email_verified: Optional[bool] = False

class UserCreate(UserBase):
    password: str
    aadhar: str
    phone: str
    
    
#/signup:
# {
#   "username": "aman1234",
#   "email": "aman.kumar739728@gmail.com",
#   "full_name": "Aman Kumar",
#   "role": "admin",
#   "disabled": false,
#   "password": "Legion@123",
#   "aadhar": "858130920896",
#   "phone": "9566214037"
# }

class UserInDB(UserBase):
    hashed_password: str
    aadhar: str
    phone: str

class UserPublic(UserBase):
    aadhar: Optional[str] = None
    phone: Optional[str] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class SignupResponse(BaseModel):
    message: str
    
class ResetToken(BaseModel):
    email: EmailStr  # Associate token with the user's email
    token: str       # The reset token
    expires_at: datetime  # Expiration timestamp
        
# Model for Reset Password request
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str