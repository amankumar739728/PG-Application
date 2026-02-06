from fastapi import FastAPI, HTTPException, Depends, Query,Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
# from db import (
#     get_room, get_all_rooms, get_room_by_id, create_room, update_room, delete_room,
#     get_rooms_by_type, get_available_rooms, get_occupied_rooms, get_rooms_by_status,
#     add_guest_to_room, remove_guest_from_room, update_guest_details, add_rent_payment,
#     get_rooms_with_filters, get_room_statistics, get_payment_details,
#     get_overdue_payments, get_payment_analytics, export_payments_csv,
#     export_payments_pdf, get_payment_notifications, send_bulk_payment_notifications,
#     get_guests_with_pending_monthly_payments, send_monthly_rent_reminders,
#     get_recent_activities
# )
from db_sendgrid import (
    get_room, get_all_rooms, get_room_by_id, create_room, update_room, delete_room,
    get_rooms_by_type, get_available_rooms, get_occupied_rooms, get_rooms_by_status,
    add_guest_to_room, remove_guest_from_room, update_guest_details, add_rent_payment,
    get_rooms_with_filters, get_room_statistics, get_payment_details,
    get_overdue_payments, get_payment_analytics, export_payments_csv,
    export_payments_pdf, get_payment_notifications, send_bulk_payment_notifications,
    get_guests_with_pending_monthly_payments, send_monthly_rent_reminders,
    get_recent_activities
)
from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId
import datetime
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
import logging
from fastapi.middleware.cors import CORSMiddleware
from threading import Thread

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration (should match auth_service)
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"

# Setup security scheme for Swagger UI
security = HTTPBearer()

app = FastAPI(
    title="Room Service",
    description="API for managing rooms, guests, and rent payments with authentication and role-based access control",
    version="1.0.0"
)

# Add security scheme to OpenAPI docs using standard FastAPI approach
from fastapi.openapi.utils import get_openapi

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="Room Service",
        version="1.0.0",
        description="API for managing rooms, guests, and rent payments with authentication and role-based access control",
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

# Pydantic Models
class RoomCreate(BaseModel):
    room_number: str
    room_type: str  # 1-sharing, 2-sharing, 3-sharing, 4-sharing
    capacity: int
    rent_amount: int
    security_deposit: int
    status: str = "available"  # available, occupied, maintenance

class RoomResponse(RoomCreate):
    id: str
    current_occupancy: int
    guests: List[dict]
    created_at: datetime.datetime
    updated_at: datetime.datetime

class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    rent_amount: Optional[int] = None
    security_deposit: Optional[int] = None
    status: Optional[str] = None

class GuestCreate(BaseModel):
    user_id: Optional[str] = None
    username: str
    phone: str
    email: str
    aadhar: str
    date_of_joining: Optional[datetime.datetime] = None
    rent_paid: bool = False
    security_paid: bool = False
    rent_amount_paid: Optional[int] = 0
    security_amount_paid: Optional[int] = 0
    rent_payment_method: Optional[str] = 'UPI'
    security_payment_method: Optional[str] = 'UPI'

