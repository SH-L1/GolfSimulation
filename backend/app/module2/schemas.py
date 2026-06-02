from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict


class ChatStreamRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = Field(default=None, alias="sessionId")
    current_session_id: str | None = Field(default=None, alias="currentSessionId")
    experience_level: Literal["beginner", "experienced"] = Field(
        default="beginner",
        alias="experienceLevel",
    )

    model_config = ConfigDict(
        populate_by_name=True,
    )


class ChatMessage(BaseModel):
    message_id: str | None = None
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime | None = None


class ChatHistoryResponse(BaseModel):
    chat_session_id: str
    swing_session_id: str | None = None
    created_at: datetime | None = None
    messages: list[ChatMessage] = Field(default_factory=list)