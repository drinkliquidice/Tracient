from fastapi import APIRouter, Depends
from auth import get_current_user

from src.admin.datadef import AdminUser
from src.assets.circulation import AssetCirculationForm, CirculateResponse, circulate_asset

assets_actions_router = APIRouter(prefix="/api/admin/assets")


@assets_actions_router.post("/circulate")
async def circulate_route(
    form: AssetCirculationForm,
    admin: AdminUser = Depends(get_current_user),
) -> CirculateResponse:
    return await circulate_asset(form, admin)