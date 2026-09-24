from datetime import datetime
import asyncio
import logging
from fastapi import APIRouter, HTTPException, Query
from http import HTTPStatus
from beanie.odm.fields import PydanticObjectId
from zoneinfo import ZoneInfo

from src.users.datadef import MemberUser
from src.notifs.twillo import send_sms
from src.notifs.email import email_configured, send_email

logger = logging.getLogger(__name__)

twilio_actions_router = APIRouter()

TZ = ZoneInfo("America/New_York")


def _is_signed_in(member: MemberUser) -> bool:
    sign_in = member.sign_in_time
    sign_out = member.sign_out_time
    if sign_in is None:
        return False
    if sign_out is None:
        return True
    return sign_in > sign_out


def _apply_action(member: MemberUser, action: str, now: datetime) -> None:
    if action == "in":
        member.sign_in_time = now
        member.last_signed_in = now
    else:
        member.sign_out_time = now


async def _notify_sign_out(member: MemberUser, now: datetime) -> None:
    if not (member.sms_enabled() or member.email_enabled()):
        return

    timestamp = now.strftime("%I:%M %p")
    sms_body = f"Hi {{greeting}}, {member.name} has signed OUT at {timestamp}."
    email_body = (
        f"Hi {{greeting}},\n\n"
        f"{member.name} has signed OUT at {timestamp}.\n"
    )
    can_email = email_configured()
    if member.email_enabled() and not can_email:
        logger.warning("SendGrid is not configured; sign-out emails will be skipped")

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
                    subject=f"{member.name} signed OUT",
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

    now = datetime.now(TZ)

    if action is None:
        action = "out" if _is_signed_in(member) else "in"

    _apply_action(member, action, now)
    await member.save()

    if action == "out":
        await _notify_sign_out(member, now)

    return {
        "member": member.name,
        "action": action,
        "timestamp": now.isoformat(),
        "signInTime": member.sign_in_time.isoformat() if member.sign_in_time else None,
        "signOutTime": member.sign_out_time.isoformat() if member.sign_out_time else None,
        "lastSignIn": member.last_signed_in.isoformat() if member.last_signed_in else None,
    }
