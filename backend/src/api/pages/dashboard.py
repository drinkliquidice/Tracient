from fastapi import APIRouter, Depends, Query

from auth import get_current_user
from src.admin.datadef import AdminUser
from src.organizations.interface import (
    DEFAULT_PAGE_LIMIT,
    OrganizationAssetData,
    OrganizationInterfaceData,
    OrganizationMemberData,
    OrganizationMetaData,
    PaginatedAssetsData,
    PaginatedMembersData,
    get_asset_detail,
    get_dashboard_data,
    get_member_detail,
    get_org_meta,
    list_all_assets_with_copies,
    list_assets,
    list_members,
)

admin_pages_router = APIRouter(prefix="/api/admin")


@admin_pages_router.get("/dashboard")
async def get_dashboard(
    current_user: AdminUser = Depends(get_current_user),
) -> OrganizationMetaData:
    """Org shell only — members/assets come from split list endpoints."""
    return await get_org_meta(current_user)


@admin_pages_router.get("/dashboard/full")
async def get_dashboard_full(
    current_user: AdminUser = Depends(get_current_user),
) -> OrganizationInterfaceData:
    """Legacy empty-lists shim (kept for any leftover callers)."""
    return await get_dashboard_data(current_user)


@admin_pages_router.get("/members")
async def get_members(
    q: str = Query(default=""),
    letter: str | None = Query(default=None),
    in_center: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=0),
    current_user: AdminUser = Depends(get_current_user),
) -> PaginatedMembersData:
    return await list_members(
        current_user,
        q=q,
        letter=letter,
        in_center=in_center,
        page=page,
        limit=limit,
    )


@admin_pages_router.get("/members/all")
async def get_all_members(
    q: str = Query(default=""),
    letter: str | None = Query(default=None),
    in_center: bool = Query(default=False),
    current_user: AdminUser = Depends(get_current_user),
) -> PaginatedMembersData:
    return await list_members(
        current_user,
        q=q,
        letter=letter,
        in_center=in_center,
        page=1,
        limit=0,
    )


@admin_pages_router.get("/members/{member_id}")
async def get_member(
    member_id: str,
    current_user: AdminUser = Depends(get_current_user),
) -> OrganizationMemberData:
    return await get_member_detail(current_user, member_id)


@admin_pages_router.get("/assets")
async def get_assets(
    q: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=0),
    current_user: AdminUser = Depends(get_current_user),
) -> PaginatedAssetsData:
    return await list_assets(
        current_user,
        q=q,
        page=page,
        limit=limit,
        include_copies=False,
    )


@admin_pages_router.get("/assets/all")
async def get_all_assets(
    current_user: AdminUser = Depends(get_current_user),
) -> list[OrganizationAssetData]:
    return await list_all_assets_with_copies(current_user)


@admin_pages_router.get("/assets/{asset_id}")
async def get_asset(
    asset_id: str,
    current_user: AdminUser = Depends(get_current_user),
) -> OrganizationAssetData:
    return await get_asset_detail(current_user, asset_id)
