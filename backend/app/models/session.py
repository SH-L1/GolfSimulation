from datetime import datetime
from typing import Optional, Literal
from pydantic import Field
from app.models.common import MongoBaseModel, PyObjectId

class SwingEvent(MongoBaseModel):
    eventlabel: str
    frameidx: int
    confidence: Optional[float] = None
    detectionmethod: Optional[str] = None

class HighlightedIssue(MongoBaseModel):
    frameidx: int
    jointid: int
    severity: str
    reason: Optional[str] = None

class SwingSessionDocument(MongoBaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias='_id')
    userid: PyObjectId
    viewtype: Literal['dtl', 'faceon', 'other']
    status: Literal['queued', 'processing', 'done', 'error']
    inputfilename: Optional[str] = None
    durationsec: Optional[float] = None
    fps: Optional[float] = None
    analysisresultid: Optional[PyObjectId] = None
    swingevents: list[SwingEvent] = Field(default_factory=list)
    highlightedissues: list[HighlightedIssue] = Field(default_factory=list)
    createdat: datetime = Field(default_factory=datetime.utcnow)
    updatedat: datetime = Field(default_factory=datetime.utcnow)
