from datetime import datetime
from typing import Optional
from pydantic import Field
from app.models.common import MongoBaseModel, PyObjectId

class MetricItem(MongoBaseModel):
    metricid: str
    uservalue: float
    promean: float
    prostd: float
    idealrange: Optional[list[float]] = None
    unit: Optional[str] = None
    score: float

class AnalysisResultDocument(MongoBaseModel):
    id: Optional[PyObjectId] = Field(default=None, alias='_id')
    sessionid: PyObjectId
    userid: PyObjectId
    overallscore: float
    phasescores: dict[str, float] = Field(default_factory=dict)
    metrics: list[MetricItem] = Field(default_factory=list)
    summary: Optional[str] = None
    referenceversion: Optional[str] = None
    createdat: datetime = Field(default_factory=datetime.utcnow)
