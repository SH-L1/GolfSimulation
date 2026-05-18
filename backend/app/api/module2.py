from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio

router = APIRouter()

async def event_stream():
    for token in ["안녕하세요", " ", "코칭", " ", "준비중입니다"]:
        yield f"data: {{\"type\": \"token\", \"content\": \"{token}\"}}\n\n"
        await asyncio.sleep(0.05)
    yield 'data: {"type": "done"}\n\n'

@router.post('/chat/stream')
async def chat_stream():
    return StreamingResponse(event_stream(), media_type='text/event-stream')

@router.get('/history/{session_id}')
async def history(session_id: str):
    return {"session_id": session_id, "messages": []}

@router.delete('/history/{session_id}')
async def delete_history(session_id: str):
    return None
