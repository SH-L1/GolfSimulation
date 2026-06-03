from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.db.mongodb import get_db


class ChatRepository:
    def __init__(self) -> None:
        self.collection = "chatsessions"

    async def get_chat_session(
        self,
        user_id: str | None,
        chat_session_id: str | None,
    ) -> dict[str, Any]:
        db = get_db()

        if chat_session_id:
            session = await db[self.collection].find_one(
                {"chatSessionId": chat_session_id}
            )
            if session:
                return session

        return self._empty_session(
            user_id=user_id,
            chat_session_id=chat_session_id or str(uuid4()),
        )

    async def save_chat_session(
        self,
        user_id: str | None,
        chat_session_id: str,
        payload: dict[str, Any],
    ) -> None:
        db = get_db()

        existing = await db[self.collection].find_one(
            {"chatSessionId": chat_session_id}
        )

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
            "updatedAt": self._now_iso(),
        }

        await db[self.collection].update_one(
            {"chatSessionId": chat_session_id},
            {"$set": normalized},
            upsert=True,
        )

    async def get_chat_history(
        self,
        user_id: str | None,
        session_id: str,
    ) -> dict[str, Any]:
        db = get_db()

        session = await db[self.collection].find_one({"chatSessionId": session_id})
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
        db = get_db()
        await db[self.collection].delete_one({"chatSessionId": session_id})

    def _empty_session(
        self,
        user_id: str | None,
        chat_session_id: str,
    ) -> dict[str, Any]:
        now = self._now_iso()
        return {
            "chatSessionId": chat_session_id,
            "uid": user_id,
            "currentSessionId": None,
            "sessionSummary": {},
            "summaryUpdatedAt": None,
            "messages": [],
            "contextLinks": [],
            "createdAt": now,
            "updatedAt": now,
        }

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()