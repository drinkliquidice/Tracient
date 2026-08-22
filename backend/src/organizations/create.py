from __future__ import annotations
import csv
from io import StringIO
from itertools import zip_longest
from fastapi import UploadFile, File, Form
from pymongo.errors import DuplicateKeyError

from src.admin.datadef import AdminUser
from src.users.datadef import MemberUser, ContactSubDocument
from src.assets.datadef import AssetDocument
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


def create_contact_subdocuments(
    contact_names: str,
    contact_numbers: str,
    contact_emails: str = "",
) -> list[ContactSubDocument]:
    names = [part.strip() for part in contact_names.split(",")]
    numbers = [part.strip() for part in contact_numbers.split(",")]
    emails = [part.strip() for part in contact_emails.split(",")] if contact_emails else []
    contacts: list[ContactSubDocument] = []
    for name, number, email in zip_longest(names, numbers, emails, fillvalue=""):
        if not (name or number or email):
            continue
        contacts.append(ContactSubDocument(
            name=name or "",
            email=email or "",
            contact_number=number or "",
        ))
    return contacts


async def parse_csv_and_add_components(
    csv_bytes: bytes
) -> tuple[list, list]:
    member_csv_data = StringIO(csv_bytes.decode('utf-8'))
    reader = csv.DictReader(member_csv_data)
    members: list[MemberUser] = []
    asset_list: list[AssetDocument] = []
    for row in reader:
        contacts: list[ContactSubDocument] = create_contact_subdocuments(
            row["contact_name"],
            row["contact_number"],
            row.get("contact_email", ""),
        )
        member = MemberUser.assemble(
            name = row["name"],
            contacts = contacts,
            use_sms= row.get("use_sms", row.get("use_contact", "false")).lower() == "true",
            use_email= row.get("use_email", "false").lower() == "true",
        )
        members.append(member)
        asset_list.append(AssetDocument.assemble(
            name = row["asset_name"],
            total_quantity = int(row.get("total_quantity") or row["quantity"])
        ))
    
    await MemberUser.insert_many(members)
    await AssetDocument.insert_many(asset_list)
    return ([m.id for m in members], [a.id for a in asset_list])


async def create_new_organization(admin: AdminUser, form: NewOrganizationForm) -> None:
    csv_bytes = await form.members_csv.read()
    member_ids, asset_ids = await parse_csv_and_add_components(csv_bytes)
 
    try:
        org_doc = await OrganizationDocument(
            name=form.name,
            admin_users=[admin.id],
            members=member_ids,
            assets=asset_ids,
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