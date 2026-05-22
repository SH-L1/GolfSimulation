from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_db


class AnalysisRepository:
    async def save_analysis_result(
        self,
        session_id: str,
        userid: str,
        result: dict,
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

    async def get_by_session_id(self, session_id: str) -> dict | None:
        db = get_db()
        return await db.analysisresults.find_one({"sessionid": ObjectId(session_id)})

    async def get_by_id(self, analysis_result_id) -> dict | None:
        db = get_db()
        return await db.analysisresults.find_one({"_id": analysis_result_id})