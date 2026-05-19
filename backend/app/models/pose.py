from datetime import datetime
from typing import Optional
from pydantic import Field
from app.models.common import MongoBaseModel, PyObjectId

class PoseLandmark(MongoBaseModel):
    jointid: int
    x: float
    y: float
    z: float
    visibility: Optional[float] = None

class PoseFrameDocument(MongoBaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias='_id')
    sessionid: PyObjectId
    frameidx: int
    timestampms: Optional[float] = None
    landmarks: list[PoseLandmark] = Field(default_factory=list)
    createdat: datetime = Field(default_factory=datetime.utcnow)
