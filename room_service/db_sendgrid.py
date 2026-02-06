from pymongo import MongoClient
import os
from dotenv import load_dotenv
from bson import ObjectId
from typing import List, Dict, Optional
import datetime
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import io
import csv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
import logging

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
print(f"Connecting to MongoDB at {MONGO_URL}")
client = MongoClient(MONGO_URL)
db = client["pgtracker"]
rooms_col = db["rooms"]
users_col = db["users"]
activities_col = db["activities"]

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
FROM_EMAIL = os.environ.get("MAIL_FROM", "noreply@pgtracker.com")

logger = logging.getLogger(__name__)

# Room document structure:
# {
#   "room_number": "101",
#   "room_type": "2-sharing",  # 1-sharing, 2-sharing, 3-sharing, 4-sharing
#   "capacity": 2,
#   "rent_amount": 12000,
#   "security_deposit": 12000,
#   "current_occupancy": 1,
#   "status": "occupied",  # available, occupied, maintenance
#   "guests": [
#       {
#           "user_id": ObjectId("..."),
#           "username": "guest1",
#           "phone": "1234567890",
#           "aadhar": "1234-5678-9012",
#           "date_of_joining": "2024-01-01",
#           "rent_paid": True,
#           "security_paid": True,
#           "rent_history": [
#               {"month": "2025-08", "amount": 12000, "paid": True, "payment_date": "2025-08-05", "payment_method": "UPI"}
#           ]
#       }
#   ],
#   "created_at": datetime,
#   "updated_at": datetime
# }

def get_room(room_number: str):
    return rooms_col.find_one({"room_number": room_number})

def get_all_rooms():
    return list(rooms_col.find())

def get_room_by_id(room_id: ObjectId):
    return rooms_col.find_one({"_id": room_id})

def create_room(room_data: dict):
    room_data["created_at"] = datetime.datetime.utcnow()
    room_data["updated_at"] = datetime.datetime.utcnow()
    result = rooms_col.insert_one(room_data)
    room_id = str(result.inserted_id)

    # Log activity
    log_activity(
        "room_created",
        f"Room {room_data.get('room_number', 'Unknown')} created with capacity {room_data.get('capacity', 0)}",
        room_number=room_data.get("room_number"),
        amount=room_data.get("rent_amount")
    )

    return room_id

def update_room(room_id: ObjectId, update_data: dict):
    update_data["updated_at"] = datetime.datetime.utcnow()
    result = rooms_col.update_one({"_id": room_id}, {"$set": update_data})
    return result.modified_count > 0

def delete_room(room_id: ObjectId):
    result = rooms_col.delete_one({"_id": room_id})
    return result.deleted_count > 0

def get_rooms_by_type(room_type: str):
    return list(rooms_col.find({"room_type": room_type}))

def get_available_rooms():
    return list(rooms_col.find({"status": "available"}))

def get_occupied_rooms():
    return list(rooms_col.find({"status": "occupied"}))

def get_rooms_by_status(status: str):
    return list(rooms_col.find({"status": status}))

def add_guest_to_room(room_id: ObjectId, guest_data: dict):
    # Use provided date_of_joining if present, else set to current datetime
    if "date_of_joining" not in guest_data or guest_data["date_of_joining"] is None:
        guest_data["date_of_joining"] = datetime.datetime.utcnow()
    else:
        # Convert string date_of_joining to datetime if needed
        if isinstance(guest_data["date_of_joining"], str):
            try:
                guest_data["date_of_joining"] = datetime.datetime.fromisoformat(guest_data["date_of_joining"])
            except Exception:
                guest_data["date_of_joining"] = datetime.datetime.utcnow()

    # Initialize payment history arrays
    guest_data["rent_history"] = []
    guest_data["security_history"] = []
    
    # Get the room first to access rent and security amounts
    room = get_room_by_id(room_id)
    if not room:
        return False

    # Get the payment amounts from the guest data and ensure they are integers
    rent_amount_paid = int(guest_data.pop("rent_amount_paid", 0))
    security_amount_paid = int(guest_data.pop("security_amount_paid", 0))
    rent_payment_method = guest_data.pop("rent_payment_method", "UPI")
    security_payment_method = guest_data.pop("security_payment_method", "UPI")

    # Set paid flags based on actual amounts
    guest_data["rent_paid"] = rent_amount_paid >= room.get("rent_amount", 0)
    guest_data["security_paid"] = security_amount_paid >= room.get("security_deposit", 0)

    # Create initial payment records
    current_month = datetime.datetime.utcnow().strftime("%Y-%m")
    current_date = datetime.datetime.utcnow()
    
    # Initialize payment history arrays
    guest_data["rent_history"] = []
    guest_data["security_history"] = []
    
    # Create rent payment record if amount paid
    if rent_amount_paid > 0:
        rent_payment = {
            "month": current_month,
            "amount": rent_amount_paid,
            "payment_method": rent_payment_method,
            "payment_date": current_date,
            "payment_type": "rent",
            "payment_status": "full" if rent_amount_paid >= room.get("rent_amount", 0) else "partial",
            "balance_amount": max(0, room.get("rent_amount", 0) - rent_amount_paid),
            "notes": f"Initial rent payment at move-in: ₹{rent_amount_paid}"
        }
        guest_data["rent_history"].append(rent_payment)
    else:
        # Create pending rent record
        rent_payment = {
            "month": current_month,
            "amount": 0,
            "payment_method": "N/A",
            "payment_date": current_date,
            "payment_type": "rent",
            "payment_status": "pending",
            "balance_amount": room.get("rent_amount", 0),
            "notes": "No initial rent payment"
        }
        guest_data["rent_history"].append(rent_payment)

    # Create security deposit record if amount paid
    if security_amount_paid > 0:
        security_payment = {
            "month": current_month,
            "amount": security_amount_paid,
            "payment_method": security_payment_method,
            "payment_date": current_date,
            "payment_type": "security",
            "payment_status": "full" if security_amount_paid >= room.get("security_deposit", 0) else "partial",
            "balance_amount": max(0, room.get("security_deposit", 0) - security_amount_paid),
            "notes": f"Initial security deposit: ₹{security_amount_paid}"
        }
        guest_data["security_history"].append(security_payment)
    else:
        # Create pending security record
        security_payment = {
            "month": current_month,
            "amount": 0,
            "payment_method": "N/A",
            "payment_date": current_date,
            "payment_type": "security",
            "payment_status": "pending",
            "balance_amount": room.get("security_deposit", 0),
            "notes": "No initial security deposit"
        }
        guest_data["security_history"].append(security_payment)

    # Use provided user_id or generate a new ObjectId if not provided
    if not guest_data.get("user_id"):
        guest_data["user_id"] = ObjectId()
    else:
        # Convert string user_id to string to ensure consistency
        guest_data["user_id"] = str(guest_data["user_id"])

    # Get current room to check capacity
    room = get_room_by_id(room_id)
    if not room:
        return False

    # Update occupancy and set appropriate status
    new_occupancy = room.get("current_occupancy", 0) + 1
    new_status = "occupied" if new_occupancy >= room.get("capacity", 0) else "available"

    result = rooms_col.update_one(
        {"_id": room_id},
        {
            "$push": {"guests": guest_data},
            "$inc": {"current_occupancy": 1},
            "$set": {"status": new_status, "updated_at": datetime.datetime.utcnow()}
        }
    )

    if result.modified_count > 0:
        # Log activity
        log_activity(
            "guest_added",
            f"Guest {guest_data.get('username', 'Unknown')} added to room {room.get('room_number', 'Unknown')}",
            room_number=room.get("room_number"),
            guest_name=guest_data.get("username")
        )

    return result.modified_count > 0

