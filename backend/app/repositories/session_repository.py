from datetime import datetime, timezone

from bson import ObjectId

from app.db.mongodb import get_db


class SessionRepository:
    async def create_session(self, session_doc: dict) -> str:
        db = get_db()
        await db.swingsessions.insert_one(session_doc)
        return str(session_doc["_id"])

    async def get_by_job_id(self, job_id: str) -> dict | None:
        db = get_db()
        return await db.swingsessions.find_one({"jobid": job_id})

    async def get_by_id(self, session_id: str) -> dict | None:
        db = get_db()
        return await db.swingsessions.find_one({"_id": ObjectId(session_id)})

    async def list_by_user(self, userid: str, skip: int, limit: int) -> list[dict]:
        db = get_db()
        cursor = (
            db.swingsessions
            .find({"userid": userid})
            .sort("createdat", -1)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def count_by_user(self, userid: str) -> int:
        db = get_db()
        return await db.swingsessions.count_documents({"userid": userid})

    async def update_status(self, session_id: str, status: str, **extra) -> None:
        db = get_db()
        update_data = {
            "status": status,
            "updatedat": datetime.now(timezone.utc),
            **extra,
        }
        await db.swingsessions.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update_data},
        )