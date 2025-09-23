#!/usr/bin/env python3
"""
Test script to verify all PG management services are running correctly
"""

import requests
import time
import sys

SERVICES = {
    "auth_service": "http://localhost:8000",
    "feedback_service": "http://localhost:8001", 
    "menu_service": "http://localhost:8002",
    "announcement_service": "http://localhost:8003",
    "room_service": "http://localhost:8004",
    "search_service": "http://localhost:8005"
}

def test_service_health():
    """Test if services are responding"""
    print("Testing service health...")
    print("-" * 50)
    
    all_healthy = True
    
    for service_name, url in SERVICES.items():
        try:
            response = requests.get(f"{url}/docs", timeout=5)
            if response.status_code == 200:
                print(f"✅ {service_name}: HEALTHY (Status: {response.status_code})")
            else:
                print(f"⚠️  {service_name}: RESPONDING BUT ERROR (Status: {response.status_code})")
                all_healthy = False
        except requests.exceptions.RequestException as e:
            print(f"❌ {service_name}: DOWN - {e}")
            all_healthy = False
    
    return all_healthy

def test_auth_service():
    """Test authentication service endpoints"""
    print("\nTesting Auth Service endpoints...")
    print("-" * 50)
    
    base_url = SERVICES["auth_service"]
    
    # Test signup endpoint
    try:
        signup_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "Test@12345",
            "full_name": "Test User",
            "phone": "1234567890",
            "aadhar": "123456789012",
            "role": "guest"
        }
        response = requests.post(f"{base_url}/signup", json=signup_data, timeout=10)
        print(f"Signup Test: {'✅ SUCCESS' if response.status_code == 200 else '❌ FAILED'} - {response.status_code}")
        if response.status_code != 200:
            print(f"  Error: {response.text}")
    except Exception as e:
        print(f"❌ Signup Test Failed: {e}")
    
    # Test login endpoint
    try:
        login_data = {
            "username": "testuser",
            "password": "Test@12345"
        }
        response = requests.post(f"{base_url}/login", json=login_data, timeout=10)
        print(f"Login Test: {'✅ SUCCESS' if response.status_code == 200 else '❌ FAILED'} - {response.status_code}")
        if response.status_code == 200:
            print(f"  Token: {response.json().get('access_token', 'No token')[:50]}...")
    except Exception as e:
        print(f"❌ Login Test Failed: {e}")

def test_other_services():
    """Test other service endpoints"""
    print("\nTesting Other Services endpoints...")
    print("-" * 50)
    
    # Test feedback service
    try:
        response = requests.get(f"{SERVICES['feedback_service']}/feedbacks", timeout=5)
        print(f"Feedback Service: {'✅ RESPONDING' if response.status_code == 200 else '⚠️  ERROR'} - {response.status_code}")
    except Exception as e:
        print(f"❌ Feedback Service: DOWN - {e}")
    
    # Test menu service
    try:
        response = requests.get(f"{SERVICES['menu_service']}/menu", timeout=5)
        print(f"Menu Service: {'✅ RESPONDING' if response.status_code == 200 else '⚠️  ERROR'} - {response.status_code}")
    except Exception as e:
        print(f"❌ Menu Service: DOWN - {e}")
    
    # Test announcement service
    try:
        response = requests.get(f"{SERVICES['announcement_service']}/announcements", timeout=5)
        print(f"Announcement Service: {'✅ RESPONDING' if response.status_code == 200 else '⚠️  ERROR'} - {response.status_code}")
    except Exception as e:
        print(f"❌ Announcement Service: DOWN - {e}")
    
    # Test room service
    try:
        response = requests.get(f"{SERVICES['room_service']}/rooms", timeout=5)
        print(f"Room Service: {'✅ RESPONDING' if response.status_code == 200 else '⚠️  ERROR'} - {response.status_code}")
    except Exception as e:
        print(f"❌ Room Service: DOWN - {e}")
    
    # Test search service
    try:
        response = requests.get(f"{SERVICES['search_service']}/search?q=test", timeout=5)
        print(f"Search Service: {'✅ RESPONDING' if response.status_code == 200 else '⚠️  ERROR'} - {response.status_code}")
    except Exception as e:
        print(f"❌ Search Service: DOWN - {e}")

if __name__ == "__main__":
    print("PG Management Services Test Script")
    print("=" * 50)
    
    # Wait a bit for services to start
    print("Waiting 10 seconds for services to start...")
    time.sleep(10)
    
    # Test services
    if test_service_health():
        print("\n🎉 All services are responding!")
    else:
        print("\n⚠️  Some services are not responding correctly")
    
    # Test specific endpoints
    test_auth_service()
    test_other_services()
    
    print("\n" + "=" * 50)
    print("Test completed!")
