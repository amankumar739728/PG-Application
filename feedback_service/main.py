from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from db import get_feedbacks, get_feedback, add_feedback, update_feedback, delete_feedback
from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId
import datetime
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration (should match auth_service)
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

# Setup security scheme for Swagger UI
security = HTTPBearer()

app = FastAPI(title="Feedback Service")

# Add CORS middleware to handle OPTIONS requests and allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add security scheme to OpenAPI docs using standard FastAPI approach
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Feedback Service",
        version="1.0.0",
        description="API for managing feedback with authentication and role-based access control",
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

class Feedback(BaseModel):
    guest_name: str
    message: str
    status: str = "submitted"  # submitted, in_progress, completed
    rating: Optional[int] = None  # Optional rating from 1-5
    room_number: Optional[str] = None  # Optional room number

class FeedbackResponse(Feedback):
    id: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

class FeedbackUpdate(BaseModel):
    status: Optional[str] = None
    message: Optional[str] = None
    rating: Optional[int] = None

@app.get("/feedbacks", response_model=dict,tags=["Feedbacks"])
def list_feedbacks(
    status: Optional[str] = None,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(5, ge=1, le=50, description="Items per page"),
    user: dict = Depends(get_current_user)
):
    fbs = get_feedbacks()
    if status:
        fbs = [fb for fb in fbs if fb.get("status") == status]

    # Calculate pagination
    total_items = len(fbs)
    total_pages = (total_items + size - 1) // size  # Ceiling division
    start_index = (page - 1) * size
    end_index = start_index + size

    # Get paginated items
    paginated_fbs = fbs[start_index:end_index]

    # Format response
    formatted_fbs = []
    for f in paginated_fbs:
        f["id"] = str(f["_id"])
        f["created_at"] = f.get("created_at", datetime.datetime.utcnow())
        f["updated_at"] = f.get("updated_at", datetime.datetime.utcnow())
        del f["_id"]
        formatted_fbs.append(f)

    return {
        "items": formatted_fbs,
        "total": total_items,
        "page": page,
        "size": size,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }


# getting feedback either by room number or guest name
@app.get("/feedbacks/search", response_model=dict,tags=["Feedbacks"])
def search_feedbacks(
    guest_name: Optional[str] = None,
    room_number: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(5, ge=1, le=50, description="Items per page"),
    user: dict = Depends(get_current_user)
):
    print(f"Search endpoint called with guest_name={guest_name}, room_number={room_number}, status={status}, page={page}, size={size}")

    fbs = get_feedbacks()
    filtered_fbs = []

    print(f"Total feedbacks in database: {len(fbs)}")

    for fb in fbs:
        print(f"Checking feedback: {fb}")
        matches = True
        if guest_name:
            actual_guest_name = fb.get("guest_name", "")
            print(f"Comparing guest_name: '{actual_guest_name}' with search: '{guest_name}'")
            matches = matches and (actual_guest_name.lower() == guest_name.lower())
        if room_number:
            actual_room_number = str(fb.get("room_number", ""))
            print(f"Comparing room_number: '{actual_room_number}' with search: '{room_number}'")
            matches = matches and (actual_room_number.lower() == str(room_number).lower())

        if status:
            actual_status = str(fb.get("status", ""))
            print(f"Comparing status: '{actual_status}' with search: '{status}'")
            matches = matches and (actual_status.lower() == status.lower())

        if matches:
            print(f"Match found: {fb}")
            fb_copy = fb.copy()
            fb_copy["id"] = str(fb_copy["_id"])
            fb_copy["created_at"] = fb_copy.get("created_at", datetime.datetime.utcnow())
            fb_copy["updated_at"] = fb_copy.get("updated_at", datetime.datetime.utcnow())
            del fb_copy["_id"]
            filtered_fbs.append(fb_copy)

    # Calculate pagination for filtered results
    total_items = len(filtered_fbs)
    total_pages = (total_items + size - 1) // size  # Ceiling division
    start_index = (page - 1) * size
    end_index = start_index + size

    # Get paginated items
    paginated_fbs = filtered_fbs[start_index:end_index]

    print(f"Returning {len(paginated_fbs)} matching feedbacks (page {page} of {total_pages})")
    return {
        "items": paginated_fbs,
        "total": total_items,
        "page": page,
        "size": size,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }

@app.get("/feedbacks/{feedback_id}", response_model=FeedbackResponse,tags=["Feedbacks"])
def get_single_feedback(
    feedback_id: str,
    user: dict = Depends(get_current_user)
):
    try:
        feedback = get_feedback(ObjectId(feedback_id))
        if not feedback:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        feedback["id"] = str(feedback["_id"])
        feedback["created_at"] = feedback.get("created_at", datetime.datetime.utcnow())
        feedback["updated_at"] = feedback.get("updated_at", datetime.datetime.utcnow())
        del feedback["_id"]
        return feedback
    except:
        raise HTTPException(status_code=400, detail="Invalid feedback ID")

