from pymongo import MongoClient
import os
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
print(f"Connecting to MongoDB at {MONGO_URL}")
client = MongoClient(MONGO_URL)
db = client["pgtracker"]
menu_col = db["menu"]

def get_menu():
    return list(menu_col.find())

def get_menu_item(menu_id: ObjectId):
    return menu_col.find_one({"_id": menu_id})

def add_menu_item(menu_data: dict):
    result = menu_col.insert_one(menu_data)
    return str(result.inserted_id)

def update_menu_item(menu_id: ObjectId, update_data: dict):
    result = menu_col.update_one({"_id": menu_id}, {"$set": update_data})
    return result.modified_count > 0

def delete_menu_item(menu_id: ObjectId):
    result = menu_col.delete_one({"_id": menu_id})
    return result.deleted_count > 0
