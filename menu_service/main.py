from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from db import get_menu, get_menu_item, add_menu_item, update_menu_item as update_menu_item_db, delete_menu_item as delete_menu_item_db
from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId
import datetime
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration (should match auth_service)
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

# Setup security scheme for Swagger UI
security = HTTPBearer()

app = FastAPI(title="Menu Service")

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
        title="Menu Service",
        version="1.0.0",
        description="API for managing menu items with authentication and role-based access control",
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

class MenuItem(BaseModel):
    day: str  # Mon, Tue, Wed, Thu, Fri, Sat, Sun
    meal_type: str  # Breakfast, Lunch, Dinner
    description: str
    items: str
    category: str
    available: bool = True
    timing: str

class MenuItemResponse(MenuItem):
    id: str
    created_at: datetime.datetime
    updated_at: datetime.datetime

class MenuItemUpdate(BaseModel):
    day: Optional[str] = None
    meal_type: Optional[str] = None
    description: Optional[str] = None
    items: Optional[str] = None
    category: Optional[str] = None
    available: Optional[bool] = None
    timing: Optional[str] = None

@app.get("/menu", response_model=List[MenuItemResponse], tags=["Menu"])
def list_menu(
    day: Optional[str] = None,
    meal_type: Optional[str] = None,
    category: Optional[str] = None,
    available: Optional[bool] = None,
    user: dict = Depends(get_current_user)
):
    """Get all menu items with optional filtering by day, meal_type, category, and availability"""
    menu = get_menu()
    
    # Apply filters
    filtered_menu = []
    for item in menu:
        # Filter by day
        if day and item.get("day") and item.get("day").lower() != day.lower():
            continue
        
        # Filter by meal_type
        if meal_type and item.get("meal_type") and item.get("meal_type").lower() != meal_type.lower():
            continue
        
        # Filter by category
        if category and item.get("category") != category:
            continue
        
        # Filter by availability
        if available is not None and item.get("available") != available:
            continue
        
        filtered_menu.append(item)
    
    # Convert MongoDB ObjectId to string and add timestamps
    for item in filtered_menu:
        item["id"] = str(item["_id"])
        item["created_at"] = item.get("created_at", datetime.datetime.utcnow())
        item["updated_at"] = item.get("updated_at", datetime.datetime.utcnow())
        del item["_id"]
    
    return filtered_menu

@app.get("/menu/{menu_id}", response_model=MenuItemResponse, tags=["Menu"])
def get_single_menu_item(
    menu_id: str,
    user: dict = Depends(get_current_user)
):
    """Get a specific menu item by ID"""
    try:
        menu_item = get_menu_item(ObjectId(menu_id))
        if not menu_item:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        menu_item["id"] = str(menu_item["_id"])
        menu_item["created_at"] = menu_item.get("created_at", datetime.datetime.utcnow())
        menu_item["updated_at"] = menu_item.get("updated_at", datetime.datetime.utcnow())
        del menu_item["_id"]
        return menu_item
    except:
        raise HTTPException(status_code=400, detail="Invalid menu item ID")

