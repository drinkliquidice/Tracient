from twilio.rest import Client
from settings import settings

client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

def send_sms(to: str, body: str) -> None:
    client.messages.create(
        body=body,
        from_=settings.TWILIO_FROM_NUMBER,
        to=to
    )