def remove_guest_from_room(room_id: ObjectId, user_id: str):
    # Get room and guest info before removal for logging
    room = get_room_by_id(room_id)
    guest_name = None
    if room:
        for guest in room.get("guests", []):
            if guest.get("user_id") == user_id:
                guest_name = guest.get("username")
                break

    result = rooms_col.update_one(
        {"_id": room_id},
        {
            "$pull": {"guests": {"user_id": user_id}},
            "$inc": {"current_occupancy": -1},
            "$set": {"updated_at": datetime.datetime.utcnow()}
        }
    )

    if result.modified_count > 0:
        # Log activity
        log_activity(
            "guest_removed",
            f"Guest {guest_name or 'Unknown'} removed from room {room.get('room_number', 'Unknown') if room else 'Unknown'}",
            room_number=room.get("room_number") if room else None,
            guest_name=guest_name
        )

        # Update room status if it becomes empty
        updated_room = get_room_by_id(room_id)
        if updated_room and updated_room.get("current_occupancy", 0) == 0:
            rooms_col.update_one(
                {"_id": room_id},
                {"$set": {"status": "available", "updated_at": datetime.datetime.utcnow()}}
            )

            # Log room status change
            log_activity(
                "room_status_changed",
                f"Room {updated_room.get('room_number', 'Unknown')} status changed to available (became empty)",
                room_number=updated_room.get("room_number")
            )

    return result.modified_count > 0

def update_guest_details(room_id: ObjectId, user_id: str, update_data: dict):
    # Get room and guest info before update for logging
    room = get_room_by_id(room_id)
    guest_name = None
    if room:
        for guest in room.get("guests", []):
            if guest.get("user_id") == user_id:
                guest_name = guest.get("username")
                break

    update_fields = {}
    for key, value in update_data.items():
        update_fields[f"guests.$.{key}"] = value

    result = rooms_col.update_one(
        {"_id": room_id, "guests.user_id": user_id},
        {"$set": update_fields, "$set": {"updated_at": datetime.datetime.utcnow()}}
    )

    if result.modified_count > 0:
        # Log activity
        updated_fields = list(update_data.keys())
        log_activity(
            "guest_updated",
            f"Guest {guest_name or 'Unknown'} details updated in room {room.get('room_number', 'Unknown') if room else 'Unknown'} - fields: {', '.join(updated_fields)}",
            room_number=room.get("room_number") if room else None,
            guest_name=guest_name
        )

    return result.modified_count > 0

