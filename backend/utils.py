from bson import ObjectId
from pydantic import BaseModel, ConfigDict, AliasGenerator, GetCoreSchemaHandler
from pydantic.alias_generators import to_camel
from pydantic_core import core_schema


class APIRequestModel(BaseModel):
    """Base model for incoming API requests (validates camelCase input)."""
    model_config = ConfigDict(
        alias_generator=AliasGenerator(validation_alias=to_camel),
        populate_by_name=True  # Allows using snake_case in Python code
    )

class APIResponseModel(BaseModel):
    """Base model for outgoing API responses (serializes to camelCase)."""
    model_config = ConfigDict(
        alias_generator=AliasGenerator(serialization_alias=to_camel),
        populate_by_name=True
    )

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler: GetCoreSchemaHandler):
        return core_schema.no_info_plain_validator_function(
            lambda v: ObjectId(v) if not isinstance(v, ObjectId) else v,
            serialization=core_schema.to_string_ser_schema(),
        )