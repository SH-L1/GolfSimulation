import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.module2.ollama_client import OllamaClient
from app.module2.prompt_builder import PromptBuilder


router = APIRouter()

ollama_client = OllamaClient()
prompt_builder = PromptBuilder()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    sessionId: str | None = None
    currentSessionId: str | None = None
    experienceLevel: str = "beginner"


async def event_stream(body: ChatRequest):
    try:
        prompt = prompt_builder.build(
            message=body.message,
            experience_level=body.experienceLevel,
        )

        text = await ollama_client.generate_text(prompt)

        yield f"data: {json.dumps({'type': 'token', 'content': text}, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'done'}, ensure_ascii=False)}\n\n"

    except Exception as e:
        error_message = f"{type(e).__name__}: {e!r}"
        yield f"data: {json.dumps({'type': 'error', 'message': error_message}, ensure_ascii=False)}\n\n"


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest):
    return StreamingResponse(
        event_stream(body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/history/{session_id}")
async def history(session_id: str):
    return {"session_id": session_id, "messages": []}


@router.delete("/history/{session_id}")
async def delete_history(session_id: str):
    return None