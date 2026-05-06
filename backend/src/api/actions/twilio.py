from datetime import datetime
from fastapi import APIRouter, HTTPException
from http import HTTPStatus
from beanie.odm.fields import PydanticObjectId
from zoneinfo import ZoneInfo

from src.users.datadef import MemberUser
from src.notifs.twillo import send_sms

twilio_actions_router = APIRouter()

@twilio_actions_router.get("/member/{member_id}")
async def member_tap(member_id: str):
    # Fetch the member by ID
    member = await MemberUser.get(PydanticObjectId(member_id))
    if not member:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail="Member not found")

    now = datetime.now(ZoneInfo("America/New_York"))
    action: str

    sign_in = member.sign_in_time
    sign_out = member.sign_out_time

    if sign_out is None and sign_in is None:
        # First ever tap — sign them in
        member.sign_in_time = now
        member.last_signed_in = now
        action = "in"

    elif sign_out is None or (sign_in is not None and sign_in > sign_out):
        # sign_in is the most recent event → sign them OUT
        member.sign_out_time = now
        action = "out"

    else:
        # sign_out is the most recent event (or sign_in is None) → sign them IN
        member.sign_in_time = now
        member.last_signed_in = now
        action = "in"

    await member.save()

    # Build and send SMS to the contact number
    timestamp = now.strftime("%I:%M %p")
    if action == "in":
        message = (
            f"Hi {member.contact_name}, {member.name} has signed IN at {timestamp}."
        )
    else:
        message = (
            f"Hi {member.contact_name}, {member.name} has signed OUT at {timestamp}."
        )

    if member.use_contact:
        send_sms(to=member.contact_number, body=message)

    return {
        "member": member.name,
        "action": action,
        "timestamp": now.isoformat(),
    }