@app.post("/feedbacks", response_model=dict,tags=["Feedbacks"])
def post_feedback(
    feedback: Feedback,
    # user: dict = Depends(require_role(ADMIN_ROLES))
):
    feedback_data = feedback.dict()
    feedback_data["created_at"] = datetime.datetime.utcnow()
    feedback_data["updated_at"] = datetime.datetime.utcnow()
    
    feedback_id = add_feedback(feedback_data)
    return {"id": feedback_id, "message": "Feedback submitted successfully"}

@app.put("/feedbacks/{feedback_id}", response_model=FeedbackResponse,tags=["Feedbacks"])
def update_feedback_status(
    feedback_id: str, 
    update: FeedbackUpdate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    try:
        # Check if feedback exists
        existing = get_feedback(ObjectId(feedback_id))
        if not existing:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        update_data = update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.datetime.utcnow()
        
        updated_feedback = update_feedback(ObjectId(feedback_id), update_data)
        
        updated_feedback["id"] = str(updated_feedback["_id"])
        updated_feedback["created_at"] = updated_feedback.get("created_at", datetime.datetime.utcnow())
        updated_feedback["updated_at"] = updated_feedback.get("updated_at", datetime.datetime.utcnow())
        del updated_feedback["_id"]
        return updated_feedback
    except:
        raise HTTPException(status_code=400, detail="Invalid feedback ID")

@app.delete("/feedbacks/{feedback_id}",tags=["Feedbacks"])
def delete_single_feedback(
    feedback_id: str,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    try:
        # Check if feedback exists
        existing = get_feedback(ObjectId(feedback_id))
        if not existing:
            raise HTTPException(status_code=404, detail="Feedback not found")
        
        delete_feedback(ObjectId(feedback_id))
        return {"message": "Feedback deleted successfully"}
    except:
        raise HTTPException(status_code=400, detail="Invalid feedback ID")
    
#updating feedbacks by guest name or room number
@app.put("/feedbacks", response_model=dict,tags=["Feedbacks"])
def update_feedbacks_by_criteria(
    guest_name: Optional[str] = None, 
    room_number: Optional[str] = None,
    update: FeedbackUpdate = None,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Update feedbacks by guest name or room number"""
    from db import feedback_col
    
    if not guest_name and not room_number:
        raise HTTPException(status_code=400, detail="Either guest_name or room_number must be provided")
    
    query = {}
    if guest_name:
        query["guest_name"] = guest_name
    if room_number:
        query["room_number"] = room_number
    
    print(f"Updating feedbacks with query: {query}")
    
    update_data = update.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update fields provided")
    
    update_data["updated_at"] = datetime.datetime.utcnow()
    
    result = feedback_col.update_many(query, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No feedbacks found matching the criteria")
    
    return {"message": f"Successfully updated {result.modified_count} feedback(s)"} 

@app.delete("/feedbacks",tags=["Feedbacks"])
def delete_feedbacks_by_criteria(
    guest_name: Optional[str] = None, 
    room_number: Optional[str] = None,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Delete feedbacks by guest name or room number"""
    from db import feedback_col
    
    if not guest_name and not room_number:
        raise HTTPException(status_code=400, detail="Either guest_name or room_number must be provided")
    
    query = {}
    if guest_name:
        query["guest_name"] = guest_name
    if room_number:
        query["room_number"] = room_number
    
    print(f"Deleting feedbacks with query: {query}")
    
    result = feedback_col.delete_many(query)
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No feedbacks found matching the criteria")
    
    return {"message": f"Successfully deleted {result.deleted_count} feedback(s)"}

@app.get("/feedbacks/stats/summary",tags=["Feedbacks"])
def get_feedback_stats(
    user: dict = Depends(get_current_user)
):
    fbs = get_feedbacks()
    
    stats = {
        "total": len(fbs),
        "by_status": {
            "submitted": len([fb for fb in fbs if fb.get("status") == "submitted"]),
            "in_progress": len([fb for fb in fbs if fb.get("status") == "in_progress"]),
            "completed": len([fb for fb in fbs if fb.get("status") == "completed"])
        },
        "average_rating": None
    }
    
    # Calculate average rating if ratings exist
    ratings = [fb.get("rating") for fb in fbs if fb.get("rating") is not None]
    if ratings:
        stats["average_rating"] = sum(ratings) / len(ratings)
    
    return stats
