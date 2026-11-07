"""Attendance helpers — signed-in state and Eastern day rollover."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from src.users.datadef import MemberUser
from utils import ensure_aware_utc

TZ = ZoneInfo("America/New_York")


def eastern_now() -> datetime:
    return datetime.now(TZ)


def to_eastern(dt: datetime) -> datetime:
    return ensure_aware_utc(dt).astimezone(TZ)


def eastern_date(dt: datetime) -> date:
    return to_eastern(dt).date()


def is_signed_in(member: MemberUser) -> bool:
    sign_in = member.sign_in_time
    sign_out = member.sign_out_time
    if sign_in is None:
        return False
    if sign_out is None:
        return True
    return sign_in > sign_out


def needs_day_rollover_sign_out(member: MemberUser, now: datetime | None = None) -> bool:
    """True when still signed in from a previous Eastern calendar day."""
    now = now or eastern_now()
    if not is_signed_in(member) or member.sign_in_time is None:
        return False
    return eastern_date(member.sign_in_time) < eastern_date(now)


def apply_day_rollover_sign_out(member: MemberUser, now: datetime | None = None) -> bool:
    """
    Sign out a member whose session crossed midnight (Eastern).

    Sets sign_out_time to 23:59:59 on the sign-in day so the new day can still
    accept a fresh sign-in and sign-out. Does not send notifications.
    Returns True if the member document was mutated.
    """
    now = now or eastern_now()
    if not needs_day_rollover_sign_out(member, now):
        return False
    assert member.sign_in_time is not None
    sign_in_day = eastern_date(member.sign_in_time)
    member.sign_out_time = datetime.combine(sign_in_day, time(23, 59, 59), tzinfo=TZ)
    return True


async def settle_day_rollover(
    members: list[MemberUser],
    now: datetime | None = None,
) -> int:
    """Persist overnight sign-outs. Returns how many members were updated."""
    now = now or eastern_now()
    updated = 0
    for member in members:
        if apply_day_rollover_sign_out(member, now):
            await member.save()
            updated += 1
    return updated
