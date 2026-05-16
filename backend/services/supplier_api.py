"""
Supplier API Service
- Supplier API client
- Inventory checking
- Order submission
- Demo mode support
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
import random

from config import db

logger = logging.getLogger(__name__)


class SupplierAPIClient:
    """Universal supplier API client - handles different supplier formats"""
    
    SUPPLIER_CONFIGS = {
        "NikoHealth DME": {
            "base_url": "https://api.nikohealth.com/v1",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/inventory/check",
                "order_submit": "/orders",
                "order_status": "/orders/{order_id}/status",
                "pricing": "/products/{sku}/pricing"
            }
        },
        "DDP Medical Supplies": {
            "base_url": "https://api.ddpmedical.com/v2",
            "auth_type": "api_key",
            "endpoints": {
                "inventory": "/stock/availability",
                "order_submit": "/orders/create",
                "order_status": "/orders/{order_id}",
                "pricing": "/catalog/{sku}/price"
            }
        },
        "McKesson Medical-Surgical": {
            "base_url": "https://connect.mckesson.com/api",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/v1/inventory",
                "order_submit": "/v1/orders",
                "order_status": "/v1/orders/{order_id}",
                "pricing": "/v1/pricing"
            }
        },
        "Medline Industries": {
            "base_url": "https://api.medline.com/orders",
            "auth_type": "api_key",
            "endpoints": {
                "inventory": "/inventory/check",
                "order_submit": "/submit",
                "order_status": "/status/{order_id}",
                "pricing": "/pricing/{sku}"
            }
        },
        "Rotech Healthcare": {
            "base_url": "https://orders.rotech.com/api",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/inventory",
                "order_submit": "/orders",
                "order_status": "/orders/{order_id}",
                "pricing": "/products/{sku}/price"
            }
        },
        "AdaptHealth": {
            "base_url": "https://api.adapthealth.com/v1",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/inventory/availability",
                "order_submit": "/orders/new",
                "order_status": "/orders/{order_id}/track",
                "pricing": "/pricing/quote"
            }
        },
        "Byram Healthcare": {
            "base_url": "https://api.byramhealthcare.com",
            "auth_type": "api_key",
            "endpoints": {
                "inventory": "/v1/stock",
                "order_submit": "/v1/orders",
                "order_status": "/v1/orders/{order_id}",
                "pricing": "/v1/pricing"
            }
        },
        "National Seating & Mobility": {
            "base_url": "https://api.nsm-seating.com",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/availability",
                "order_submit": "/orders",
                "order_status": "/orders/{order_id}",
                "pricing": "/quote"
            }
        },
        "Hanger Clinic": {
            "base_url": "https://api.hangerclinic.com",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/stock/check",
                "order_submit": "/orders/submit",
                "order_status": "/orders/{order_id}/status",
                "pricing": "/pricing/get"
            }
        },
        "Apria Healthcare": {
            "base_url": "https://api.apria.com/v2",
            "auth_type": "bearer",
            "endpoints": {
                "inventory": "/inventory/check",
                "order_submit": "/orders",
                "order_status": "/orders/{order_id}",
                "pricing": "/products/pricing"
            }
        }
    }
    
    @staticmethod
    def get_demo_inventory(product_sku: str, quantity: int = 1):
        """Return demo inventory data when no API key configured"""
        in_stock = random.choice([True, True, True, False])
        return {
            "available": in_stock,
            "quantity_available": random.randint(5, 100) if in_stock else 0,
            "estimated_ship_date": (datetime.now(timezone.utc) + timedelta(days=random.randint(1, 5))).isoformat() if in_stock else None,
            "warehouse_location": random.choice(["East Coast", "West Coast", "Central", "Southeast"]),
            "demo_mode": True
        }
    
    @staticmethod
    def get_demo_pricing(product_sku: str):
        """Return demo pricing data when no API key configured"""
        base_price = random.uniform(50, 500)
        return {
            "sku": product_sku,
            "list_price": round(base_price, 2),
            "contract_price": round(base_price * 0.85, 2),
            "medicare_allowable": round(base_price * 0.70, 2),
            "currency": "USD",
            "demo_mode": True
        }
    
    @staticmethod
    def get_demo_order_status(order_id: str):
        """Return demo order status when no API key configured"""
        statuses = ["received", "processing", "shipped", "out_for_delivery", "delivered"]
        status = random.choice(statuses)
        return {
            "order_id": order_id,
            "status": status,
            "tracking_number": f"DEMO{random.randint(100000, 999999)}" if status in ["shipped", "out_for_delivery", "delivered"] else None,
            "estimated_delivery": (datetime.now(timezone.utc) + timedelta(days=random.randint(1, 7))).isoformat(),
            "last_update": datetime.now(timezone.utc).isoformat(),
            "demo_mode": True
        }
    
    @staticmethod
    def get_demo_order_confirmation():
        """Return demo order confirmation when no API key configured"""
        return {
            "success": True,
            "supplier_order_id": f"DEMO-{random.randint(100000, 999999)}",
            "confirmation_number": f"CNF{random.randint(10000, 99999)}",
            "estimated_ship_date": (datetime.now(timezone.utc) + timedelta(days=random.randint(1, 3))).isoformat(),
            "demo_mode": True
        }
    
    @classmethod
    def get_config(cls, supplier_name: str):
        """Get supplier API configuration"""
        return cls.SUPPLIER_CONFIGS.get(supplier_name, {})
