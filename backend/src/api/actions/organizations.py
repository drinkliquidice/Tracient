from fastapi import APIRouter, Depends
from auth import get_current_user

from src.admin.datadef import AdminUser
from src.organizations.create import NewOrganizationForm, create_new_organization
from src.users.create import NewMemberForm, create_new_member
from src.users.update import UpdateMemberForm, update_member
from src.assets.create import NewAssetForm, create_new_asset
from src.assets.update import UpdateAssetForm, update_asset

organizations_actions_router = APIRouter(prefix="/api/admin/organization")


@organizations_actions_router.post("/create")
async def create_organization(
    form: NewOrganizationForm = Depends(),
    admin: AdminUser = Depends(get_current_user),
) -> None:
    await create_new_organization(admin, form)

@organizations_actions_router.post("/member/add")
async def add_member_to_organization(
    form: NewMemberForm,
    admin: AdminUser = Depends(get_current_user),
) -> None:
    await create_new_member(form)

@organizations_actions_router.post("/asset/add")
async def add_asset_to_organization(
    form: NewAssetForm,
    admin: AdminUser = Depends(get_current_user),
) -> None:
    await create_new_asset(form)

@organizations_actions_router.patch("/asset/update")
async def update_organization_asset(
    form: UpdateAssetForm,
    admin: AdminUser = Depends(get_current_user),
) -> None:
    await update_asset(form)

@organizations_actions_router.patch("/member/update")
async def update_organization_member(
    form: UpdateMemberForm,
    admin: AdminUser = Depends(get_current_user),
) -> None:
    await update_member(form)
