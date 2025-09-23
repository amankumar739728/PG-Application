#!/usr/bin/env python3
"""
Monthly Rent Reminder Scheduler
This script runs the monthly rent reminder function on the 5th of each month.
"""

import schedule
import time
import datetime
from db import send_monthly_rent_reminders

def run_monthly_reminders():
    """
    Function to run monthly reminders
    """
    print(f"Running monthly reminders at {datetime.datetime.now()}")
    result = send_monthly_rent_reminders()

    if result.get("skipped"):
        print("Reminders were skipped (not the 5th of the month)")
    else:
        print(f"Monthly reminders completed: {result.get('sent', 0)} sent, {result.get('failed', 0)} failed")

def main():
    """
    Main function to schedule and run the monthly reminders
    """
    print("Starting Monthly Rent Reminder Scheduler...")
    print("Reminders will be sent on the 5th of each month at 9:00 AM")

    # Schedule the job to run on the 5th of every month at 9:00 AM
    schedule.every().month.at("09:00").do(run_monthly_reminders)

    # Also run immediately for testing (optional - remove in production)
    print("Running initial test...")
    run_monthly_reminders()

    # Keep the script running
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    main()
