"""
Fax Service (Telnyx Integration)
- Send fax
- Receive fax callbacks
- Cover page generation
"""
import logging
import httpx
from datetime import datetime, timezone
import uuid

from config import db

logger = logging.getLogger(__name__)


class FaxService:
    """Fax service using Telnyx API"""
    
    TELNYX_API_URL = "https://api.telnyx.com/v2"
    
    @classmethod
    async def get_settings(cls):
        """Fetch fax settings from database"""
        settings = await db.site_settings.find_one({"type": "fax"})
        return settings
    
    @classmethod
    async def send_fax(cls, to_number: str, media_url: str, from_number: str = None):
        """Send a fax using Telnyx"""
        settings = await cls.get_settings()
        
        if not settings or not settings.get("api_key"):
            logger.warning("Telnyx not configured")
            return None, "Fax service not configured"
        
        api_key = settings.get("api_key")
        default_from = settings.get("fax_number")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{cls.TELNYX_API_URL}/faxes",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "to": to_number,
                        "from": from_number or default_from,
                        "media_url": media_url
                    },
                    timeout=30.0
                )
                
                if response.status_code in [200, 201, 202]:
                    return response.json(), None
                else:
                    return None, f"Telnyx error: {response.status_code}"
                    
        except Exception as e:
            logger.error(f"Fax send error: {e}")
            return None, str(e)
    
    @classmethod
    async def generate_cover_page(cls, recipient_name: str, recipient_fax: str, 
                                  sender_name: str, subject: str, message: str):
        """Generate HTML cover page for fax"""
        now = datetime.now(timezone.utc).strftime("%B %d, %Y %I:%M %p")
        
        html = f"""<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; padding: 40px; }}
        .header {{ border-bottom: 3px solid #333; padding-bottom: 20px; }}
        .title {{ font-size: 28px; font-weight: bold; color: #333; }}
        .subtitle {{ color: #666; margin-top: 5px; }}
        .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; }}
        .info-section h3 {{ color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }}
        .info-row {{ margin: 10px 0; }}
        .label {{ font-weight: bold; color: #666; }}
        .message-section {{ margin-top: 30px; padding: 20px; background: #f5f5f5; }}
        .footer {{ margin-top: 40px; font-size: 12px; color: #999; }}
    </style>
</head>
<body>
    <div class="header">
        <div class="title">FAX TRANSMISSION</div>
        <div class="subtitle">Mastech DME - Durable Medical Equipment</div>
    </div>
    
    <div class="info-grid">
        <div class="info-section">
            <h3>TO</h3>
            <div class="info-row"><span class="label">Name:</span> {recipient_name}</div>
            <div class="info-row"><span class="label">Fax:</span> {recipient_fax}</div>
        </div>
        <div class="info-section">
            <h3>FROM</h3>
            <div class="info-row"><span class="label">Name:</span> {sender_name}</div>
            <div class="info-row"><span class="label">Date:</span> {now}</div>
        </div>
    </div>
    
    <div class="info-row"><span class="label">Subject:</span> {subject}</div>
    
    <div class="message-section">
        <h3>Message</h3>
        <p>{message}</p>
    </div>
    
    <div class="footer">
        <p>This fax contains confidential information intended for the named recipient. 
        If you are not the intended recipient, please notify the sender immediately.</p>
    </div>
</body>
</html>"""
        
        return html