def add_rent_payment(room_id: ObjectId, user_id: str, payment_data: dict):
    # Get the room to calculate balance and determine payment status
    room = get_room_by_id(room_id)
    if not room:
        return False

    # Find the guest
    guest = None
    for g in room.get("guests", []):
        if g.get("user_id") == user_id:
            guest = g
            break

    if not guest:
        return False
        
    payment_type = payment_data.get("payment_type", "rent")  # Get payment type from data
    payment_amount = int(payment_data.get("amount", 0))
    payment_method = payment_data.get("payment_method", "Cash")
    payment_notes = payment_data.get("notes", "")
    payment_month = payment_data.get("month", datetime.datetime.utcnow().strftime("%Y-%m"))
    
    # Calculate totals based on payment type
    if payment_type == "security":
        # For security, only use security_history and calculate total security payments
        security_history = guest.get("security_history", [])
        security_total = sum(payment.get("amount", 0) for payment in security_history)
        total_paid = security_total
    else:
        # For rent, only use rent_history for specific month
        rent_history = guest.get("rent_history", [])
        rent_total = sum(
            payment.get("amount", 0) 
            for payment in rent_history 
            if payment.get("month") == payment_month
        )
        total_paid = rent_total

    # Determine the amount and balance based on payment type
    if payment_type == "rent":
        total_amount_due = room.get("rent_amount", 0)
        payment_history_field = "rent_history"
        paid_flag_field = "rent_paid"
    elif payment_type == "security":
        total_amount_due = room.get("security_deposit", 0)
        payment_history_field = "security_history"
        paid_flag_field = "security_paid"
    else:
        # Unknown payment type
        return False
    
    # Get current history array from the correct field based on payment type
    if payment_type == "rent":
        payment_history = guest.get("rent_history", [])
        payment_history_field = "rent_history"
    else:
        payment_history = guest.get("security_history", [])
        payment_history_field = "security_history"
    
    # Calculate totals based on payment type
    if payment_type == "security":
        # For security deposits, only use security_history and ignore months
        security_total = sum(
            p.get("amount", 0) for p in guest.get("security_history", [])
        )
        total_paid = security_total
        new_total_paid = security_total + payment_amount
    else:
        # For rent, only use rent_history for specific month
        rent_total = sum(
            p.get("amount", 0) for p in guest.get("rent_history", [])
            if p.get("month") == payment_month
        )
        total_paid = rent_total
        new_total_paid = rent_total + payment_amount
        
    # Calculate remaining due based on payment type
    remaining_due = max(0, total_amount_due - total_paid)

    # Create new payment record with proper type-specific tracking
    payment_record = {
        "month": payment_month,
        "amount": payment_amount,
        "payment_method": payment_method,
        "payment_date": datetime.datetime.utcnow(),
        "payment_type": payment_type,
        "notes": payment_notes,
        "previous_total": total_paid,
        "new_total": total_paid + payment_amount,
        "total_due": total_amount_due
    }

    # Calculate new total and set payment status
    new_total_paid = total_paid + payment_amount
    payment_status = "full" if new_total_paid >= total_amount_due else "partial"
    
    # Add status and balance information
    payment_record.update({
        "payment_status": payment_status,
        "total_paid": new_total_paid,
        "balance": max(0, total_amount_due - new_total_paid)
    })

    # Add type-specific tracking
    if payment_type == "security":
        payment_record["total_security_paid"] = new_total_paid
        payment_record["security_balance"] = max(0, total_amount_due - new_total_paid)
    else:
        payment_record["total_rent_paid_for_month"] = new_total_paid
        payment_record["rent_balance_for_month"] = max(0, total_amount_due - new_total_paid)

    # Prepare arrays for update
    if payment_type == "security":
        # Get a fresh copy of the security history to avoid duplicates
        security_history = guest.get("security_history", [])
        security_history.append(payment_record)
        base_update = {
            "guests.$.security_history": security_history,
            "guests.$.security_paid": (payment_status == "full"),
            "guests.$.last_payment_date": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow(),
            "guests.$.total_security_paid": new_total_paid,
            "guests.$.security_balance": max(0, total_amount_due - new_total_paid)
        }
    else:
        # Get a fresh copy of the rent history to avoid duplicates
        rent_history = guest.get("rent_history", [])
        rent_history.append(payment_record)
        base_update = {
            "guests.$.rent_history": rent_history,
            "guests.$.rent_paid": (payment_status == "full"),
            "guests.$.last_payment_date": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow(),
            f"guests.$.total_rent_paid_{payment_month}": new_total_paid,
            f"guests.$.rent_balance_{payment_month}": max(0, total_amount_due - new_total_paid)
        }

    update_query = {"$set": base_update}

    result = rooms_col.update_one(
        {"_id": room_id, "guests.user_id": user_id},
        update_query
    )

    if result.modified_count > 0:
        # Calculate the true totals for logging
        all_security_payments = sum(
            payment.get("amount", 0) 
            for payment in guest.get("security_history", [])
            if payment.get("payment_type") == "security"
        )
        
        monthly_rent_payments = sum(
            payment.get("amount", 0)
            for payment in guest.get("rent_history", [])
            if payment.get("payment_type") == "rent" and payment.get("month") == payment_month
        )

        # Prepare activity log message with correct totals
        payment_desc = f"₹{payment_amount} {payment_type} payment"
        if payment_type == "security":
            payment_desc += f" (Security total: ₹{all_security_payments + payment_amount})"
        elif payment_type == "rent":
            payment_desc += f" (Monthly rent total: ₹{monthly_rent_payments + payment_amount})"

        # Log the payment activity
        log_activity(
            "payment_received",
            f"{payment_desc} received from {guest.get('username', 'Unknown')} for room {room.get('room_number', 'Unknown')} ({payment_record['payment_status']})",
            room_number=room.get("room_number"),
            guest_name=guest.get("username"),
            amount=payment_amount
        )

        # Log completion if payment is fully paid
        if payment_status == "full":
            completion_desc = "Full security deposit" if payment_type == "security" else f"Full rent for {payment_month}"
            log_activity(
                "payment_completed",
                f"{completion_desc} received from {guest.get('username', 'Unknown')} for room {room.get('room_number', 'Unknown')}",
                room_number=room.get("room_number"),
                guest_name=guest.get("username"),
                amount=new_total_paid
            )

    return result.modified_count > 0

def get_rooms_with_filters(room_type: Optional[str] = None, 
                          status: Optional[str] = None,
                          min_occupancy: Optional[int] = None,
                          max_occupancy: Optional[int] = None):
    query = {}
    
    if room_type:
        query["room_type"] = room_type
    if status:
        query["status"] = status
    if min_occupancy is not None:
        query["current_occupancy"] = {"$gte": min_occupancy}
    if max_occupancy is not None:
        if "current_occupancy" in query:
            query["current_occupancy"]["$lte"] = max_occupancy
        else:
            query["current_occupancy"] = {"$lte": max_occupancy}
    
    return list(rooms_col.find(query))

def get_room_statistics():
    total_rooms = rooms_col.count_documents({})
    available_rooms = rooms_col.count_documents({"status": "available"})
    occupied_rooms = rooms_col.count_documents({"status": "occupied"})
    maintenance_rooms = rooms_col.count_documents({"status": "maintenance"})
    
    return {
        "total_rooms": total_rooms,
        "available_rooms": available_rooms,
        "occupied_rooms": occupied_rooms,
        "maintenance_rooms": maintenance_rooms,
        "occupancy_rate": (occupied_rooms / total_rooms * 100) if total_rooms > 0 else 0
    }

