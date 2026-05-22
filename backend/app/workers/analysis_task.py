from datetime import datetime, timezone

from bson import ObjectId
from pymongo import MongoClient

from app.core.celery_app import celery_app
from app.core.config import settings
from app.module1.analyzer import Module1Analyzer


def _sync_db():
    client = MongoClient(settings.mongodb_uri)
    return client, client[settings.mongodb_db]


def _normalize_float_map(value):
    if not isinstance(value, dict):
        return {}

    normalized = {}
    for key, raw in value.items():
        try:
            if raw is not None:
                normalized[str(key)] = float(raw)
        except (TypeError, ValueError):
            continue
    return normalized


def _normalize_event_map(value):
    if not isinstance(value, dict):
        return {}

    normalized = {}
    for key, raw in value.items():
        if isinstance(raw, dict):
            frame = (
                raw.get("frame")
                if raw.get("frame") is not None
                else raw.get("frameidx")
                if raw.get("frameidx") is not None
                else raw.get("frame_index")
            )
        else:
            frame = raw

        if frame is None:
            continue

        try:
            normalized[str(key).lower()] = int(frame)
        except (TypeError, ValueError):
            continue
    return normalized


def _normalize_priority_coaching(value):
    if not isinstance(value, list):
        return []

    normalized = []
    for item in value:
        if not isinstance(item, dict):
            continue

        metric_id = item.get("metric_id") or item.get("metricid")
        phase = item.get("phase")
        score = item.get("score")

        if metric_id is None or phase is None or score is None:
            continue

        try:
            normalized.append(
                {
                    "metric_id": str(metric_id),
                    "score": float(score),
                    "phase": str(phase),
                }
            )
        except (TypeError, ValueError):
            continue

    return normalized


@celery_app.task(name="app.workers.analysis_task.run_analysis")
def run_analysis(
    session_id: str,
    video_path: str,
    viewtype: str,
    clubtype: str,
    userid: str = "dev-user",
):
    client, db = _sync_db()
    session_oid = ObjectId(session_id)
    now = datetime.now(timezone.utc)

    db.swingsessions.update_one(
        {"_id": session_oid},
        {"$set": {"status": "processing", "updatedat": now}},
    )

    try:
        analyzer = Module1Analyzer()
        analysis_output = analyzer.run(video_path, viewtype, clubtype)

        pose_frames = analysis_output.get("poses", []) or []
        events = _normalize_event_map(analysis_output.get("events", {}) or {})
        result = analysis_output.get("result", {}) or {}

        scores_raw = result.get("scores") or {}
        scores = {
            "metrics": _normalize_float_map(scores_raw.get("metrics") or {}),
            "phases": _normalize_float_map(scores_raw.get("phases") or {}),
            "overall": None,
        }

        overall_score = scores_raw.get("overall")
        try:
            scores["overall"] = float(overall_score) if overall_score is not None else None
        except (TypeError, ValueError):
            scores["overall"] = None

        metrics = _normalize_metrics_payload(result.get("metrics") or {})
        priority_coaching = _normalize_priority_coaching(
            result.get("priority_coaching")
            or result.get("prioritycoaching")
            or []
        )
        p1_raw_metrics = _normalize_float_map(result.get("p1_raw_metrics") or {})

        analysis_doc = {
            "sessionid": session_oid,
            "userid": userid,
            "referenceversion": result.get("referenceversion", "v1"),
            "overallscore": scores["overall"],
            "phasescores": scores["phases"],
            "metrics": metrics,
            "scores": scores,
            "events": events,
            "priority_coaching": priority_coaching,
            "prioritycoaching": priority_coaching,
            "p1_raw_metrics": p1_raw_metrics,
            "summary": result.get("summary"),
            "charturl": result.get("charturl"),
            "final_json_path": result.get("final_json_path"),
            "session_dir": result.get("session_dir"),
            "fps": result.get("fps"),
            "totalframes": result.get("totalframes"),
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
                    "fps": result.get("fps"),
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


def _normalize_metrics_payload(value):
    if isinstance(value, dict):
        normalized = {}
        for key, raw in value.items():
            if isinstance(raw, dict):
                normalized[str(key)] = raw
            else:
                try:
                    normalized[str(key)] = float(raw)
                except (TypeError, ValueError):
                    normalized[str(key)] = raw
        return normalized

    if isinstance(value, list):
        normalized = {}
        for item in value:
            if not isinstance(item, dict):
                continue
            key = item.get("metric_id") or item.get("metricid") or item.get("name")
            if key is None:
                continue
            normalized[str(key)] = item
        return normalized

    return {}