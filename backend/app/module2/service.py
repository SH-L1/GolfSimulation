from __future__ import annotations

import json
from typing import AsyncGenerator
from uuid import uuid4

from ..repositories.analysis_repository import AnalysisRepository
from ..repositories.chat_repository import ChatRepository
from ..services.module2.context_manager import ContextManager
from ..services.module2.ollama_client import OllamaClient
from ..services.module2.priority_selector import PrioritySelector
from ..services.module2.prompt_builder import PromptBuilder


class Module2Service:
    def __init__(
        self,
        chat_repository: ChatRepository,
        analysis_repository: AnalysisRepository,
        context_manager: ContextManager,
        priority_selector: PrioritySelector,
        prompt_builder: PromptBuilder,
        ollama_client: OllamaClient,
    ) -> None:
        self.chat_repository = chat_repository
        self.analysis_repository = analysis_repository
        self.context_manager = context_manager
        self.priority_selector = priority_selector
        self.prompt_builder = prompt_builder
        self.ollama_client = ollama_client

    async def stream_chat(
        self,
        *,
        user_id: str | None,
        message: str,
        session_id: str | None,
        current_session_id: str | None,
        experience_level: str,
    ) -> AsyncGenerator[str, None]:
        swing_session_id = session_id
        chat_session_id = current_session_id or str(uuid4())

        try:
            context = await self.context_manager.load_context(
                user_id=user_id,
                chat_session_id=chat_session_id,
                swing_session_id=swing_session_id,
                experience_level=experience_level,
            )

            priority = self.priority_selector.select(
                user_question=message,
                analysis_result=context.get("analysisResult"),
            )

            prompt = self.prompt_builder.build(
                user_question=message,
                experience_level=experience_level,
                context=context,
                priority=priority,
            )

            text = await self.ollama_client.generate_text(prompt)

            await self.context_manager.append_messages(
                user_id=user_id,
                chat_session_id=chat_session_id,
                swing_session_id=swing_session_id,
                user_message=message,
                assistant_message=text,
                priority=priority,
            )

            yield self._sse({"type": "token", "content": text})
            yield self._sse({"type": "done", "chatSessionId": chat_session_id})

        except Exception as e:
            yield self._sse(
                {
                    "type": "error",
                    "message": f"{type(e).__name__}: {e!r}",
                }
            )

    async def get_history(self, *, user_id: str | None, session_id: str):
        return await self.chat_repository.get_chat_history(
            user_id=user_id,
            session_id=session_id,
        )

    async def delete_history(self, *, user_id: str | None, session_id: str):
        await self.chat_repository.delete_chat_session(
            user_id=user_id,
            session_id=session_id,
        )

    @staticmethod
    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def get_module2_service() -> Module2Service:
    chat_repository = ChatRepository()
    analysis_repository = AnalysisRepository()

    context_manager = ContextManager(
        chat_repository=chat_repository,
        analysis_repository=analysis_repository,
    )
    priority_selector = PrioritySelector()
    prompt_builder = PromptBuilder()
    ollama_client = OllamaClient()

    return Module2Service(
        chat_repository=chat_repository,
        analysis_repository=analysis_repository,
        context_manager=context_manager,
        priority_selector=priority_selector,
        prompt_builder=prompt_builder,
        ollama_client=ollama_client,
    )