def get_payment_details(
    room_number: Optional[str] = None,
    guest_name: Optional[str] = None,
    month: Optional[str] = None,
    year: Optional[str] = None,
    payment_type: Optional[str] = None  # 'rent' or 'security'
):
    """
    Get aggregated payment details with various filters.
    Returns one payment record per guest per month with aggregated amounts.
    
    Parameters:
    - room_number: Optional filter by room number
    - guest_name: Optional filter by guest name
    - month: Optional filter by month (name or YYYY-MM format)
    - year: Optional filter by year
    - payment_type: Optional filter by payment type ('rent' or 'security')
    """
    # Build the query for rooms
    room_query = {}
    if room_number:
        room_query["room_number"] = room_number

    # Get all rooms matching the room query
    rooms = list(rooms_col.find(room_query))

    # Dictionary to aggregate payments by guest + room + month + type
    aggregated_payments = {}

    # Month name mapping for validation
    month_names = {
        "january": "January", "february": "February", "march": "March", "april": "April",
        "may": "May", "june": "June", "july": "July", "august": "August",
        "september": "September", "october": "October", "november": "November", "december": "December"
    }

    for room in rooms:
        rent_amount = room.get("rent_amount", 0)
        security_amount = room.get("security_deposit", 0)

        for guest in room.get("guests", []):
            guest_username = guest.get("username", "")

            # Apply guest name filter if provided
            if guest_name and guest_name.lower() not in guest_username.lower():
                continue

            # Process both rent and security deposit payments
            payment_histories = {
                "rent": {"history": guest.get("rent_history", []), "total_amount": rent_amount},
                "security": {"history": guest.get("security_history", []), "total_amount": security_amount}
            }

            # Skip if payment_type is specified and doesn't match
            if payment_type and payment_type not in ["rent", "security"]:
                continue
            
            history_types = [payment_type] if payment_type else ["rent", "security"]

            for curr_type in history_types:
                history = payment_histories[curr_type]["history"]
                total_amount = payment_histories[curr_type]["total_amount"]

                for payment in history:
                    payment_month = payment.get("month", "")

                    # Apply month filter if provided
                    if month:
                        month_lower = month.lower()
                        if month_lower in month_names:
                            if payment_month != month_names[month_lower]:
                                continue
                        elif "-" in month and len(month) == 7:
                            if payment_month != month:
                                continue
                        else:
                            continue

                    # Apply year filter if provided
                    if year:
                        payment_date = payment.get("payment_date")
                        if payment_date and payment_date.year != int(year):
                            continue

                    # Create unique key for aggregation: guest + room + month + type
                    key = f"{guest_username}_{room['room_number']}_{payment_month}_{curr_type}"

                    if key not in aggregated_payments:
                        aggregated_payments[key] = {
                            "room_number": room["room_number"],
                            "room_type": room["room_type"],
                            "guest_name": guest_username,
                            "guest_phone": guest.get("phone"),
                            "guest_email": guest.get("email"),
                            "guest_aadhar": guest.get("aadhar"),
                            "payment_month": payment_month,
                            "payment_type": curr_type,
                            "total_paid": 0,
                            "total_amount": total_amount,
                            "payment_methods": [],
                            "payment_dates": [],
                            "latest_payment_date": None,
                            "notes": []
                        }

                    # Aggregate payment data
                    payment_amount = payment.get("amount", 0)
                    aggregated_payments[key]["total_paid"] += payment_amount

                    payment_method = payment.get("payment_method")
                    if payment_method and payment_method not in aggregated_payments[key]["payment_methods"]:
                        aggregated_payments[key]["payment_methods"].append(payment_method)

                    payment_date = payment.get("payment_date")
                    if payment_date:
                        aggregated_payments[key]["payment_dates"].append(payment_date)
                        if (aggregated_payments[key]["latest_payment_date"] is None or
                            payment_date > aggregated_payments[key]["latest_payment_date"]):
                            aggregated_payments[key]["latest_payment_date"] = payment_date

                    note = payment.get("notes")
                    if note:
                        aggregated_payments[key]["notes"].append(note)

    # Convert aggregated data to final payment details
    payments = []
    for payment_data in aggregated_payments.values():
        total_paid = payment_data["total_paid"]
        total_amount = payment_data["total_amount"]
        balance_amount = max(0, total_amount - total_paid)

        # Determine overall payment status
        if total_paid >= total_amount:
            payment_status = "full"
            balance_amount = 0
        elif total_paid > 0:
            payment_status = "partial"
        else:
            payment_status = "pending"

        payment_method = ", ".join(payment_data["payment_methods"]) if payment_data["payment_methods"] else "N/A"
        notes = "; ".join(payment_data["notes"]) if payment_data["notes"] else None

        payment_detail = {
            "room_number": payment_data["room_number"],
            "room_type": payment_data["room_type"],
            "guest_name": payment_data["guest_name"],
            "guest_phone": payment_data["guest_phone"],
            "guest_email": payment_data["guest_email"],
            "guest_aadhar": payment_data["guest_aadhar"],
            "payment_month": payment_data["payment_month"],
            "payment_type": payment_data["payment_type"],
            "payment_amount": total_paid,
            "payment_method": payment_method,
            "payment_date": payment_data["latest_payment_date"],
            "payment_status": payment_status,
            "balance_amount": balance_amount,
            "total_amount": total_amount,
            "notes": notes
        }
        payments.append(payment_detail)

    # Sort payments by payment date (most recent first)
    payments.sort(key=lambda x: x.get("payment_date") or datetime.datetime.min, reverse=True)

    return payments

