from fastapi import APIRouter, Depends
from auth import get_current_user
from src.admin.datadef import AdminUser
from src.admin.dashboard import DashboardData, get_dashboard_data

admin_pages_router = APIRouter(prefix="/api/admin")

@admin_pages_router.get("/dashboard")
async def get_dashboard(current_user: AdminUser = Depends(get_current_user)) -> DashboardData:
    return await get_dashboard_data(current_user)