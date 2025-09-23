#!/usr/bin/env python3
"""
Test script for monthly rent reminders
This script can be used to test the monthly reminder functionality

#Run command: cd room_service && python test_monthly_reminders.py
"""

import datetime
from db import (
    get_guests_with_pending_monthly_payments,
    send_monthly_rent_reminder_email,
    send_monthly_rent_reminders
)

def test_get_pending_guests():
    """
    Test function to get guests with pending monthly payments
    """
    print("Testing: Get guests with pending monthly payments")
    print("-" * 50)

    pending_guests = get_guests_with_pending_monthly_payments()

    print(f"Found {len(pending_guests)} guests with pending payments for current month")

    for guest in pending_guests:
        print(f"- {guest['guest_name']} (Room {guest['room_number']}) - Email: {guest.get('guest_email', 'N/A')}")

    print()
    return pending_guests

def test_send_single_reminder():
    """
    Test function to send a single reminder email
    """
    print("Testing: Send single monthly reminder")
    print("-" * 50)

    pending_guests = get_guests_with_pending_monthly_payments()

    if not pending_guests:
        print("No guests with pending payments found. Cannot test email sending.")
        return

    # Take the first guest for testing
    test_guest = pending_guests[0]
    guest_email = test_guest.get("guest_email")

    if not guest_email:
        print(f"No email found for guest {test_guest['guest_name']}. Cannot test email sending.")
        return

    print(f"Sending test reminder to: {test_guest['guest_name']} ({guest_email})")

    success = send_monthly_rent_reminder_email(
        guest_email,
        test_guest["guest_name"],
        test_guest["room_number"],
        test_guest
    )

    if success:
        print("✓ Test email sent successfully!")
    else:
        print("✗ Failed to send test email")

    print()

def test_monthly_reminders():
    """
    Test function to run the full monthly reminder process
    """
    print("Testing: Full monthly reminder process")
    print("-" * 50)

    current_date = datetime.datetime.now()
    print(f"Current date: {current_date}")
    print(f"Day of month: {current_date.day}")

    if current_date.day != 5:
        print("⚠️  Note: Today is not the 5th of the month, so the scheduler would skip sending reminders")
        print("    To test the actual sending, temporarily modify the day check in send_monthly_rent_reminders()")
        print()

    result = send_monthly_rent_reminders()

    print("Monthly reminder result:")
    print(f"- Sent: {result.get('sent', 0)}")
    print(f"- Failed: {result.get('failed', 0)}")
    print(f"- Skipped: {result.get('skipped', False)}")

    print()

def main():
    """
    Main test function
    """
    print("Monthly Rent Reminder Test Suite")
    print("=" * 50)
    print()

    # Test 1: Get pending guests
    pending_guests = test_get_pending_guests()

    # Test 2: Send single reminder (if guests exist)
    if pending_guests:
        test_send_single_reminder()

    # Test 3: Full monthly reminder process
    test_monthly_reminders()

    print("Test suite completed!")
    print("\nTo set up automatic monthly reminders:")
    print("1. Use the scheduler script: python monthly_reminder_scheduler.py")
    print("2. Or set up a cron job on Linux:")
    print("   crontab -e")
    print("   Add: 0 9 5 * * cd /path/to/room_service && python -c 'from db import send_monthly_rent_reminders; send_monthly_rent_reminders()'")

if __name__ == "__main__":
    main()
