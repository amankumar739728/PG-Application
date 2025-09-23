from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
print(f"Connecting to MongoDB at {MONGO_URL}")
client = MongoClient(MONGO_URL)
db = client["pgtracker"]
feedback_col = db["feedbacks"]

def get_feedbacks():
    return list(feedback_col.find())

def get_feedback(feedback_id):
    return feedback_col.find_one({"_id": feedback_id})

def add_feedback(feedback_data):
    result = feedback_col.insert_one(feedback_data)
    return str(result.inserted_id)

def update_feedback(feedback_id, update_data):
    feedback_col.update_one({"_id": feedback_id}, {"$set": update_data})
    return feedback_col.find_one({"_id": feedback_id})

def delete_feedback(feedback_id):
    feedback_col.delete_one({"_id": feedback_id})
    return True

def delete_feedbacks_by_guest_name_and_room_number(guest_name, room_number):
    result = feedback_col.delete_many({"guest_name": guest_name, "room_number": room_number})
    return result.deleted_count

# Ensure to close the MongoDB connection when the application stops
import atexit
atexit.register(client.close)   