def get_overdue_payments(payment_type: Optional[str] = None):
    """
    Get all overdue payments with detailed breakdown and cumulative outstanding balances.

    Parameters:
    - payment_type: Optional filter for 'rent' or 'security' payments
    """
    current_date = datetime.datetime.utcnow()
    overdue_payments = []

    rooms = list(rooms_col.find())

    payment_types = {
        "rent": {"history": "rent_history", "amount_field": "rent_amount"},
        "security": {"history": "security_history", "amount_field": "security_deposit"}
    }

    # Filter payment types if specified
    if payment_type:
        if payment_type not in payment_types:
            return overdue_payments
        payment_types = {payment_type: payment_types[payment_type]}

    for room in rooms:
        for guest in room.get("guests", []):
            guest_overdue = {
                "room_number": room["room_number"],
                "room_type": room["room_type"],
                "guest_name": guest.get("username"),
                "guest_phone": guest.get("phone"),
                "guest_email": guest.get("email"),
                "total_outstanding": 0,
                "latest_overdue_date": None,
                "days_overdue": 0,
                "overdue_types": []
            }

            # For each payment type, calculate overdue amounts per month
            for curr_type, type_info in payment_types.items():
                history_field = type_info["history"]
                total_amount_due = room.get(type_info["amount_field"], 0)

                # Group payments by month for this type
                payments_by_month = {}
                for payment in guest.get(history_field, []):
                    month = payment.get("month")
                    if not month:
                        continue
                    if month not in payments_by_month:
                        payments_by_month[month] = {
                            "total_paid": 0,
                            "payments": [],
                            "payment_dates": []
                        }
                    payments_by_month[month]["total_paid"] += payment.get("amount", 0)
                    payments_by_month[month]["payments"].append(payment)
                    payment_date = payment.get("payment_date")
                    if payment_date:
                        payments_by_month[month]["payment_dates"].append(payment_date)

                # Calculate overdue per month
                for month, data in payments_by_month.items():
                    total_paid = data["total_paid"]
                    outstanding = max(0, total_amount_due - total_paid)
                    if outstanding > 0:
                        # Find earliest payment date for this month
                        earliest_payment_date = min(data["payment_dates"]) if data["payment_dates"] else None
                        if earliest_payment_date and earliest_payment_date < current_date:
                            guest_overdue["total_outstanding"] += outstanding
                            guest_overdue["overdue_types"].append({
                                "type": curr_type,
                                "month": month,
                                "outstanding": outstanding,
                                "total_due": total_amount_due,
                                "total_paid": total_paid
                            })
                            if (guest_overdue["latest_overdue_date"] is None or
                                earliest_payment_date > guest_overdue["latest_overdue_date"]):
                                guest_overdue["latest_overdue_date"] = earliest_payment_date

                # Also check if security deposit is partially paid and overdue (fixed amount)
                if curr_type == "security":
                    # Sum all security payments
                    total_security_paid = sum(payment.get("amount", 0) for payment in guest.get(history_field, []))
                    security_outstanding = max(0, total_amount_due - total_security_paid)
                    if security_outstanding > 0:
                        # Check if any payment date is overdue or no payment made
                        payment_dates = [payment.get("payment_date") for payment in guest.get(history_field, []) if payment.get("payment_date")]
                        latest_payment_date = max(payment_dates) if payment_dates else None
                        if (latest_payment_date is None) or (latest_payment_date < current_date):
                            guest_overdue["total_outstanding"] += security_outstanding
                            guest_overdue["overdue_types"].append({
                                "type": curr_type,
                                "month": "N/A",
                                "outstanding": security_outstanding,
                                "total_due": total_amount_due,
                                "total_paid": total_security_paid
                            })
                            if (guest_overdue["latest_overdue_date"] is None or
                                (latest_payment_date and latest_payment_date > guest_overdue["latest_overdue_date"])):
                                guest_overdue["latest_overdue_date"] = latest_payment_date

            # Only add guest if they have outstanding payments
            if guest_overdue["total_outstanding"] > 0:
                if guest_overdue["latest_overdue_date"]:
                    guest_overdue["days_overdue"] = (current_date - guest_overdue["latest_overdue_date"]).days
                overdue_payments.append(guest_overdue)

    # Sort by days_overdue descending (most overdue first)
    overdue_payments.sort(key=lambda x: x["days_overdue"], reverse=True)
    return overdue_payments

def get_payment_analytics(payment_type: Optional[str] = None):
    """
    Get payment analytics and summaries.
    
    Parameters:
    - payment_type: Optional filter for 'rent' or 'security' payments
    """
    current_date = datetime.datetime.utcnow()
    analytics = {
        "total_payments": 0,
        "total_amount": 0,
        "paid_payments": 0,
        "paid_amount": 0,
        "pending_payments": 0,
        "pending_amount": 0,
        "overdue_payments": 0,
        "overdue_amount": 0,
        "monthly_summary": {},
        "payment_method_summary": {},
        "payment_method_amounts": {},
        "payment_type_summary": {}
    }
    
    rooms = list(rooms_col.find())
    
    for room in rooms:
        payment_types = {
            "rent": {"history": "rent_history", "amount": room.get("rent_amount", 0)},
            "security": {"history": "security_history", "amount": room.get("security_deposit", 0)}
        }

        # Filter payment types if specified
        if payment_type:
            if payment_type not in payment_types:
                return analytics
            payment_types = {payment_type: payment_types[payment_type]}

        for curr_type, type_info in payment_types.items():
            history_field = type_info["history"]
            expected_amount = type_info["amount"]

            # Initialize payment type summary
            if curr_type not in analytics["payment_type_summary"]:
                analytics["payment_type_summary"][curr_type] = {
                    "total_payments": 0,
                    "total_amount": 0,
                    "paid_payments": 0,
                    "paid_amount": 0,
                    "pending_payments": 0,
                    "pending_amount": 0,
                    "overdue_payments": 0,
                    "overdue_amount": 0
                }

            for guest in room.get("guests", []):
                for payment in guest.get(history_field, []):
                    analytics["total_payments"] += 1
                    analytics["payment_type_summary"][curr_type]["total_payments"] += 1
                    
                    amount = payment.get("amount", 0)
                    analytics["total_amount"] += amount
                    analytics["payment_type_summary"][curr_type]["total_amount"] += amount
                    
                    payment_status = payment.get("payment_status", "")
                    payment_date = payment.get("payment_date")
                    
                    # Payment method summary - normalize payment method names to match frontend expectations
                    raw_payment_method = payment.get("payment_method", "Unknown")

                    # Map payment methods to frontend expected keys
                    payment_method_mapping = {
                        "Cash": "cash",
                        "UPI": "online",
                        "Bank Transfer": "bank_transfer",
                        "Cheque": "cheque",
                        "Online": "online",
                        "Card": "other",
                        "Unknown": "other"
                    }

                    # Normalize payment method name
                    normalized_payment_method = payment_method_mapping.get(raw_payment_method, "other")

                    if normalized_payment_method not in analytics["payment_method_summary"]:
                        analytics["payment_method_summary"][normalized_payment_method] = {
                            "count": 0,
                            "amount": 0,
                            "by_type": {}
                        }
                    if curr_type not in analytics["payment_method_summary"][normalized_payment_method]["by_type"]:
                        analytics["payment_method_summary"][normalized_payment_method]["by_type"][curr_type] = {
                            "count": 0,
                            "amount": 0
                        }

                    analytics["payment_method_summary"][normalized_payment_method]["count"] += 1
                    analytics["payment_method_summary"][normalized_payment_method]["amount"] += amount
                    analytics["payment_method_summary"][normalized_payment_method]["by_type"][curr_type]["count"] += 1
                    analytics["payment_method_summary"][normalized_payment_method]["by_type"][curr_type]["amount"] += amount

                    # Populate payment_method_amounts for frontend chart
                    if normalized_payment_method not in analytics["payment_method_amounts"]:
                        analytics["payment_method_amounts"][normalized_payment_method] = 0
                    analytics["payment_method_amounts"][normalized_payment_method] += amount
                    
                    # Monthly summary
                    month = payment.get("month", "Unknown")
                    if month not in analytics["monthly_summary"]:
                        analytics["monthly_summary"][month] = {
                            "count": 0, 
                            "amount": 0,
                            "by_type": {}
                        }
                    if curr_type not in analytics["monthly_summary"][month]["by_type"]:
                        analytics["monthly_summary"][month]["by_type"][curr_type] = {
                            "count": 0,
                            "amount": 0
                        }
                    
                    analytics["monthly_summary"][month]["count"] += 1
                    analytics["monthly_summary"][month]["amount"] += amount
                    analytics["monthly_summary"][month]["by_type"][curr_type]["count"] += 1
                    analytics["monthly_summary"][month]["by_type"][curr_type]["amount"] += amount
                    
                    if payment_status == "full":
                        analytics["paid_payments"] += 1
                        analytics["paid_amount"] += amount
                        analytics["payment_type_summary"][curr_type]["paid_payments"] += 1
                        analytics["payment_type_summary"][curr_type]["paid_amount"] += amount
                    elif payment_status in ["pending", "partial"]:
                        analytics["pending_payments"] += 1
                        analytics["pending_amount"] += amount
                        analytics["payment_type_summary"][curr_type]["pending_payments"] += 1
                        analytics["payment_type_summary"][curr_type]["pending_amount"] += amount
                        
                        # Check if overdue
                        if payment_date and payment_date < current_date:
                            analytics["overdue_payments"] += 1
                            analytics["overdue_amount"] += amount
                            analytics["payment_type_summary"][curr_type]["overdue_payments"] += 1
                            analytics["payment_type_summary"][curr_type]["overdue_amount"] += amount
    
    return analytics

