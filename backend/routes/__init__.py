"""
API Routes module - aggregates all route handlers
"""
from fastapi import APIRouter

# Create main API router
api_router = APIRouter(prefix="/api")

# Import and include all route modules
from routes.auth import router as auth_router
from routes.users import router as users_router
from routes.patients import router as patients_router
from routes.leads import router as leads_router
from routes.orders import router as orders_router
from routes.suppliers import router as suppliers_router
from routes.documents import router as documents_router
from routes.dashboard import router as dashboard_router

# Include all routers
api_router.include_router(auth_router, tags=["Authentication"])
api_router.include_router(users_router, tags=["Users"])
api_router.include_router(patients_router, tags=["Patients"])
api_router.include_router(leads_router, tags=["Leads"])
api_router.include_router(orders_router, tags=["Orders"])
api_router.include_router(suppliers_router, tags=["Suppliers"])
api_router.include_router(documents_router, tags=["Documents"])
api_router.include_router(dashboard_router, tags=["Dashboard"])
