from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class AnalyzeResponse(BaseModel):
    jobid: str
    status: Literal['queued']


class AnalysisStatusResponse(BaseModel):
    status: Literal['queued', 'processing', 'done', 'error']
    sessionid: Optional[str] = None
    message: Optional[str] = None


class SessionListItem(BaseModel):
    sessionid: str
    status: Literal['queued', 'processing', 'done', 'error']
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
    status: Literal['queued', 'processing', 'done', 'error']
    viewtype: str
    clubtype: str
    inputfilename: Optional[str] = None
    analyzedat: datetime | None = None
    overallscore: float | None = None
    phasescores: dict[str, float] = Field(default_factory=dict)
    metrics: list[dict[str, Any]] = Field(default_factory=list)
    recommendations: list[dict[str, Any]] = Field(default_factory=list)
    message: Optional[str] = None
