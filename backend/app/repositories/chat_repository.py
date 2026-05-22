from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


class ChatRepository:
    _store: dict[str, dict[str, Any]] = {}

    async def get_chat_session(
        self,
        user_id: str | None,
        chat_session_id: str | None,
    ) -> dict[str, Any]:
        if not chat_session_id:
            return self._empty_session(user_id=user_id, chat_session_id=None)

        session = self._store.get(chat_session_id)
        if session is None:
            return self._empty_session(user_id=user_id, chat_session_id=chat_session_id)

        return session

    async def save_chat_session(
        self,
        user_id: str | None,
        chat_session_id: str,
        payload: dict[str, Any],
    ) -> None:
        existing = self._store.get(chat_session_id)

        created_at = (
            existing.get("createdAt")
            if existing and existing.get("createdAt")
            else payload.get("createdAt")
            or self._now_iso()
        )

        normalized = {
            "chatSessionId": chat_session_id,
            "uid": user_id,
            "currentSessionId": payload.get("currentSessionId"),
            "sessionSummary": payload.get("sessionSummary", {}),
            "summaryUpdatedAt": payload.get("summaryUpdatedAt"),
            "messages": payload.get("messages", []),
            "contextLinks": payload.get("contextLinks", []),
            "createdAt": created_at,
        }

        self._store[chat_session_id] = normalized

    async def get_chat_history(
        self,
        user_id: str | None,
        session_id: str,
    ) -> dict[str, Any]:
        session = self._store.get(session_id)
        if session is None:
            return {
                "chatSessionId": session_id,
                "swingSessionId": None,
                "createdAt": None,
                "messages": [],
            }

        return {
            "chatSessionId": session.get("chatSessionId"),
            "swingSessionId": session.get("currentSessionId"),
            "createdAt": session.get("createdAt"),
            "messages": session.get("messages", []),
        }

    async def delete_chat_session(
        self,
        user_id: str | None,
        session_id: str,
    ) -> None:
        self._store.pop(session_id, None)

    def _empty_session(
        self,
        user_id: str | None,
        chat_session_id: str | None,
    ) -> dict[str, Any]:
        return {
            "chatSessionId": chat_session_id,
            "uid": user_id,
            "currentSessionId": None,
            "sessionSummary": {},
            "summaryUpdatedAt": None,
            "messages": [],
            "contextLinks": [],
            "createdAt": None,
        }

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()