def export_payments_csv(payments_data):
    """
    Export payment data to CSV format
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow([
        "Room Number", "Room Type", "Guest Name", "Guest Phone", "Guest Email",
        "Payment Month", "Amount", "Payment Method", "Payment Date",
        "Payment Status", "Balance Amount", "Notes"
    ])

    # Write data
    for payment in payments_data:
        writer.writerow([
            payment.get("room_number", ""),
            payment.get("room_type", ""),
            payment.get("guest_name", ""),
            payment.get("guest_phone", ""),
            payment.get("guest_email", ""),  # Add guest email
            payment.get("payment_month", ""),
            payment.get("payment_amount", 0),
            payment.get("payment_method", ""),
            payment.get("payment_date", ""),
            payment.get("payment_status", ""),
            payment.get("balance_amount", 0),
            payment.get("notes", "")
        ])

    return output.getvalue()

def export_payments_pdf(payments_data, title="Payment Report"):
    """
    Export payment data to PDF format
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    
    # Add title
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    title_style.alignment = 1  # Center alignment
    elements.append(Paragraph(title, title_style))
    elements.append(Spacer(1, 12))
    
    # Prepare table data
    data = [["Room", "Guest", "Email", "Month", "Amount", "Status", "Balance"]]

    for payment in payments_data:
        data.append([
            payment.get("room_number", ""),
            payment.get("guest_name", ""),
            payment.get("guest_email", ""),  # Add guest email
            payment.get("payment_month", ""),
            f"₹{payment.get('payment_amount', 0)}",
            payment.get("payment_status", ""),
            f"₹{payment.get('balance_amount', 0)}"
        ])
    
    # Create table
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(table)
    doc.build(elements)
    
    buffer.seek(0)
    return buffer.getvalue()

def get_payment_notifications():
    """
    Get notifications for pending and overdue payments
    """
    current_date = datetime.datetime.utcnow()
    notifications = {
        "overdue": [],
        "due_today": [],
        "due_soon": []  # Due within 3 days
    }
    
    rooms = list(rooms_col.find())
    
    for room in rooms:
        for guest in room.get("guests", []):
            for payment in guest.get("rent_history", []):
                payment_status = payment.get("payment_status", "")
                payment_date = payment.get("payment_date")
                
                if payment_status in ["pending", "partial"] and payment_date:
                    days_diff = (payment_date - current_date).days
                    
                    notification = {
                        "room_number": room["room_number"],
                        "guest_name": guest.get("username"),
                        "guest_phone": guest.get("phone"),
                        "payment_month": payment.get("month"),
                        "amount": payment.get("amount"),
                        "balance_amount": payment.get("balance_amount", 0),
                        "payment_date": payment_date
                    }
                    
                    if days_diff < 0:  # Overdue
                        notification["days_overdue"] = abs(days_diff)
                        notifications["overdue"].append(notification)
                    elif days_diff == 0:  # Due today
                        notifications["due_today"].append(notification)
                    elif days_diff <= 3:  # Due soon
                        notification["days_remaining"] = days_diff
                        notifications["due_soon"].append(notification)
    
    return notifications


#notification email service with SendGrid

def get_guest_email(guest_name):
    """
    Get guest email from database
    """
    rooms = list(rooms_col.find())
    
    for room in rooms:
        for guest in room.get("guests", []):
            if guest.get("username") == guest_name:
                return guest.get("email")
    
    return None


