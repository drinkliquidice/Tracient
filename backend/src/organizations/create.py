from __future__ import annotations
import csv
from io import StringIO
from itertools import zip_longest
from fastapi import UploadFile, File, Form
from pymongo.errors import DuplicateKeyError

from src.admin.datadef import AdminUser
from src.users.datadef import MemberUser, ContactSubDocument
from src.database.mongodb import mongo
from src.organizations.datadef import OrganizationDocument


class NewOrganizationForm:
    def __init__(
        self,
        name: str = Form(..., min_length=2, max_length=100),
        members_csv: UploadFile = File(...),
    ):
        self.name = name
        self.members_csv = members_csv


MISSING_TEXT = "TEMP"


def _normalize_name(value: str) -> str:
    """Underscores stand in for spaces within multi-part names in the CSV."""
    return value.replace("_", " ").strip()


def _split_csv_field(value: str) -> list[str]:
    return [_normalize_name(part) for part in value.split(",")] if value else []


def _or_temp(value: str) -> str:
    return value.strip() if value and value.strip() else MISSING_TEXT


def create_contact_subdocuments(
    contact_names: str,
    contact_numbers: str,
    contact_emails: str = "",
    use_sms: bool = False,
    use_email: bool = False,
) -> list[ContactSubDocument]:
    names = _split_csv_field(contact_names)
    numbers = [part.strip() for part in contact_numbers.split(",")] if contact_numbers else []
    emails = [part.strip() for part in contact_emails.split(",")] if contact_emails else []

    if not names and not numbers and not emails:
        return [ContactSubDocument(
            name=MISSING_TEXT,
            email=MISSING_TEXT,
            contact_number=MISSING_TEXT,
            use_sms=use_sms,
            use_email=use_email,
        )]

    contacts: list[ContactSubDocument] = []
    for name, number, email in zip_longest(names, numbers, emails, fillvalue=""):
        name = (name or "").strip()
        number = (number or "").strip()
        email = (email or "").strip()
        if not (name or number or email):
            continue
        contacts.append(ContactSubDocument(
            name=_or_temp(name),
            email=_or_temp(email),
            contact_number=_or_temp(number),
            use_sms=use_sms,
            use_email=use_email,
        ))

    if not contacts:
        return [ContactSubDocument(
            name=MISSING_TEXT,
            email=MISSING_TEXT,
            contact_number=MISSING_TEXT,
            use_sms=use_sms,
            use_email=use_email,
        )]
    return contacts


def _csv_dict_reader(csv_bytes: bytes) -> csv.DictReader:
    text = csv_bytes.decode("utf-8-sig")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
    except csv.Error:
        dialect = csv.excel
    return csv.DictReader(StringIO(text), dialect=dialect)


async def parse_csv_and_add_members(csv_bytes: bytes) -> list[str]:
    reader = _csv_dict_reader(csv_bytes)
    members: list[MemberUser] = []
    for row in reader:
        raw_name = (row.get("name") or "").strip()
        member_name = _normalize_name(raw_name) if raw_name else MISSING_TEXT
        if not raw_name and not any(
            (row.get(key) or "").strip()
            for key in ("contact_name", "contact_number", "contact_emails", "contact_email")
        ):
            continue
        contact_emails = row.get("contact_emails") or row.get("contact_email") or ""
        use_contact = (row.get("use_contact") or "false").strip().lower() == "true"
        use_sms_raw = (row.get("use_sms") or "").strip()
        use_sms = use_sms_raw.lower() == "true" if use_sms_raw else use_contact
        use_email = (row.get("use_email") or "false").strip().lower() == "true"
        contacts = create_contact_subdocuments(
            row.get("contact_name") or "",
            row.get("contact_number") or "",
            contact_emails,
            use_sms=use_sms,
            use_email=use_email,
        )
        members.append(MemberUser.assemble(
            name=member_name,
            contacts=contacts,
            use_sms=use_sms,
            use_email=use_email,
        ))

    if not members:
        raise RuntimeError("Members CSV must contain at least one member")

    await MemberUser.insert_many(members)
    return [m.id for m in members]


async def create_new_organization(admin: AdminUser, form: NewOrganizationForm) -> None:
    csv_bytes = await form.members_csv.read()
    member_ids = await parse_csv_and_add_members(csv_bytes)

    try:
        org_doc = await OrganizationDocument(
            name=form.name,
            admin_users=[admin.id],
            members=member_ids,
            assets=[],
        ).insert()
    except DuplicateKeyError:
        raise RuntimeError("Organization name already taken")
    except Exception as e:
        raise RuntimeError(f"Failed to create organization: {e}")

    try:
        admin_collection = mongo["admin_users"]
        await admin_collection.update_one(
            {"_id": admin.id},
            {"$set": {"organization": org_doc.id}}
        )
    except Exception as e:
        await mongo["organizations"].delete_one({"_id": org_doc.id})
        raise RuntimeError(f"Failed to add organization to user: {e}")