class GuestUpdate(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    aadhar: Optional[str] = None
    date_of_leaving: Optional[datetime.datetime] = None

class RentPayment(BaseModel):
    month: str  # Format: YYYY-MM
    amount: int
    payment_method: str  # UPI, Cash, Bank Transfer, etc.
    payment_date: Optional[datetime.datetime] = None
    balance_amount: Optional[int] = None
    payment_status: str = "full"  # full, partial, pending
    notes: Optional[str] = None
    payment_type: str = "rent"  # rent or security

# Room Management Endpoints
@app.get("/rooms", response_model=List[RoomResponse], tags=["Room"])
def list_rooms(
    room_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    min_occupancy: Optional[int] = Query(None),
    max_occupancy: Optional[int] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Get all rooms with optional filtering"""
    rooms = get_rooms_with_filters(room_type, status, min_occupancy, max_occupancy)
    
    for room in rooms:
        room["id"] = str(room["_id"])
        del room["_id"]
    
    return rooms

@app.get("/rooms/{room_number}", response_model=RoomResponse, tags=["Room"])
def get_room_details(
    room_number: str,
    user: dict = Depends(get_current_user)
):
    """Get specific room details by room number"""
    room = get_room(room_number)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room["id"] = str(room["_id"])
    del room["_id"]
    return room

@app.get("/rooms/types/{room_type}", response_model=List[RoomResponse], tags=["Room"])
def get_rooms_by_type_endpoint(
    room_type: str,
    user: dict = Depends(get_current_user)
):
    """Get all rooms of a specific type"""
    rooms = get_rooms_by_type(room_type)
    
    for room in rooms:
        room["id"] = str(room["_id"])
        del room["_id"]
    
    return rooms

@app.get("/rooms/status/{status}", response_model=List[RoomResponse], tags=["Room"])
def get_rooms_by_status_endpoint(
    status: str,
    user: dict = Depends(get_current_user)
):
    """Get all rooms with specific status"""
    rooms = get_rooms_by_status(status)
    
    for room in rooms:
        room["id"] = str(room["_id"])
        del room["_id"]
    
    return rooms

@app.post("/rooms", response_model=dict, tags=["Room"])
def create_room_endpoint(
    room: RoomCreate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Create a new room (Admin only)"""
    room_data = room.dict()
    room_data["current_occupancy"] = 0
    room_data["guests"] = []
    
    room_id = create_room(room_data)
    return {"id": room_id, "message": "Room created successfully"}

@app.put("/rooms/{room_number}", response_model=RoomResponse, tags=["Room"])
def update_room_endpoint(
    room_number: str,
    update: RoomUpdate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Update room details (Admin only)"""
    room = get_room(room_number)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    update_data = update.dict(exclude_unset=True)
    success = update_room(room["_id"], update_data)
    
    if not success:
        raise HTTPException(status_code=404, detail="Room not found or no changes made")
    
    updated_room = get_room(room_number)
    updated_room["id"] = str(updated_room["_id"])
    del updated_room["_id"]
    return updated_room

@app.delete("/rooms/{room_number}", tags=["Room"])
def delete_room_endpoint(
    room_number: str,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Delete a room (Admin only)"""
    room = get_room(room_number)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room.get("current_occupancy", 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete room with occupants")
    
    success = delete_room(room["_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return {"message": "Room deleted successfully"}

# Guest Management Endpoints
@app.post("/rooms/{room_number}/guests", response_model=dict, tags=["Room"])
def add_guest_to_room_endpoint(
    room_number: str,
    guest: GuestCreate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Add a guest to a room (Admin only)"""
    room = get_room(room_number)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    if room["current_occupancy"] >= room["capacity"]:
        raise HTTPException(status_code=400, detail="Room capacity is full. You can't add a new guest here.")
    
    guest_data = guest.dict()
    success = add_guest_to_room(room["_id"], guest_data)
    
    if not success:
        raise HTTPException(status_code=400, detail="Failed to add guest to room")
    
    return {"message": "Guest added to room successfully"}

@app.put("/rooms/{room_number}/guests/{user_id}", response_model=dict, tags=["Room"])
def update_guest_endpoint(
    room_number: str,
    user_id: str,
    update: GuestUpdate,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Update guest details (Admin only)"""
    room = get_room(room_number)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    update_data = update.dict(exclude_unset=True)
    success = update_guest_details(room["_id"], user_id, update_data)
    
    if not success:
        raise HTTPException(status_code=404, detail="Guest not found or no changes made")
    
    return {"message": "Guest details updated successfully"}

@app.delete("/rooms/{room_number}/guests/{user_id}", tags=["Room"])
def remove_guest_endpoint(
    room_number: str,
    user_id: str,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Remove a guest from a room (Admin only)"""
    room = get_room(room_number)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    success = remove_guest_from_room(room["_id"], user_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Guest not found")
    
    return {"message": f"Guest with id {user_id} removed from room {room['room_number']} successfully"}

# Rent Payment Endpoints
@app.post("/rooms/{room_number}/guests/{user_id}/payments", response_model=dict, tags=["Room"])
def add_payment_endpoint(
    room_number: str,
    user_id: str,
    payment: RentPayment,
    user: dict = Depends(require_role(ADMIN_ROLES))
):
    """Add payment for a guest (Admin only)"""
    room = get_room(room_number)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    payment_data = payment.dict()

    # Validate required amount based on payment type
    payment_type = payment_data.get("payment_type", "rent")
    required_amount = room["rent_amount"] if payment_type == "rent" else room["security_deposit"]
    
    amount = payment_data.get("amount", 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")

    success = add_rent_payment(room["_id"], user_id, payment_data)
    
    if not success:
        raise HTTPException(status_code=404, detail="Guest not found or payment failed")
    
    return {"message": f"{payment_type.title()} payment recorded successfully"}

# Statistics and Reports
@app.get("/all/rooms/statistics", response_model=dict, tags=["Room-statistics"])
def get_room_statistics_endpoint(
    user: dict = Depends(get_current_user)
):
    """Get room statistics and occupancy rates"""
    try:
        stats = get_room_statistics()
        return stats
    except Exception as e:
        import logging
        logging.error(f"Error getting room statistics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/all/rooms/available", response_model=List[RoomResponse], tags=["Room-statistics"])
def get_available_rooms_endpoint(
    user: dict = Depends(get_current_user)
):
    """Get all available rooms"""
    try:
        rooms = get_available_rooms()
        
        for room in rooms:
            room["id"] = str(room["_id"])
            del room["_id"]
        
        return rooms
    except Exception as e:
        import logging
        logging.error(f"Error getting available rooms: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/all/rooms/occupied", response_model=List[RoomResponse], tags=["Room-statistics"])
def get_occupied_rooms_endpoint(
    user: dict = Depends(get_current_user)
):
    """Get all occupied rooms"""
    try:
        rooms = get_occupied_rooms()
        
        for room in rooms:
            room["id"] = str(room["_id"])
            del room["_id"]
        
        return rooms
    except Exception as e:
        import logging
        logging.error(f"Error getting occupied rooms: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Additional Utility Endpoints
@app.get("/all/rooms/search", response_model=List[RoomResponse], tags=["Room-statistics"])
def search_rooms(
    room_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    min_occupancy: Optional[int] = Query(None),
    max_occupancy: Optional[int] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Search rooms with multiple filters"""
    try:
        rooms = get_rooms_with_filters(room_type, status, min_occupancy, max_occupancy)
        
        for room in rooms:
            room["id"] = str(room["_id"])
            del room["_id"]
        
        return rooms
    except Exception as e:
        import logging
        logging.error(f"Error searching rooms: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/rooms/{room_number}/guests", response_model=List[dict], tags=["Room-statistics"])
def get_room_guests(
    room_number: str,
    user: dict = Depends(get_current_user)
):
    """Get all guests in a specific room"""
    room = get_room(room_number)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return room.get("guests", [])

@app.get("/payments/details", response_model=List[dict], tags=["Payment"])
def get_payment_details_endpoint(
    room_number: Optional[str] = Query(None),
    guest_name: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Get payment details filtered by room number, guest name, month, and year"""
    try:
        payments = get_payment_details(room_number, guest_name, month, year)
        return payments
    except Exception as e:
        import logging
        logging.error(f"Error getting payment details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
    
@app.get("/payments/overdue", response_model=List[dict], tags=["Payment"])
def get_overdue_payments_endpoint(
    user: dict = Depends(get_current_user)
):
    """Get all overdue payments"""
    try:
        overdue_payments = get_overdue_payments()
        return overdue_payments
    except Exception as e:
        import logging
        logging.error(f"Error getting overdue payments: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/payments/analytics", response_model=dict, tags=["Payment"])
def get_payment_analytics_endpoint(
    user: dict = Depends(get_current_user)
):
    """Get payment analytics and summaries"""
    try:
        analytics = get_payment_analytics()
        return analytics
    except Exception as e:
        import logging
        logging.error(f"Error getting payment analytics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/payments/notifications", response_model=dict, tags=["Payment"])
def get_payment_notifications_endpoint(
    user: dict = Depends(get_current_user)
):
    """Get payment notifications for overdue and due payments"""
    try:
        notifications = get_payment_notifications()
        return notifications
    except Exception as e:
        import logging
        logging.error(f"Error getting payment notifications: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/payments/export/csv", tags=["Payment"])
def export_payments_csv_endpoint(
    room_number: Optional[str] = Query(None),
    guest_name: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Export payment data to CSV format"""
    try:
        payments = get_payment_details(room_number, guest_name, month, year)
        csv_data = export_payments_csv(payments)
        
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=payments.csv"}
        )
    except Exception as e:
        import logging
        logging.error(f"Error exporting payments to CSV: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/payments/export/pdf", tags=["Payment"])
def export_payments_pdf_endpoint(
    room_number: Optional[str] = Query(None),
    guest_name: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Export payment data to PDF format"""
    try:
        payments = get_payment_details(room_number, guest_name, month, year)
        pdf_data = export_payments_pdf(payments)
        
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=payments.pdf"}
        )
    except Exception as e:
        import logging
        logging.error(f"Error exporting payments to PDF: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
# @app.post("/payments/send-notifications", response_model=dict, tags=["Payment"])
# def send_bulk_notifications_endpoint(
#     user: dict = Depends(require_role(ADMIN_ROLES))
# ):
#     """Send bulk payment notifications to all guests (Admin only)"""
#     try:
#         result = send_bulk_payment_notifications()
#         return {
#             "message": f"Notifications sent successfully. Sent: {result['sent']}, Failed: {result['failed']}",
#             "sent_count": result["sent"],
#             "failed_count": result["failed"]
#         }
#     except Exception as e:
#         import logging
#         logging.error(f"Error sending bulk notifications: {e}")
#         raise HTTPException(status_code=500, detail="Internal server error")


#New code:
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

# Monthly Rent Reminder Endpoints
@app.get("/payments/monthly-pending", response_model=List[dict], tags=["Payment"])
def get_guests_with_pending_monthly_payments_endpoint(
    user: dict = Depends(get_current_user)
):
    """Get all guests who haven't paid rent for the current month"""
    try:
        pending_guests = get_guests_with_pending_monthly_payments()
        return pending_guests
    except Exception as e:
        import logging
        logging.error(f"Error getting guests with pending monthly payments: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# @app.post("/payments/send-monthly-reminders", response_model=dict, tags=["Payment"])
# def send_monthly_rent_reminders_endpoint(
#     user: dict = Depends(require_role(ADMIN_ROLES))
# ):
#     """Send monthly rent reminders to all guests who haven't paid for the current month (Admin only)"""
#     try:
#         result = send_monthly_rent_reminders()
#         return {
#             "message": f"Monthly reminders sent successfully. Sent: {result.get('sent', 0)}, Failed: {result.get('failed', 0)}",
#             "sent_count": result.get("sent", 0),
#             "failed_count": result.get("failed", 0),
#             "skipped": result.get("skipped", False)
#         }
#     except Exception as e:
#         import logging
#         logging.error(f"Error sending monthly rent reminders: {e}")
#         raise HTTPException(status_code=500, detail="Internal server error")


#New code:

# @app.post("/payments/send-monthly-reminders", response_model=dict, tags=["Payment"])
# def send_monthly_rent_reminders_endpoint(
#     user: dict = Depends(require_role(ADMIN_ROLES))
# ):
#     """Send monthly rent reminders asynchronously to all guests who haven't paid for the current month (Admin only)"""
#     def send_reminders_background():
#         try:
#             result = send_monthly_rent_reminders()
#             if result.get("skipped"):
#                 logger.info("Monthly reminders skipped: not the 5th of the month")
#             else:
#                 logger.info(f"Monthly reminders completed: Sent {result.get('sent', 0)}, Failed {result.get('failed', 0)}")
#         except Exception as e:
#             logger.error(f"Error sending monthly reminders in background: {e}", exc_info=True)
    
#     # Spawn background thread and return immediately
#     thread = Thread(target=send_reminders_background, daemon=True)
#     thread.start()
    
#     return {
#         "message": "Monthly reminders are being sent in the background. You will receive updates shortly.",
#         "status": "processing"
#     }



@app.post("/payments/send-monthly-reminders", response_model=dict, tags=["Payment"])
def send_monthly_rent_reminders_endpoint(
    user: dict = Depends(require_role(ADMIN_ROLES)),
    force: bool = Query(False, description="Force send reminders even if not the 5th of the month (for testing)")
):
    """Send monthly rent reminders to all guests who haven't paid for the current month (Admin only)
    
    Query Parameters:
    - force: Set to true to send reminders regardless of the date (useful for testing)
      Example: /payments/send-monthly-reminders?force=true
    """
    try:
        result = send_monthly_rent_reminders(force=force)
        return {
            "message": f"Monthly reminders sent successfully. Sent: {result.get('sent', 0)}, Failed: {result.get('failed', 0)}",
            "sent_count": result.get("sent", 0),
            "failed_count": result.get("failed", 0),
            "skipped": result.get("skipped", False)
        }
    except Exception as e:
        import logging
        logging.error(f"Error sending monthly rent reminders: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Activity Tracking Endpoints
@app.get("/activities/recent", response_model=List[dict], tags=["Activity"])
def get_recent_activities_endpoint(
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user)
):
    """Get recent activities from the system"""
    try:
        activities = get_recent_activities(limit)
        return activities
    except Exception as e:
        import logging
        logging.error(f"Error getting recent activities: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