def send_payment_reminder_email(to_email, guest_name, room_number, payment_details):
    """
    Send payment reminder email to guest using SendGrid
    
    Parameters:
    - to_email: Email address to send to
    - guest_name: Name of the guest
    - room_number: Room number
    - payment_details: Dict containing payment info
    """
    try:
        if not SENDGRID_API_KEY:
            logger.error("SendGrid API key not configured")
            return False

        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Reminder</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            background-color: #f4f4f4;
        }}
        .container {{
            background-color: #ffffff;
            margin: 20px;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            margin: -30px -30px 30px -30px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 300;
        }}
        .content {{
            padding: 20px 0;
        }}
        .greeting {{
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 20px;
        }}
        .payment-details {{
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }}
        .detail-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
        }}
        .detail-row:last-child {{
            border-bottom: none;
        }}
        .detail-label {{
            font-weight: 600;
            color: #495057;
        }}
        .detail-value {{
            color: #212529;
            font-weight: 500;
        }}
        .amount-highlight {{
            color: #28a745;
            font-size: 18px;
            font-weight: bold;
        }}
        .info-box {{
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }}
        .info-box h3 {{
            color: #0c5460;
            margin: 0 0 10px 0;
            font-size: 16px;
        }}
        .info-box p {{
            color: #0c5460;
            margin: 0;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-radius: 0 0 8px 8px;
            margin: 30px -30px -30px -30px;
            border-top: 1px solid #dee2e6;
        }}
        .footer p {{
            margin: 5px 0;
            color: #6c757d;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Monthly Rent Reminder</h1>
        </div>

        <div class="content">
            <p class="greeting">Dear {guest_name},</p>

            <p>This is a gentle reminder that your monthly rent payment is due. We appreciate your continued partnership and prompt attention to this matter.</p>

            <div class="payment-details">
                <h3 style="margin-top: 0; color: #495057;">📋 Payment Details</h3>

                <div class="detail-row">
                    <span class="detail-label">Room Number:</span>
                    <span class="detail-value">{room_number}</span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">Payment Month:</span>
                    <span class="detail-value">{payment_details.get('payment_month', 'N/A')}</span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">Amount Due:</span>
                    <span class="detail-value amount-highlight">₹{payment_details.get('rent_amount', payment_details.get('amount', 0)):,}</span>
                </div>
            </div>

            <div class="info-box">
                <h3>💡 Payment Information</h3>
                <p>Your rent payment is typically due by the 5th of each month. Please ensure timely payment to avoid any late fees and maintain uninterrupted service.</p>
            </div>

            <p>Thank you for your attention to this matter and for being a valued member of our community.</p>

            <p style="margin-bottom: 0;">Best regards,<br>
            <strong>PG Management Team</strong></p>
        </div>

        <div class="footer">
            <p><strong>PG Tracker System</strong></p>
            <p>This is an automated monthly reminder. Please do not reply to this email.</p>
            <p>&copy; 2024 PG Tracker. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_email,
            subject=f"📅 Monthly Rent Reminder - Room {room_number}",
            html_content=html_content
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"✓ Sent reminder to {guest_name} ({to_email})")
        return True
    except Exception as e:
        logger.error(f"Error sending monthly reminder email to {to_email}: {e}")
        return False


def send_overdue_payment_email(to_email, guest_name, room_number, payment_details, days_overdue):
    """
    Send overdue payment notification email to guest using SendGrid
    
    Parameters:
    - to_email: Email address to send to
    - guest_name: Name of the guest
    - room_number: Room number
    - payment_details: Dict containing payment info
    - days_overdue: Number of days the payment is overdue
    """
    try:
        if not SENDGRID_API_KEY:
            logger.error("SendGrid API key not configured")
            return False

        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Overdue Payment Notice</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            background-color: #f4f4f4;
        }}
        .container {{
            background-color: #ffffff;
            margin: 20px;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }}
        .header {{
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
            margin: -30px -30px 30px -30px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 300;
        }}
        .urgent-banner {{
            background-color: #dc3545;
            color: white;
            text-align: center;
            padding: 10px;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 20px;
        }}
        .content {{
            padding: 20px 0;
        }}
        .greeting {{
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 20px;
        }}
        .payment-details {{
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }}
        .detail-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
        }}
        .detail-row:last-child {{
            border-bottom: none;
        }}
        .detail-label {{
            font-weight: 600;
            color: #495057;
        }}
        .detail-value {{
            color: #212529;
            font-weight: 500;
        }}
        .amount-highlight {{
            color: #dc3545;
            font-size: 18px;
            font-weight: bold;
        }}
        .overdue-highlight {{
            color: #dc3545;
            font-size: 16px;
            font-weight: bold;
            background-color: #f8d7da;
            padding: 5px 10px;
            border-radius: 4px;
            display: inline-block;
        }}
        .warning-box {{
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }}
        .warning-box h3 {{
            color: #721c24;
            margin: 0 0 10px 0;
            font-size: 16px;
        }}
        .warning-box p {{
            color: #721c24;
            margin: 0;
        }}
        .action-required {{
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
        }}
        .action-required h3 {{
            color: #155724;
            margin: 0 0 10px 0;
            font-size: 16px;
        }}
        .action-required p {{
            color: #155724;
            margin: 0;
            font-weight: 600;
        }}
        .footer {{
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-radius: 0 0 8px 8px;
            margin: 30px -30px -30px -30px;
            border-top: 1px solid #dee2e6;
        }}
        .footer p {{
            margin: 5px 0;
            color: #6c757d;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚨 Overdue Payment Notice</h1>
        </div>

        <div class="urgent-banner">
            ⚠️ URGENT ACTION REQUIRED - PAYMENT OVERDUE
        </div>

        <div class="content">
            <p class="greeting">Dear {guest_name},</p>

            <p>We regret to inform you that your rent payment is currently overdue. Immediate attention to this matter is required to avoid additional charges and potential service interruptions.</p>

            <div class="payment-details">
                <h3 style="margin-top: 0; color: #495057;">📋 Payment Details</h3>

                <div class="detail-row">
                    <span class="detail-label">Room Number:</span>
                    <span class="detail-value">{room_number}</span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">Payment Month:</span>
                    <span class="detail-value">{payment_details.get('payment_month', 'N/A')}</span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">Amount Due:</span>
                    <span class="detail-value amount-highlight">₹{payment_details.get('amount', 0):,}</span>
                </div>

                <div class="detail-row">
                    <span class="detail-label">Days Overdue:</span>
                    <span class="detail-value overdue-highlight">{days_overdue} days</span>
                </div>
            </div>

            <div class="action-required">
                <h3>⚡ Immediate Action Required</h3>
                <p>Please make your payment immediately to avoid additional late fees and service interruptions.</p>
            </div>

            <div class="warning-box">
                <h3>⚠️ Important Notice</h3>
                <p>Failure to make payment within the next 7 days may result in additional charges and could affect your accommodation status.</p>
            </div>

            <p>We value you as a resident and appreciate your prompt attention to this matter. Your cooperation helps us maintain excellent service for all our guests.</p>

            <p style="margin-bottom: 0;">Best regards,<br>
            <strong>PG Management Team</strong></p>
        </div>

        <div class="footer">
            <p><strong>PG Tracker System</strong></p>
            <p>This is an urgent automated notification. Please respond immediately.</p>
            <p>&copy; 2024 PG Tracker. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_email,
            subject=f"🚨 OVERDUE PAYMENT NOTICE - Room {room_number}",
            html_content=html_content
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"✓ Sent overdue notice to {guest_name} ({to_email})")
        return True
    except Exception as e:
        logger.error(f"Error sending overdue email to {to_email}: {e}")
        return False


def send_monthly_rent_reminder_email(to_email, guest_name, room_number, payment_details):
    """
    Send monthly rent reminder email to guest using SendGrid
    Same as send_payment_reminder_email but for monthly reminders
    """
    return send_payment_reminder_email(to_email, guest_name, room_number, payment_details)


def send_bulk_payment_notifications():
    """
    Send bulk payment notifications to all guests with pending/overdue payments
    """
    notifications = get_payment_notifications()
    sent_count = 0
    failed_count = 0

    # Send overdue notifications
    for notification in notifications.get("overdue", []):
        guest_email = get_guest_email(notification["guest_name"])

        if guest_email:
            success = send_overdue_payment_email(
                guest_email,
                notification["guest_name"],
                notification["room_number"],
                notification,
                notification["days_overdue"]
            )
            if success:
                sent_count += 1
            else:
                failed_count += 1

    # Send due today notifications
    for notification in notifications.get("due_today", []):
        guest_email = get_guest_email(notification["guest_name"])

        if guest_email:
            success = send_payment_reminder_email(
                guest_email,
                notification["guest_name"],
                notification["room_number"],
                notification
            )
            if success:
                sent_count += 1
            else:
                failed_count += 1

    # Send due soon notifications
    for notification in notifications.get("due_soon", []):
        guest_email = get_guest_email(notification["guest_name"])

        if guest_email:
            success = send_payment_reminder_email(
                guest_email,
                notification["guest_name"],
                notification["room_number"],
                notification
            )
            if success:
                sent_count += 1
            else:
                failed_count += 1

    return {"sent": sent_count, "failed": failed_count}

def get_guests_with_pending_monthly_payments():
    """
    Get all guests who haven't paid rent for the current month
    This is used for monthly reminders on the 5th of each month
    """
    current_date = datetime.datetime.utcnow()
    current_month = current_date.strftime("%Y-%m")  # e.g., "2025-09"
    current_year = current_date.year

    pending_guests = []

    rooms = list(rooms_col.find())

    for room in rooms:
        for guest in room.get("guests", []):
            # Check if guest has paid for current month
            has_paid_current_month = False

            for payment in guest.get("rent_history", []):
                payment_month = payment.get("month", "")
                payment_date = payment.get("payment_date")
                payment_status = payment.get("payment_status", "")

                # Check if payment is for current month and year
                # Handle both YYYY-MM format and month name format
                if (payment_month == current_month or
                    (payment_month == current_date.strftime("%B") and
                     payment_date and payment_date.year == current_year)) and \
                   payment_status == "full":
                    has_paid_current_month = True
                    break

            # If guest hasn't paid for current month, add to pending list
            if not has_paid_current_month:
                pending_guests.append({
                    "room_number": room["room_number"],
                    "room_type": room["room_type"],
                    "guest_name": guest.get("username"),
                    "guest_phone": guest.get("phone"),
                    "guest_email": guest.get("email"),
                    "rent_amount": room.get("rent_amount", 0),
                    "payment_month": current_date.strftime("%B"),  # Return month name for display
                    "payment_year": current_year
                })

    return pending_guests

def send_monthly_rent_reminders(force: bool = False):
    """
    Send monthly rent reminders to all guests who haven't paid for the current month
    This function should be called on the 5th of each month
    
    Parameters:
    - force: If True, bypass the day 5 check (useful for testing)
    """
    current_date = datetime.datetime.utcnow()

    # Check if today is the 5th of the month (skip if force=True)
    if not force and current_date.day != 5:
        logger.info(f"Today is not the 5th of the month (it's {current_date.day}). Skipping monthly reminders. Use force=True to override.")
        return {"sent": 0, "failed": 0, "skipped": True}

    # Get guests with pending payments for current month
    pending_guests = get_guests_with_pending_monthly_payments()

    sent_count = 0
    failed_count = 0

    logger.info(f"Sending monthly reminders to {len(pending_guests)} guests...")

    for guest in pending_guests:
        guest_email = guest.get("guest_email")

        if guest_email:
            success = send_monthly_rent_reminder_email(
                guest_email,
                guest["guest_name"],
                guest["room_number"],
                guest
            )
            if success:
                sent_count += 1
            else:
                failed_count += 1
        else:
            failed_count += 1
            logger.warning(f"No email found for {guest['guest_name']}")

    logger.info(f"Monthly reminders completed: {sent_count} sent, {failed_count} failed")
    return {"sent": sent_count, "failed": failed_count, "skipped": False}


# Activity Tracking Functions
def log_activity(activity_type: str, description: str, room_number: str = None, guest_name: str = None, amount: int = None):
    """
    Log an activity in the activities collection
    """
    activity = {
        "activity_type": activity_type,  # room_update, payment_received, guest_added, etc.
        "description": description,
        "room_number": room_number,
        "guest_name": guest_name,
        "amount": amount,
        "timestamp": datetime.datetime.utcnow()
    }
    
    activities_col.insert_one(activity)

def get_recent_activities(limit: int = 10):
    """
    Get recent activities from the activities collection
    """
    activities = list(activities_col.find().sort("timestamp", -1).limit(limit))
    
    # Convert ObjectId to string for JSON serialization
    for activity in activities:
        activity["_id"] = str(activity["_id"])
    
    return activities
