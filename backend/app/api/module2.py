# from fastapi import APIRouter, Depends, Response, status
# from fastapi.responses import StreamingResponse

# from .deps import get_current_user
# from ..module2.schemas import ChatStreamRequest
# from ..module2.service import Module2Service, get_module2_service

# router = APIRouter(prefix="/module2", tags=["module2"])


# def _extract_user_id(current_user) -> str:
#     if isinstance(current_user, dict):
#         return current_user.get("id") or current_user.get("uid")
#     return getattr(current_user, "id", None) or getattr(current_user, "uid", None)


# @router.post("/chat/stream")
# async def chat_stream(
#     payload: ChatStreamRequest,
#     current_user=Depends(get_current_user),
#     service: Module2Service = Depends(get_module2_service),
# ):
#     user_id = _extract_user_id(current_user)

#     generator = service.stream_chat(
#         user_id=user_id,
#         message=payload.message,
#         session_id=payload.session_id,
#         current_session_id=payload.current_session_id,
#         experience_level=payload.experience_level,
#     )

#     return StreamingResponse(
#         generator,
#         media_type="text/event-stream",
#         headers={
#             "Cache-Control": "no-cache",
#             "Connection": "keep-alive",
#         },
#     )


# @router.get("/history/{session_id}")
# async def get_history(
#     session_id: str,
#     current_user=Depends(get_current_user),
#     service: Module2Service = Depends(get_module2_service),
# ):
#     user_id = _extract_user_id(current_user)

#     return await service.get_history(
#         user_id=user_id,
#         session_id=session_id,
#     )


# @router.delete("/history/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
# async def delete_history(
#     session_id: str,
#     current_user=Depends(get_current_user),
#     service: Module2Service = Depends(get_module2_service),
# ):
#     user_id = _extract_user_id(current_user)

#     await service.delete_history(
#         user_id=user_id,
#         session_id=session_id,
#     )
#     return Response(status_code=status.HTTP_204_NO_CONTENT)