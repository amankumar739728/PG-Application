#!/usr/bin/env python3
"""
Monthly Rent Reminder Scheduler
This script runs the monthly rent reminder function once (suitable for cron jobs).
For local development with continuous scheduling, use the --schedule flag.
"""

import schedule
import time
import datetime
import argparse
from db import send_monthly_rent_reminders

def run_monthly_reminders():
    """
    Function to run monthly reminders
    """
    print(f"Running monthly reminders at {datetime.datetime.now()}")
    result = send_monthly_rent_reminders(force=False)  # Force sending for testing purposes

    if result.get("skipped"):
        print("Reminders were skipped (not the 5th of the month)")
    else:
        print(f"Monthly reminders completed: {result.get('sent', 0)} sent, {result.get('failed', 0)} failed")

def main():
    """
    Main function - runs once by default, or continuously with --schedule flag
    """
    parser = argparse.ArgumentParser(description='Monthly Rent Reminder Scheduler')
    parser.add_argument('--schedule', action='store_true',
                       help='Run as continuous scheduler (for local development)')
    args = parser.parse_args()

    if args.schedule:
        # Continuous scheduling mode (for local development)
        print("Starting Monthly Rent Reminder Scheduler...")
        print("Reminders will be sent on the 5th of each month at 9:00 AM")

        # Schedule the job to run on the 5th of every month at 9:00 AM
        schedule.every().month.at("09:00").do(run_monthly_reminders)

        # Also run immediately for testing
        print("Running initial test...")
        run_monthly_reminders()

        # Keep the script running
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    else:
        # One-time execution mode (for cron jobs)
        print("Running monthly reminders (one-time execution for cron job)...")
        run_monthly_reminders()

if __name__ == "__main__":
    main()
