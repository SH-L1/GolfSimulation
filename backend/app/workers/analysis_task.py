from datetime import datetime, timezone

from bson import ObjectId
from pymongo import MongoClient

from app.core.celery_app import celery_app
from app.core.config import settings
from app.module1.analyzer import Module1Analyzer

analyzer = Module1Analyzer()


def _sync_db():
    client = MongoClient(settings.mongodb_uri)
    return client, client[settings.mongodb_db]


@celery_app.task(name="app.workers.analysis_task.run_analysis")
def run_analysis(session_id: str, video_path: str, viewtype: str, clubtype: str):
    client, db = _sync_db()
    session_oid = ObjectId(session_id)
    now = datetime.now(timezone.utc)

    db.swingsessions.update_one(
        {"_id": session_oid},
        {"$set": {"status": "processing", "updatedat": now}},
    )

    try:
        analysis_output = analyzer.run(video_path, viewtype, clubtype)
        pose_frames = analysis_output.get("poses", [])
        events = analysis_output.get("events", [])
        result = analysis_output.get("result", {})

        analysis_doc = {
            "sessionid": session_oid,
            "userid": "dev-user",
            "referenceversion": result.get("referenceversion", "v1"),
            "overallscore": result.get("overallscore", 0),
            "phasescores": result.get("phasescores", {}),
            "metrics": result.get("metrics", []),
            "recommendations": result.get("recommendations", []),
            "summary": result.get("summary"),
            "createdat": now,
        }

        inserted = db.analysisresults.insert_one(analysis_doc)

        if pose_frames:
            pose_docs = [
                {
                    "sessionid": session_oid,
                    "frameidx": frame.get("frameidx", idx),
                    "timestampms": frame.get("timestampms"),
                    "phase": frame.get("phase"),
                    "landmarks": frame.get("landmarks", []),
                    "createdat": now,
                }
                for idx, frame in enumerate(pose_frames)
            ]
            db.poseframes.insert_many(pose_docs)

        db.swingsessions.update_one(
            {"_id": session_oid},
            {
                "$set": {
                    "status": "done",
                    "analysisresultid": inserted.inserted_id,
                    "swingevents": events,
                    "updatedat": now,
                }
            },
        )

        return {"sessionid": session_id, "status": "done"}

    except Exception as e:
        db.swingsessions.update_one(
            {"_id": session_oid},
            {
                "$set": {
                    "status": "error",
                    "errormessage": str(e),
                    "updatedat": now,
                }
            },
        )
        raise

    finally:
        client.close()