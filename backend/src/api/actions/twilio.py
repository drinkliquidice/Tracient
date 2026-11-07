from datetime import date, datetime
import asyncio
import logging
from fastapi import APIRouter, HTTPException, Query
from http import HTTPStatus
from beanie.odm.fields import PydanticObjectId

from src.users.datadef import MemberUser
from src.users.attendance import (
    eastern_date,
    eastern_now,
    is_signed_in,
    scan_cooldown_remaining,
    settle_day_rollover,
)
from src.notifs.twillo import send_sms
from src.notifs.email import email_configured, send_email
from utils import to_iso_eastern

logger = logging.getLogger(__name__)

twilio_actions_router = APIRouter()


def _happened_today(dt: datetime | None, now: datetime) -> bool:
    if dt is None:
        return False
    return eastern_date(dt) == eastern_date(now)


def _eastern_date(dt: datetime) -> date:
    return ensure_aware_utc(dt).astimezone(TZ).date()


def _happened_today(dt: datetime | None, now: datetime) -> bool:
    if dt is None:
        return False
    return _eastern_date(dt) == _eastern_date(now)


def _apply_action(member: MemberUser, action: str, now: datetime) -> None:
    if action == "in":
        member.sign_in_time = now
        member.last_signed_in = now
    else:
        member.sign_out_time = now


def _enforce_once_per_day(member: MemberUser, action: str, now: datetime) -> None:
    """Members may sign in once and sign out once per Eastern calendar day."""
    if action == "in" and _happened_today(member.sign_in_time, now):
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail="Already signed in today",
        )
    if action == "out" and _happened_today(member.sign_out_time, now):
        raise HTTPException(
            HTTPStatus.CONFLICT,
            detail="Already signed out today",
        )


async def _notify_sign_action(member: MemberUser, action: str, now: datetime) -> None:
    if action not in ("in", "out"):
        return
    if not (member.sms_enabled() or member.email_enabled()):
        return

    label = "IN" if action == "in" else "OUT"
    timestamp = now.strftime("%I:%M %p")
    sms_body = f"Hi {{greeting}}, {member.name} has signed {label} at {timestamp}."
    email_body = (
        f"Hi {{greeting}},\n\n"
        f"{member.name} has signed {label} at {timestamp}.\n"
    )
    can_email = email_configured()
    if member.email_enabled() and not can_email:
        logger.warning("SendGrid is not configured; sign-%s emails will be skipped", action)

    for contact in member.resolved_contacts():
        greeting = contact.name.strip() or "there"
        number = contact.contact_number.strip()
        email = contact.email.strip()
        if member.contact_should_sms(contact) and number:
            try:
                await asyncio.to_thread(
                    send_sms,
                    to=number,
                    body=sms_body.format(greeting=greeting),
                )
            except Exception as e:
                logger.error(f"Failed to SMS contact {number}: {e}", exc_info=True)
        if member.contact_should_email(contact) and email and can_email:
            try:
                await asyncio.to_thread(
                    send_email,
                    to=email,
                    subject=f"{member.name} signed {label}",
                    body=email_body.format(greeting=greeting),
                )
            except Exception as e:
                logger.error(f"Failed to email contact {email}: {e}", exc_info=True)


@twilio_actions_router.get("/member/{member_id}")
async def member_tap(
    member_id: str,
    action: str | None = Query(default=None),
):
    member = await MemberUser.get(PydanticObjectId(member_id))
    if not member:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Member not found")

    if action is not None and action not in ("in", "out"):
        raise HTTPException(HTTPStatus.BAD_REQUEST, detail="action must be 'in' or 'out'")

    # Close any session that crossed midnight before applying today's action
    await settle_day_rollover([member])

    now = eastern_now()

    # QR toggle path only — manual dashboard passes action=in|out explicitly
    if action is None:
        remaining = scan_cooldown_remaining(member, now)
        if remaining is not None:
            minutes = max(1, int((remaining.total_seconds() + 59) // 60))
            raise HTTPException(
                HTTPStatus.TOO_MANY_REQUESTS,
                detail=f"Please wait {minutes} more minute{'s' if minutes != 1 else ''} before scanning this code again",
            )
        action = "out" if is_signed_in(member) else "in"

    _enforce_once_per_day(member, action, now)
    _apply_action(member, action, now)
    await member.save()

    await _notify_sign_action(member, action, now)

    return {
        "member": member.name,
        "action": action,
        "timestamp": to_iso_eastern(now),
        "signInTime": to_iso_eastern(member.sign_in_time),
        "signOutTime": to_iso_eastern(member.sign_out_time),
        "lastSignIn": to_iso_eastern(member.last_signed_in),
    }
