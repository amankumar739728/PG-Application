from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
print(f"Connecting to MongoDB at {MONGO_URL}")
client = MongoClient(MONGO_URL)
db = client["pgtracker"]
announcements_col = db["announcements"]

def get_announcements():
    return list(announcements_col.find())
