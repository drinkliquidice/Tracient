from fastapi import APIRouter, Depends
from auth import get_current_user

from src.admin.datadef import AdminUser
from src.organizations.create import NewOrganizationForm, create_new_organization

organizations_actions_router = APIRouter(prefix="/api/admin/organization")


@organizations_actions_router.post("/create")
async def create_organization(
    form: NewOrganizationForm = Depends(),
    admin: AdminUser = Depends(get_current_user),
) -> None:
    await create_new_organization(admin, form)
