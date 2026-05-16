"""
Email Service
- SMTP email sending
- Email templates
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

from config import db

logger = logging.getLogger(__name__)


class EmailService:
    """Centralized email service using SMTP"""
    
    @classmethod
    async def get_settings(cls):
        """Fetch email settings from database"""
        settings = await db.site_settings.find_one({"type": "email"})
        return settings
    
    @classmethod
    async def send_email(cls, to_email: str, subject: str, html_content: str, from_name: str = None):
        """Send an email using configured SMTP settings"""
        settings = await cls.get_settings()
        
        if not settings or not settings.get("smtp_host"):
            logger.warning("SMTP not configured, email not sent")
            return False, "SMTP settings not configured"
        
        try:
            smtp_host = settings.get("smtp_host")
            smtp_port = int(settings.get("smtp_port", 587))
            smtp_username = settings.get("smtp_username")
            smtp_password = settings.get("smtp_password")
            from_email = settings.get("from_email")
            default_from_name = settings.get("from_name", "Mastech DME")
            
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{from_name or default_from_name} <{from_email}>"
            msg['To'] = to_email
            
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                server.starttls()
            
            server.login(smtp_username, smtp_password)
            server.sendmail(from_email, to_email, msg.as_string())
            server.quit()
            
            return True, "Email sent successfully"
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP auth error: {e}")
            return False, "SMTP authentication failed"
        except smtplib.SMTPConnectError as e:
            logger.error(f"SMTP connect error: {e}")
            return False, "Could not connect to SMTP server"
        except Exception as e:
            logger.error(f"Email error: {e}")
            return False, str(e)
