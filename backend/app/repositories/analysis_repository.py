from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from app.db.mongodb import get_db


class AnalysisRepository:
    async def save_analysis_result(
        self,
        session_id: str,
        userid: str,
        result: dict[str, Any],
        chart_url: str | None = None,
    ):
        db = get_db()
        doc = {
            "sessionid": ObjectId(session_id),
            "userid": userid,
            "video_id": result.get("video_id"),
            "view_type": result.get("view_type"),
            "events": result.get("events", {}),
            "metrics": result.get("metrics", {}),
            "scores": result.get("scores", {}),
            "priority_coaching": result.get("priority_coaching", []),
            "charturl": chart_url,
            "createdat": datetime.now(timezone.utc),
        }
        inserted = await db.analysisresults.insert_one(doc)
        return inserted.inserted_id

    async def get_by_session_id(self, session_id: str) -> dict[str, Any] | None:
        db = get_db()
        doc = await db.analysisresults.find_one({"sessionid": ObjectId(session_id)})
        return self._serialize(doc) if doc else None

    async def get_analysis_result(
        self,
        user_id: str | None,
        swing_session_id: str | None,
    ) -> dict[str, Any] | None:
        if not swing_session_id:
            return None
        return await self.get_by_session_id(swing_session_id)

    async def get_by_id(self, analysis_result_id) -> dict[str, Any] | None:
        db = get_db()
        doc = await db.analysisresults.find_one({"_id": analysis_result_id})
        return self._serialize(doc) if doc else None

    def _serialize(self, doc: dict[str, Any]) -> dict[str, Any]:
        out = dict(doc)
        if "_id" in out:
            out["_id"] = str(out["_id"])
        if "sessionid" in out and isinstance(out["sessionid"], ObjectId):
            out["sessionid"] = str(out["sessionid"])
        return out