from pydantic import BaseModel, ConfigDict, AliasGenerator
from pydantic.alias_generators import to_camel

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