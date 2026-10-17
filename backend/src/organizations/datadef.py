from typing import Annotated

from beanie import Document
from pydantic import BeforeValidator, Field

from utils import PyObjectId, coerce_object_id_list


ObjectIdList = Annotated[list[PyObjectId], BeforeValidator(coerce_object_id_list)]


class OrganizationDocument(Document):
    name: str
    admin_users: ObjectIdList = Field(default_factory=list)
    members: ObjectIdList = Field(default_factory=list)
    # Manual DB wipes often set this to null or leave bad entries — coerce to a clean list.
    assets: ObjectIdList = Field(default_factory=list)

    class Settings:
        name = "organizations"