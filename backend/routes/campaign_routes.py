"""
Marketing Campaign routes.
Handles campaign landing page creation, cloning, analytics tracking, and page limits.
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import re

logger = logging.getLogger(__name__)

campaign_router = APIRouter(prefix="/campaigns", tags=["campaigns"])

_db = None

def set_database(db):
    global _db
    _db = db


class CampaignCreate(BaseModel):
    title: str
    slug: str
    source_type: str = "homepage"  # homepage, product, location, custom
    source_id: Optional[str] = None  # product_id or location slug if cloning a specific page
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    meta_description: Optional[str] = None
    budget: Optional[float] = None


class CampaignUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None  # active, paused, archived
    meta_description: Optional[str] = None
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    budget: Optional[float] = None


# ==================== CRUD ====================

@campaign_router.post("/")
async def create_campaign(data: CampaignCreate):
    """Create a new campaign landing page"""
    # Validate slug
    slug = re.sub(r'[^a-z0-9-]', '', data.slug.lower().strip().replace(' ', '-'))
    if not slug:
        raise HTTPException(status_code=400, detail="Invalid slug")

    # Check slug uniqueness
    existing = await _db.campaigns.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=400, detail="Slug already in use")

    # Check page limit
    settings = await _db.site_settings.find_one({"type": "campaign_settings"}, {"_id": 0})
    max_pages = settings.get("max_pages", 5) if settings else 5
    current_count = await _db.campaigns.count_documents({"status": {"$ne": "archived"}})
    if current_count >= max_pages:
        raise HTTPException(status_code=403, detail=f"Campaign page limit reached ({max_pages}). Contact your administrator to increase the limit.")

    campaign_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    campaign = {
        "id": campaign_id,
        "title": data.title,
        "slug": slug,
        "source_type": data.source_type,
        "source_id": data.source_id,
        "utm_source": data.utm_source or "",
        "utm_medium": data.utm_medium or "",
        "utm_campaign": data.utm_campaign or slug,
        "meta_description": data.meta_description or "",
        "budget": data.budget,
        "status": "active",
        "visits": 0,
        "leads": 0,
        "created_at": now,
        "updated_at": now,
    }

    await _db.campaigns.insert_one(campaign)
    campaign.pop("_id", None)
    return campaign


@campaign_router.get("/")
async def list_campaigns(status: Optional[str] = None):
    """List all campaigns with stats"""
    query = {}
    if status:
        query["status"] = status
    campaigns = await _db.campaigns.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return campaigns


# ==================== TRACK VISIT ====================

@campaign_router.post("/track/{slug}")
async def track_campaign_visit(slug: str, request: Request):
    """Track a visit to a campaign page (called from the page itself)"""
    campaign = await _db.campaigns.find_one({"slug": slug})
    if not campaign:
        return {"tracked": False}

    await _db.campaigns.update_one({"slug": slug}, {"$inc": {"visits": 1}})
    return {"tracked": True}


# ==================== SERVE CAMPAIGN PAGE ====================

@campaign_router.get("/page/{slug}")
async def get_campaign_page_data(slug: str):
    """Get campaign page data for rendering — public endpoint"""
    campaign = await _db.campaigns.find_one({"slug": slug, "status": "active"}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign page not found")

    # Get the source content info
    source_data = {}
    if campaign.get("source_type") == "product" and campaign.get("source_id"):
        product = await _db.products.find_one({"id": campaign["source_id"]}, {"_id": 0, "name": 1, "short_description": 1, "hcpcs_codes": 1, "image_url": 1, "category_id": 1})
        if product:
            cat = await _db.product_categories.find_one({"id": product.get("category_id")}, {"_id": 0, "name": 1})
            source_data = {"product": product, "category": cat.get("name") if cat else ""}

    return {
        "campaign": campaign,
        "source_data": source_data,
    }


# ==================== CLONEABLE PAGES LIST ====================

@campaign_router.get("/templates/available")
async def get_cloneable_templates():
    """Get list of pages available to clone as campaign landing pages"""
    templates = [{"id": "homepage", "name": "Homepage", "type": "homepage", "description": "Main landing page with eligibility form"}]

    # Add enabled product categories
    categories = await _db.product_categories.find({"enabled": True}, {"_id": 0, "id": 1, "name": 1}).sort("sort_order", 1).to_list(50)
    for cat in categories:
        templates.append({"id": f"category-{cat['id']}", "name": cat["name"], "type": "category", "description": f"{cat['name']} product category page"})

    # Add individual enabled products
    products = await _db.products.find({"enabled": True}, {"_id": 0, "id": 1, "name": 1, "short_description": 1, "hcpcs_codes": 1}).sort("name", 1).to_list(200)
    for prod in products:
        codes = ", ".join(prod.get("hcpcs_codes", [])[:3])
        templates.append({"id": f"product-{prod['id']}", "name": prod["name"], "type": "product", "source_id": prod["id"], "description": f"HCPCS: {codes}" if codes else prod.get("short_description", "")})

    return templates


# ==================== SUPER ADMIN: PAGE LIMITS ====================

@campaign_router.get("/settings/limits")
async def get_campaign_limits():
    """Get campaign page limits (super admin)"""
    settings = await _db.site_settings.find_one({"type": "campaign_settings"}, {"_id": 0})
    current_count = await _db.campaigns.count_documents({"status": {"$ne": "archived"}})
    return {
        "max_pages": settings.get("max_pages", 5) if settings else 5,
        "current_count": current_count,
    }


@campaign_router.put("/settings/limits")
async def update_campaign_limits(data: dict):
    """Set campaign page limits (super admin)"""
    max_pages = data.get("max_pages", 5)
    if not isinstance(max_pages, int) or max_pages < 1:
        raise HTTPException(status_code=400, detail="max_pages must be a positive integer")

    await _db.site_settings.update_one(
        {"type": "campaign_settings"},
        {"$set": {"type": "campaign_settings", "max_pages": max_pages, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": f"Campaign page limit set to {max_pages}"}

@campaign_router.get("/{campaign_id}")
async def get_campaign(campaign_id: str):
    """Get a single campaign with detailed stats"""
    campaign = await _db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Get lead count from leads collection
    lead_count = await _db.leads.count_documents({"utm_campaign": campaign.get("slug")})
    campaign["leads"] = lead_count

    return campaign


@campaign_router.put("/{campaign_id}")
async def update_campaign(campaign_id: str, data: CampaignUpdate):
    """Update campaign settings"""
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await _db.campaigns.update_one({"id": campaign_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign updated"}


@campaign_router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str):
    """Delete a campaign"""
    result = await _db.campaigns.delete_one({"id": campaign_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign deleted"}


# ==================== ANALYTICS ====================

@campaign_router.get("/{campaign_id}/analytics")
async def get_campaign_analytics(campaign_id: str, period: str = "30d"):
    """Get detailed analytics for a campaign"""
    campaign = await _db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    slug = campaign.get("slug")

    # Count leads from this campaign
    leads = await _db.leads.find(
        {"utm_campaign": slug},
        {"_id": 0, "id": 1, "first_name": 1, "last_name": 1, "phone": 1, "email": 1, "status": 1, "created_at": 1, "form_source": 1}
    ).sort("created_at", -1).to_list(100)

    # Count visits from analytics
    visits = await _db.analytics_events.count_documents({"utm_campaign": slug})
    if visits == 0:
        visits = campaign.get("visits", 0)

    lead_count = len(leads)
    conversion_rate = round((lead_count / visits * 100), 1) if visits > 0 else 0
    budget = campaign.get("budget") or 0
    cost_per_lead = round(budget / lead_count, 2) if lead_count > 0 and budget > 0 else 0

    return {
        "campaign": campaign,
        "stats": {
            "visitors": visits,
            "leads": lead_count,
            "conversion_rate": conversion_rate,
            "budget": budget,
            "cost_per_lead": cost_per_lead,
        },
        "recent_leads": leads[:20],
    }


