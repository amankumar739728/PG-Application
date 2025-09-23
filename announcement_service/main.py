from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from db import get_announcements, announcements_col
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
import logging
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration (should match auth_service)
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

# Setup security scheme for Swagger UI
security = HTTPBearer()

app = FastAPI(
    title="Announcement Service",
    description="API for managing announcements with authentication and role-based access control",
    version="1.0.0"
)

# Add security scheme to OpenAPI docs using standard FastAPI approach
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Announcement Service",
        version="1.0.0",
        description="API for managing announcements with authentication and role-based access control",
        routes=app.routes,
    )
    
    # Add security scheme
    openapi_schema["components"]["securitySchemes"] = {
        "Bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    
    # Add security requirement to all operations
    for path in openapi_schema["paths"].values():
        for method in path.values():
            method["security"] = [{"Bearer": []}]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Authentication and Authorization Dependencies
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extract and verify JWT token from request headers using auth_service logic"""
    token = credentials.credentials
    
    if not token:
        raise HTTPException(status_code=401, detail="Token is required")
    
    # Verify token using auth_service's verification logic
    try:
        # Use the same verification logic as auth_service
        user_data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_exp": False})
        
        # Check expiration manually (same as auth_service)
        exp_timestamp = user_data.get("exp")
        if exp_timestamp is not None:
            exp_timestamp = int(exp_timestamp)
            import time
            current_timestamp = int(time.time())
            if exp_timestamp < current_timestamp:
                raise HTTPException(status_code=401, detail="Token has expired")
        
        if not user_data.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token: Missing 'sub' (username)")
        
        return user_data
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def require_role(required_roles: List[str]):
    """Dependency to require specific roles"""
    async def role_checker(user: dict = Depends(get_current_user)):
        user_role = user.get("role")
        if user_role not in required_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

# Admin roles that can perform write operations
ADMIN_ROLES = ["admin", "super_admin"]

class Announcement(BaseModel):
    title: str
    message: str
    author: str
    priority: str = "normal"  # low, normal, high, urgent
    category: Optional[str] = None
    expires_at: Optional[datetime] = None  # New field for expiration
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class AnnouncementCreate(Announcement):
    expires_in_days: Optional[int] = None  # Optional field for setting expiration in days

@app.get("/announcements",tags=["Announcements"])
def list_announcements(
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    author: Optional[str] = Query(None),
    title: Optional[str] = Query(None),
    message: Optional[str] = Query(None),
    include_expired: bool = Query(False, description="Include expired announcements"),
    limit: int = Query(10, ge=1, le=100),
    skip: int = Query(0, ge=0),
    user: dict = Depends(get_current_user)
):
    # Build filter query
    filter_query = {}

    # Handle search filters with OR logic
    search_conditions = []
    if title:
        search_conditions.append({"title": {"$regex": title, "$options": "i"}})
    if author:
        search_conditions.append({"author": {"$regex": author, "$options": "i"}})
    if message:
        search_conditions.append({"message": {"$regex": message, "$options": "i"}})

    if search_conditions:
        filter_query["$or"] = search_conditions

    # Add other filters
    if category:
        filter_query["category"] = category
    if priority:
        filter_query["priority"] = priority

    # Handle expiration filter
    expiration_conditions = [
        {"expires_at": {"$exists": False}},
        {"expires_at": None},
        {"expires_at": {"$gt": datetime.utcnow()}}
    ]

    if not include_expired:
        if "$or" in filter_query:
            # If we already have an $or, we need to combine it with expiration conditions
            existing_or = filter_query["$or"]
            filter_query["$and"] = [
                {"$or": existing_or},
                {"$or": expiration_conditions}
            ]
            del filter_query["$or"]
        else:
            filter_query["$or"] = expiration_conditions

    anns = list(announcements_col.find(filter_query).skip(skip).limit(limit))
    for a in anns:
        a["id"] = str(a["_id"])
        # Check if announcement is expired
        expires_at = a.get("expires_at")
        if expires_at and isinstance(expires_at, datetime) and expires_at < datetime.utcnow():
            a["status"] = "expired"
        else:
            a["status"] = "active"
        del a["_id"]
    return anns

@app.get("/announcements/author/{author}",tags=["Announcements"])
def get_announcements_by_author(
    author: str,
    include_expired: bool = Query(False, description="Include expired announcements"),
    user: dict = Depends(get_current_user)
):
    filter_query = {"author": author}
    if not include_expired:
        filter_query["$or"] = [
            {"expires_at": {"$exists": False}},
            {"expires_at": None},
            {"expires_at": {"$gt": datetime.utcnow()}}
        ]
    
    anns = list(announcements_col.find(filter_query))
    for a in anns:
        a["id"] = str(a["_id"])
        del a["_id"]
    return anns

@app.get("/announcements/title/{title}",tags=["Announcements"])
def get_announcements_by_title(
    title: str,
    include_expired: bool = Query(False, description="Include expired announcements"),
    user: dict = Depends(get_current_user)
):
    filter_query = {"title": {"$regex": title, "$options": "i"}}
    if not include_expired:
        filter_query["$or"] = [
            {"expires_at": {"$exists": False}},
            {"expires_at": None},
            {"expires_at": {"$gt": datetime.utcnow()}}
        ]
    
    anns = list(announcements_col.find(filter_query))
    for a in anns:
        a["id"] = str(a["_id"])
        del a["_id"]
    return anns

@app.get("/announcements/id/{announcement_id}",tags=["Announcements"])
def get_announcement_by_id(
    announcement_id: str,
    user: dict = Depends(get_current_user)
):
    try:
        announcement = announcements_col.find_one({"_id": ObjectId(announcement_id)})
        if not announcement:
            raise HTTPException(status_code=404, detail="Announcement not found")
        
        announcement["id"] = str(announcement["_id"])
        # Check if announcement is expired
        expires_at = announcement.get("expires_at")
        if expires_at and isinstance(expires_at, datetime) and expires_at < datetime.utcnow():
            announcement["status"] = "expired"
        else:
            announcement["status"] = "active"
        del announcement["_id"]
        return announcement
    except:
        raise HTTPException(status_code=400, detail="Invalid announcement ID")
    
    
# {
#   "title": "pg rent",
#   "message": "rent should be paid before 5 every month",
#   "author": "Aman Kumar",
#   "priority": "High",
#   "category": "rent",
#   "expires_at": "2025-08-29T12:53:29.787Z",
#   "created_at": "2025-08-29T12:53:29.787Z",
#   "updated_at": "2025-08-29T12:53:29.787Z",
#   "expires_in_days": 10
# }

@app.post("/announcements",tags=["Announcements"])
def post_announcement(
    announcement: AnnouncementCreate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    announcement_data = announcement.dict(exclude={"expires_in_days"})
    announcement_data["created_at"] = datetime.utcnow()
    announcement_data["updated_at"] = datetime.utcnow()
    
    # Set expiration if provided
    if announcement.expires_in_days:
        announcement_data["expires_at"] = datetime.utcnow() + timedelta(days=announcement.expires_in_days)
    
    result = announcements_col.insert_one(announcement_data)
    announcement_data["id"] = str(result.inserted_id)
    announcement_data["status"] = "active"
    if "_id" in announcement_data:
        del announcement_data["_id"]
    return {
        "message": "Announcement created successfully",
        "announcement": announcement_data
    }

@app.put("/announcements/id/{announcement_id}",tags=["Announcements"])
def update_announcement_by_id(
    announcement_id: str,
    announcement: AnnouncementCreate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    try:
        update_data = announcement.dict(exclude_unset=True, exclude={"expires_in_days"})
        update_data["updated_at"] = datetime.utcnow()
        
        # Handle expiration update
        if announcement.expires_in_days is not None:
            update_data["expires_at"] = datetime.utcnow() + timedelta(days=announcement.expires_in_days)
        
        result = announcements_col.update_one(
            {"_id": ObjectId(announcement_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Announcement not found")
        
        # Get the updated announcement to return
        updated_announcement = announcements_col.find_one({"_id": ObjectId(announcement_id)})
        updated_announcement["id"] = str(updated_announcement["_id"])
        del updated_announcement["_id"]
            
        return {
            "message": "Announcement updated successfully",
            "announcement": updated_announcement
        }
    except:
        raise HTTPException(status_code=400, detail="Invalid announcement ID")

@app.put("/announcements/author/{author}",tags=["Announcements"])
def update_announcements_by_author(
    author: str,
    announcement: AnnouncementCreate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    update_data = announcement.dict(exclude_unset=True, exclude={"expires_in_days"})
    update_data["updated_at"] = datetime.utcnow()
    
    # Handle expiration update
    if announcement.expires_in_days is not None:
        update_data["expires_at"] = datetime.utcnow() + timedelta(days=announcement.expires_in_days)
    
    result = announcements_col.update_many(
        {"author": author},
        {"$set": update_data}
    )
    
    return {
        "message": f"Updated {result.modified_count} announcements by author {author}",
        "modified_count": result.modified_count,
        "author": author
    }

@app.put("/announcements/title/{title}",tags=["Announcements"])
def update_announcements_by_title(
    title: str,
    announcement: AnnouncementCreate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    update_data = announcement.dict(exclude_unset=True, exclude={"expires_in_days"})
    update_data["updated_at"] = datetime.utcnow()
    
    # Handle expiration update
    if announcement.expires_in_days is not None:
        update_data["expires_at"] = datetime.utcnow() + timedelta(days=announcement.expires_in_days)
    
    result = announcements_col.update_many(
        {"title": {"$regex": title, "$options": "i"}},
        {"$set": update_data}
    )
    
    return {
        "message": f"Updated {result.modified_count} announcements with title pattern '{title}'",
        "modified_count": result.modified_count,
        "title_pattern": title
    }

@app.delete("/announcements/id/{announcement_id}",tags=["Announcements"])
def delete_announcement_by_id(
    announcement_id: str,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    try:
        result = announcements_col.delete_one({"_id": ObjectId(announcement_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Announcement not found")
            
        return {"message": "Announcement deleted successfully"}
    except:
        raise HTTPException(status_code=400, detail="Invalid announcement ID")

@app.delete("/announcements/author/{author}",tags=["Announcements"])
def delete_announcements_by_author(
    author: str,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    result = announcements_col.delete_many({"author": author})
    return {"message": f"Deleted {result.deleted_count} announcements by author {author}"}

@app.delete("/announcements/title/{title}",tags=["Announcements"])
def delete_announcements_by_title(
    title: str,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    result = announcements_col.delete_many({"title": {"$regex": title, "$options": "i"}})
    return {"message": f"Deleted {result.deleted_count} announcements with title pattern '{title}'"}

# New endpoint to archive expired announcements
@app.post("/announcements/archive-expired",tags=["Announcements"])
def archive_expired_announcements(user: dict = Depends(require_role(ADMIN_ROLES))):
    """Archive expired announcements by moving them to a separate collection"""
    expired_announcements = list(announcements_col.find({
        "expires_at": {"$lt": datetime.utcnow()}
    }))
    
    if expired_announcements:
        # Create archived collection if it doesn't exist
        archived_col = announcements_col.database["archived_announcements"]
        archived_col.insert_many(expired_announcements)
        
        # Delete from main collection
        result = announcements_col.delete_many({
            "expires_at": {"$lt": datetime.utcnow()}
        })
        
        return {"message": f"Archived {result.deleted_count} expired announcements"}
    
    return {"message": "No expired announcements to archive"}
