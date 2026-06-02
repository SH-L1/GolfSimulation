from fastapi import APIRouter, Response, status
from fastapi.responses import StreamingResponse

from .schemas import ChatStreamRequest
from .service import Module2Service, get_module2_service

router = APIRouter()

module2_service: Module2Service = get_module2_service()

chat_repository = module2_service.chat_repository
analysis_repository = module2_service.analysis_repository
context_manager = module2_service.context_manager
priority_selector = module2_service.priority_selector
prompt_builder = module2_service.prompt_builder
ollama_client = module2_service.ollama_client


@router.post("/chat/stream")
async def chat_stream(body: ChatStreamRequest):
    return StreamingResponse(
        module2_service.stream_chat(
            user_id=None,
            message=body.message,
            session_id=body.session_id,
            current_session_id=body.current_session_id,
            experience_level=body.experience_level,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.get("/history/{session_id}")
async def get_history(session_id: str):
    return await module2_service.get_history(
        user_id=None,
        session_id=session_id,
    )


@router.delete("/history/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history(session_id: str):
    await module2_service.delete_history(
        user_id=None,
        session_id=session_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)