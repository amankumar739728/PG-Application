import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv
import logging

load_dotenv()

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
FROM_EMAIL = os.environ.get("MAIL_FROM", "noreply@pgtracker.com")

logger = logging.getLogger(__name__)


def send_reset_email(email: str, token: str):
    """Function to send password reset email with HTML formatting using SendGrid."""
    try:
        if not SENDGRID_API_KEY:
            logger.error("SendGrid API key not configured")
            return False

        reset_link = f"https://pg-application-frontend.onrender.com/reset-password?token={token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background-color: #dc3545;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: #f8f9fa;
                    padding: 30px;
                    border-radius: 0 0 5px 5px;
                }}
                .button {{
                    display: inline-block;
                    background-color: #dc3545;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }}
                .footer {{
                    margin-top: 20px;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }}
                .warning {{
                    background-color: #fff3cd;
                    border: 1px solid #ffeaa7;
                    color: #856404;
                    padding: 15px;
                    border-radius: 5px;
                    margin: 15px 0;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Password Reset Request</h1>
            </div>
            <div class="content">
                <h2>Password Assistance</h2>
                <p>We received a request to reset your PG Tracker account password.</p>

                <div class="warning">
                    <p><strong>Important:</strong> If you didn't request this password reset, please ignore this email. Your account remains secure.</p>
                </div>

                <p>Click the button below to reset your password:</p>

                <a href="{reset_link}" class="button">Reset Password</a>

                <p>Or copy and paste this link into your browser:</p>
                <p><a href="{reset_link}">{reset_link}</a></p>

                <p><strong>This link will expire in 30 minutes.</strong></p>

                <p>For security reasons, this password reset link can only be used once.</p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>&copy; 2026 PG Tracker. All rights reserved.</p>
            </div>
        </body>
        </html>
        """

        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=email,
            subject="Reset Your Password - PG Tracker",
            html_content=html_content
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        if response.status_code == 202:
            logger.info(f"Sent password reset email to {email}")
            return True
        else:
            logger.error(f"Failed to send password reset email to {email}: SendGrid status {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"Error sending password reset email to {email}: {e}")
        return False
    
def send_verification_email(email: str, token: str):
    """Function to send email verification email with HTML formatting using SendGrid."""
    try:
        if not SENDGRID_API_KEY:
            logger.error("SendGrid API key not configured")
            return False

        verification_link = f"https://pg-application-frontend.onrender.com/verify-email?token={token}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background-color: #007bff;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: #f8f9fa;
                    padding: 30px;
                    border-radius: 0 0 5px 5px;
                }}
                .button {{
                    display: inline-block;
                    background-color: #007bff;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 20px 0;
                }}
                .footer {{
                    margin-top: 20px;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Email Verification</h1>
            </div>
            <div class="content">
                <h2>Welcome to PG Tracker!</h2>
                <p>Thank you for signing up. Please verify your email address to complete your registration.</p>

                <p>Click the button below to verify your email:</p>

                <a href="{verification_link}" class="button">Verify Email Address</a>

                <p>Or copy and paste this link into your browser:</p>
                <p><a href="{verification_link}">{verification_link}</a></p>

                <p><strong>This link will expire in 30 minutes.</strong></p>

                <p>If you didn't create an account with PG Tracker, please ignore this email.</p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>&copy; 2026 PG Tracker. All rights reserved.</p>
            </div>
        </body>
        </html>
        """

        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=email,
            subject="Verify Your Email - PG Tracker",
            html_content=html_content
        )

        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        if response.status_code == 202:
            logger.info(f"Sent verification email to {email}")
            return True
        else:
            logger.error(f"Failed to send verification email to {email}: SendGrid status {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"Error sending verification email to {email}: {e}")
        return False
