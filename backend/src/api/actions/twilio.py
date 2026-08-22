from datetime import datetime
import asyncio
import logging
from fastapi import APIRouter, HTTPException
from http import HTTPStatus
from beanie.odm.fields import PydanticObjectId
from zoneinfo import ZoneInfo

from src.users.datadef import MemberUser
from src.notifs.twillo import send_sms
from src.notifs.email import email_configured, send_email

logger = logging.getLogger(__name__)

twilio_actions_router = APIRouter()

@twilio_actions_router.get("/member/{member_id}")
async def member_tap(member_id: str):
    member = await MemberUser.get(PydanticObjectId(member_id))
    if not member:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Member not found")

    now = datetime.now(ZoneInfo("America/New_York"))
    action: str

    sign_in = member.sign_in_time
    sign_out = member.sign_out_time

    if sign_out is None and sign_in is None:
        member.sign_in_time = now
        member.last_signed_in = now
        action = "in"

    elif sign_out is None or (sign_in is not None and sign_in > sign_out):
        member.sign_out_time = now
        action = "out"

    else:
        member.sign_in_time = now
        member.last_signed_in = now
        action = "in"

    await member.save()

    timestamp = now.strftime("%I:%M %p")
    verb = "IN" if action == "in" else "OUT"

    if action == "out" and (member.sms_enabled() or member.email_enabled()):
        sms_body = f"Hi {{greeting}}, {member.name} has signed {verb} at {timestamp}."
        email_body = (
            f"Hi {{greeting}},\n\n"
            f"{member.name} has signed {verb} at {timestamp}.\n"
        )
        can_email = email_configured()
        if member.email_enabled() and not can_email:
            logger.warning("SendGrid is not configured; sign-out emails will be skipped")
        for contact in member.resolved_contacts():
            greeting = contact.name.strip() or "there"
            number = contact.contact_number.strip()
            email = contact.email.strip()
            if member.sms_enabled() and number:
                try:
                    await asyncio.to_thread(
                        send_sms,
                        to=number,
                        body=sms_body.format(greeting=greeting),
                    )
                except Exception as e:
                    logger.error(f"Failed to SMS contact {number}: {e}", exc_info=True)
            if member.email_enabled() and email and can_email:
                try:
                    await asyncio.to_thread(
                        send_email,
                        to=email,
                        subject=f"{member.name} signed {verb}",
                        body=email_body.format(greeting=greeting),
                    )
                except Exception as e:
                    logger.error(f"Failed to email contact {email}: {e}", exc_info=True)

    return {
        "member": member.name,
        "action": action,
        "timestamp": now.isoformat(),
    }
