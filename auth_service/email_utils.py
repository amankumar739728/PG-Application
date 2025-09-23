import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from dotenv import load_dotenv

load_dotenv()

def send_email(to_email: str, subject: str, body: str, from_email: Optional[str] = None):
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', 587))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    from_email = from_email or smtp_user

    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(from_email, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
    
# Configure email sending
conf = ConnectionConfig(
    MAIL_USERNAME=os.environ.get('MAIL_USERNAME'),
    MAIL_PASSWORD=os.environ.get('MAIL_PASSWORD'),
    MAIL_FROM=os.environ.get('MAIL_FROM'),
    MAIL_PORT=os.environ.get('MAIL_PORT'),
    MAIL_SERVER=os.environ.get('MAIL_SERVER'),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False 
)


async def send_reset_email(email: str, token: str):
    """Function to send password reset email with HTML formatting."""
    reset_link = f"http://localhost:3000/reset-password?token={token}"
    
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
            <p>&copy; 2024 PG Tracker. All rights reserved.</p>
        </div>
    </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Reset Your Password - PG Tracker",
        recipients=[email],
        body=html_content,
        subtype="html"
    )

    fm = FastMail(conf)
    await fm.send_message(message)
    
async def send_verification_email(email: str, token: str):
    """Function to send email verification email with HTML formatting."""
    verification_link = f"http://localhost:3000/verify-email?token={token}"
    
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
            <p>&copy; 2024 PG Tracker. All rights reserved.</p>
        </div>
    </body>
    </html>
    """
    
    message = MessageSchema(
        subject="Verify Your Email - PG Tracker",
        recipients=[email],
        body=html_content,
        subtype="html"
    )

    fm = FastMail(conf)
    await fm.send_message(message)
    
    