@app.post("/menu", response_model=dict, tags=["Menu"])
def create_menu_item(
    item: MenuItem,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Create a new menu item (Admin only)"""
    menu_data = item.dict()
    menu_data["created_at"] = datetime.datetime.utcnow()
    menu_data["updated_at"] = datetime.datetime.utcnow()
    
    menu_id = add_menu_item(menu_data)
    return {"id": menu_id, "message": "Menu item created successfully"}

@app.put("/menu/{menu_id}", response_model=MenuItemResponse, tags=["Menu"])
def update_menu_item(
    menu_id: str,
    update: MenuItemUpdate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Update a menu item (Admin only)"""
    try:
        # Validate ObjectId
        try:
            obj_id = ObjectId(menu_id)
        except Exception as e:
            logger.error(f"Invalid ObjectId: {menu_id}, error: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid menu item ID")

        # Check if menu item exists
        existing = get_menu_item(obj_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Menu item not found")

        # Prepare update data
        try:
            # update is already a dict, no need to call dict() on it
            if hasattr(update, "dict"):
                update_data = update.dict(exclude_unset=True)
            else:
                update_data = update
        except Exception as e:
            logger.error(f"Validation error in update data: {str(e)}")
            raise HTTPException(status_code=422, detail=f"Invalid update data: {str(e)}")

        update_data["updated_at"] = datetime.datetime.utcnow()

        # Perform update
        try:
            success = update_menu_item_db(obj_id, update_data)
        except Exception as e:
            logger.error(f"Database update error: {str(e)}")
            raise HTTPException(status_code=500, detail="Database error during update")

        if not success:
            raise HTTPException(status_code=404, detail="Menu item not found or no changes made")

        # Get the updated item
        updated_item = get_menu_item(obj_id)
        if not updated_item:
            raise HTTPException(status_code=404, detail="Updated item not found")

        updated_item["id"] = str(updated_item["_id"])
        updated_item["created_at"] = updated_item.get("created_at", datetime.datetime.utcnow())
        updated_item["updated_at"] = updated_item.get("updated_at", datetime.datetime.utcnow())
        del updated_item["_id"]
        return updated_item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in update_menu_item: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.delete("/menu/{menu_id}", tags=["Menu"])
def delete_menu_item_endpoint(
    menu_id: str,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Delete a menu item (Admin only)"""
    try:
        # Check if menu item exists
        existing = get_menu_item(ObjectId(menu_id))
        if not existing:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        success = delete_menu_item_db(ObjectId(menu_id))
        if not success:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        return {"message": "Menu item deleted successfully"}
    except:
        raise HTTPException(status_code=400, detail="Invalid menu item ID")

@app.get("/menu/categories/list", response_model=List[str], tags=["Menu"])
def list_categories(
    user: dict = Depends(get_current_user)
):
    """Get all available menu categories"""
    menu = get_menu()
    categories = set()
    
    for item in menu:
        if item.get("category"):
            categories.add(item["category"])
    
    return sorted(list(categories))

@app.get("/menu/day/{day}", response_model=List[MenuItemResponse], tags=["Menu"])
def get_menu_by_day(
    day: str,
    user: dict = Depends(get_current_user)
):
    """Get all menu items for a specific day"""
    menu = get_menu()
    
    filtered_menu = []
    for item in menu:
        if item.get("day") and item.get("day").lower() == day.lower():
            filtered_menu.append(item)
    
    # Convert MongoDB ObjectId to string and add timestamps
    for item in filtered_menu:
        item["id"] = str(item["_id"])
        item["created_at"] = item.get("created_at", datetime.datetime.utcnow())
        item["updated_at"] = item.get("updated_at", datetime.datetime.utcnow())
        del item["_id"]
    
    return filtered_menu

@app.get("/menu/day/{day}/meal/{meal_type}", response_model=MenuItemResponse, tags=["Menu"])
def get_menu_by_day_and_meal(
    day: str,
    meal_type: str,
    user: dict = Depends(get_current_user)
):
    """Get menu item for a specific day and meal type"""
    menu = get_menu()
    
    for item in menu:
        if (item.get("day") and item.get("day").lower() == day.lower() and
            item.get("meal_type") and item.get("meal_type").lower() == meal_type.lower()):
            
            item["id"] = str(item["_id"])
            item["created_at"] = item.get("created_at", datetime.datetime.utcnow())
            item["updated_at"] = item.get("updated_at", datetime.datetime.utcnow())
            del item["_id"]
            return item
    
    raise HTTPException(status_code=404, detail="Menu item not found for the specified day and meal type")

@app.put("/menu/day/{day}/meal/{meal_type}", response_model=MenuItemResponse, tags=["Menu"])
def update_menu_by_day_and_meal(
    day: str,
    meal_type: str,
    update: MenuItemUpdate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Update menu item by day and meal type (Admin only)"""
    menu = get_menu()
    
    # Find the menu item by day and meal_type
    menu_item = None
    menu_id = None
    for item in menu:
        if (item.get("day") and item.get("day").lower() == day.lower() and
            item.get("meal_type") and item.get("meal_type").lower() == meal_type.lower()):
            menu_item = item
            menu_id = item["_id"]
            break
    
    if not menu_item:
        raise HTTPException(status_code=404, detail="Menu item not found for the specified day and meal type")
    
    try:
        update_data = update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.datetime.utcnow()
        
        success = update_menu_item_db(menu_id, update_data)
        if not success:
            raise HTTPException(status_code=404, detail="Menu item not found or no changes made")
        
        # Get the updated item
        updated_item = get_menu_item(menu_id)
        updated_item["id"] = str(updated_item["_id"])
        updated_item["created_at"] = updated_item.get("created_at", datetime.datetime.utcnow())
        updated_item["updated_at"] = updated_item.get("updated_at", datetime.datetime.utcnow())
        del updated_item["_id"]
        return updated_item
    except:
        raise HTTPException(status_code=400, detail="Error updating menu item")

@app.delete("/menu/day/{day}/meal/{meal_type}", tags=["Menu"])
def delete_menu_by_day_and_meal(
    day: str,
    meal_type: str,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Delete menu item by day and meal type (Admin only)"""
    menu = get_menu()
    
    # Find the menu item by day and meal_type
    menu_id = None
    for item in menu:
        if (item.get("day") and item.get("day").lower() == day.lower() and
            item.get("meal_type") and item.get("meal_type").lower() == meal_type.lower()):
            menu_id = item["_id"]
            break
    
    if not menu_id:
        raise HTTPException(status_code=404, detail="Menu item not found for the specified day and meal type")
    
    try:
        success = delete_menu_item_db(menu_id)
        if not success:
            raise HTTPException(status_code=404, detail="Menu item not found")
        
        return {"message": "Menu item deleted successfully"}
    except:
        raise HTTPException(status_code=400, detail="Error deleting menu item")
