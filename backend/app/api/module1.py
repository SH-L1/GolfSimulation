from fastapi import APIRouter

router = APIRouter()

@router.post('/analyze')
async def analyze():
    return {"status": "queued"}

@router.get('/status/{job_id}')
async def status(job_id: str):
    return {"job_id": job_id, "status": "queued"}

@router.get('/result/{session_id}')
async def result(session_id: str):
    return {"session_id": session_id}

@router.get('/sessions')
async def sessions():
    return {"sessions": []}

@router.get('/sessions/{session_id}')
async def session_detail(session_id: str):
    return {"session_id": session_id}
