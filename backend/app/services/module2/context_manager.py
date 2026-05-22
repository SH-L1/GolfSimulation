from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from ...core.config import settings
from ...repositories.analysis_repository import AnalysisRepository
from ...repositories.chat_repository import ChatRepository


class ContextManager:
    def __init__(
        self,
        chat_repository: ChatRepository,
        analysis_repository: AnalysisRepository,
    ) -> None:
        self.chat_repository = chat_repository
        self.analysis_repository = analysis_repository
        self.recent_limit = getattr(settings, "chat_recent_messages_limit", 10)

    async def load_context(
        self,
        user_id: str | None,
        chat_session_id: str | None,
        swing_session_id: str | None,
        experience_level: str,
    ) -> dict[str, Any]:
        chat_session = await self.chat_repository.get_chat_session(
            user_id=user_id,
            chat_session_id=chat_session_id,
        )

        linked_session_id = swing_session_id or chat_session.get("currentSessionId")

        analysis_result = await self.analysis_repository.get_analysis_result(
            user_id=user_id,
            swing_session_id=linked_session_id,
        )

        recent_messages = chat_session.get("messages", [])[-self.recent_limit:]
        summary = chat_session.get("sessionSummary", {})
        context_links = chat_session.get("contextLinks", [])

        return {
            "chatSessionId": chat_session.get("chatSessionId"),
            "swingSessionId": linked_session_id,
            "experienceLevel": experience_level,
            "analysisResult": analysis_result,
            "chatContext": {
                "summary": summary,
                "recentMessages": recent_messages,
                "contextLinks": context_links,
            },
        }

    async def append_messages(
        self,
        user_id: str | None,
        chat_session_id: str,
        swing_session_id: str | None,
        user_message: str,
        assistant_message: str,
        priority: dict[str, Any],
    ) -> None:
        now = self._now_iso()

        chat_session = await self.chat_repository.get_chat_session(
            user_id=user_id,
            chat_session_id=chat_session_id,
        )
        messages = list(chat_session.get("messages", []))

        user_msg_id = f"user-{len(messages) + 1}"
        messages.append(
            {
                "messageId": user_msg_id,
                "role": "user",
                "content": user_message,
                "createdAt": now,
            }
        )

        assistant_msg_id = f"assistant-{len(messages) + 1}"
        messages.append(
            {
                "messageId": assistant_msg_id,
                "role": "assistant",
                "content": assistant_message,
                "createdAt": now,
            }
        )

        summary = self._build_updated_summary(
            existing_summary=chat_session.get("sessionSummary", {}),
            user_message=user_message,
            assistant_message=assistant_message,
            priority=priority,
        )

        updated = {
            "chatSessionId": chat_session_id,
            "uid": user_id,
            "currentSessionId": swing_session_id,
            "sessionSummary": summary,
            "summaryUpdatedAt": now,
            "messages": messages,
            "contextLinks": self._build_context_links(priority, swing_session_id),
        }

        await self.chat_repository.save_chat_session(
            user_id=user_id,
            chat_session_id=chat_session_id,
            payload=updated,
        )

    def _build_updated_summary(
        self,
        existing_summary: dict[str, Any],
        user_message: str,
        assistant_message: str,
        priority: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "currentGoal": priority.get("goal"),
            "recentWeakMetrics": [
                m.get("metricId") for m in priority.get("focusMetrics", [])
            ],
            "recentWeakPhases": (
                [priority.get("focusPhase")] if priority.get("focusPhase") else []
            ),
            "coachFocus": priority.get("goal"),
            "lastCoachCue": assistant_message[:120],
            "followUpNeeded": self._infer_follow_up_needed(user_message, priority),
            "previousSummary": existing_summary.get("currentGoal"),
        }

    def _build_context_links(
        self,
        priority: dict[str, Any],
        swing_session_id: str | None,
    ) -> list[dict[str, Any]]:
        links: list[dict[str, Any]] = []

        if swing_session_id:
            links.append({"type": "analysis", "sessionId": swing_session_id})

        for metric in priority.get("focusMetrics", []):
            links.append({"type": "metric", "metricId": metric.get("metricId")})

        if priority.get("focusPhase"):
            links.append({"type": "phase", "phase": priority["focusPhase"]})

        return links

    def _infer_follow_up_needed(
        self,
        user_message: str,
        priority: dict[str, Any],
    ) -> str:
        goal = priority.get("goal")

        if goal == "Power":
            return "다음 턴에서 골반 선행 감각이 개선됐는지 확인"
        if goal == "Contact":
            return "다음 턴에서 임팩트 느낌과 정타 여부 확인"
        if goal == "Stability":
            return "다음 턴에서 finish 균형 유지 여부 확인"
        if goal == "Safety":
            return "다음 턴에서 통증 지속 여부 확인"

        return "다음 턴에서 사용자의 추가 맥락 확인"

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()