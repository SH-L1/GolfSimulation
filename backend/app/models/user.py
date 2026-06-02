from datetime import datetime
from typing import Optional, Literal
from pydantic import Field
from app.models.common import MongoBaseModel, PyObjectId

class UserDocument(MongoBaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias='_id')
    uid: str
    displayname: Optional[str] = None
    experiencelevel: Literal['beginner', 'experienced']
    handicap: Optional[float] = None
    createdat: datetime = Field(default_factory=datetime.utcnow)
