from fastapi import APIRouter, File, Form, Query, UploadFile

from app.module1.schemas import (
    AnalyzeResponse,
    AnalysisResultResponse,
    AnalysisStatusResponse,
    SessionListResponse,
)
from app.module1.service import Module1Service

router = APIRouter()
service = Module1Service()


@router.post("/analyze", response_model=AnalyzeResponse, status_code=202)
async def analyze(
    video: UploadFile = File(...),
    viewtype: str = Form(...),
    clubtype: str = Form(...),
    trimstart: float = Form(0),
    trimend: float | None = Form(None),
):
    return await service.enqueue_analysis(
        video=video,
        viewtype=viewtype,
        clubtype=clubtype,
        trimstart=trimstart,
        trimend=trimend,
    )


@router.get("/status/{job_id}", response_model=AnalysisStatusResponse)
async def get_status(job_id: str):
    return await service.get_status(job_id)


@router.get("/result/{session_id}", response_model=AnalysisResultResponse)
async def get_result(session_id: str):
    return await service.get_result(session_id)


@router.get("/sessions", response_model=SessionListResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    return await service.list_sessions(page=page, limit=limit)


@router.get("/sessions/{session_id}", response_model=AnalysisResultResponse)
async def get_session_detail(session_id: str):
    return await service.get_result(session_id)