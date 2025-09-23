# Utility class for extracting authorization scheme and parameter
class AuthUtil:
    @staticmethod
    def get_authorization_scheme_param(authorization_header: str):
        # Example: 'Bearer <token>'
        if not authorization_header:
            return '', ''
        parts = authorization_header.split()
        if len(parts) == 2:
            return parts[0], parts[1]
        elif len(parts) == 1:
            return parts[0], ''
        else:
            return '', ''

from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional
import logging
import re

# Use PyJWT library consistently
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

SECRET_KEY = "supersecretkey"
REFRESH_SECRET_KEY = "superrefreshsecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=int(ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=int(REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_refresh_token(token: str):
    logging.info(f"Verifying refresh token: {token}")  # Log the token being validated

    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        logging.info(f"Refresh token verified successfully for user: {payload.get('sub', 'unknown')}")
        return payload
    except jwt.ExpiredSignatureError:
        logging.warning("Refresh token expired")
        return None
    except jwt.InvalidTokenError as e:
        logging.warning(f"Invalid refresh token: {str(e)}")
        return None
    except Exception as e:
        logging.error(f"Unexpected error during refresh token verification: {str(e)}")
        return None
    
def validate_password_complexity(password: str):
    """
    Validate password meets complexity requirements:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    - At least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one digit"
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character"
    return True, ""

from fastapi.security import HTTPAuthorizationCredentials
from fastapi import HTTPException, status, Request

def decode_token(token):
    # Accepts either a string or HTTPAuthorizationCredentials
    if isinstance(token, HTTPAuthorizationCredentials):
        token = token.credentials
    
    if not token or not isinstance(token, str):
        logging.warning(f"Invalid token type: {type(token)}")
        return None
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        logging.debug(f"Token decoded successfully for user: {payload.get('sub', 'unknown')}")
        return payload
    except InvalidTokenError:
        logging.warning("Invalid token format")
        return None
    except Exception as e:
        logging.error(f"Unexpected error during token decoding: {str(e)}")
        return None
    
    
async def verify_jwt(request: Request, authorization: str):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token missing")

    try:
        user_data = jwt.decode(authorization, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        exp_timestamp = user_data.get("exp")
        if exp_timestamp is not None:
            exp_timestamp = int(exp_timestamp)
            current_timestamp = int(datetime.utcnow().timestamp())
            logging.info(f"Token validation: exp={exp_timestamp}, current_utc={current_timestamp}")
            if exp_timestamp < current_timestamp:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
        if not user_data.get("sub"):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, 
                                detail="Invalid token: Missing 'sub' (username)")
        return user_data
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except Exception as e:
        logging.error(f"Unexpected error during token validation: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during authentication")
