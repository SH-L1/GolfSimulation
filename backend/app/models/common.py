from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, ConfigDict

class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source_type, _handler):
        from pydantic_core import core_schema
        return core_schema.no_info_plain_validator_function(cls.validate)

    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError('Invalid ObjectId')

class MongoBaseModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True, json_encoders={ObjectId: str, datetime: lambda v: v.isoformat()})
