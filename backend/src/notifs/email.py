from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import From, Mail

from settings import settings


def email_configured() -> bool:
    return bool(settings.SENDGRID_API_KEY and settings.SENDGRID_FROM_EMAIL)


def send_email(to: str, subject: str, body: str) -> None:
    if not email_configured():
        raise RuntimeError("SendGrid is not configured")

    from_email = (
        From(settings.SENDGRID_FROM_EMAIL, settings.SENDGRID_FROM_NAME)
        if settings.SENDGRID_FROM_NAME
        else settings.SENDGRID_FROM_EMAIL
    )
    message = Mail(
        from_email=from_email,
        to_emails=to,
        subject=subject,
        plain_text_content=body,
    )
    SendGridAPIClient(settings.SENDGRID_API_KEY).send(message)
