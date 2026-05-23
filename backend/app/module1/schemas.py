from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class AnalyzeResponse(BaseModel):
    jobid: str
    status: Literal["queued"]


class AnalysisStatusResponse(BaseModel):
    status: Literal["queued", "processing", "done", "error"]
    sessionid: Optional[str] = None
    message: Optional[str] = None


class PriorityCoachingItem(BaseModel):
    metric_id: str
    score: float
    phase: str

class ScoreBundle(BaseModel):
    metrics: dict[str, float] = Field(default_factory=dict)
    phases: dict[str, float] = Field(default_factory=dict)
    overall: float | None = None


class SessionListItem(BaseModel):
    sessionid: str
    status: Literal["queued", "processing", "done", "error"]
    viewtype: str
    clubtype: str
    inputfilename: Optional[str] = None
    analyzedat: datetime | None = None
    createdat: datetime


class SessionListResponse(BaseModel):
    sessions: list[SessionListItem]
    total: int
    page: int
    limit: int


class AnalysisResultResponse(BaseModel):
    sessionid: str
    status: Literal["queued", "processing", "done", "error"]
    viewtype: str
    clubtype: str
    inputfilename: Optional[str] = None
    analyzedat: datetime | None = None
    events: dict[str, int] = Field(default_factory=dict)
    metrics: dict[str, float] = Field(default_factory=dict)
    scores: ScoreBundle = Field(default_factory=ScoreBundle)
    priority_coaching: list[PriorityCoachingItem] = Field(default_factory=list)
    charturl: Optional[str] = None
    message: Optional[str] = None
    p1_raw_metrics: dict[str, float] = Field(default_factory=dict)