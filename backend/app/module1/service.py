from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from bson import ObjectId
from fastapi import HTTPException, UploadFile

from app.module1.schemas import AnalysisResultResponse, SessionListResponse
from app.repositories.analysis_repository import AnalysisRepository
from app.repositories.session_repository import SessionRepository
from app.storage.temp_file_store import TempFileStore
from app.workers.analysis_task import run_analysis


class Module1Service:
    def __init__(self):
        self.file_store = TempFileStore()
        self.session_repository = SessionRepository()
        self.analysis_repository = AnalysisRepository()

    async def enqueue_analysis(
        self,
        video: UploadFile,
        viewtype: str,
        clubtype: str,
        trimstart: float,
        trimend: float | None,
        userid: str = "dev-user",
    ) -> dict[str, str]:
        self._validate_upload(video, trimstart, trimend)

        now = datetime.now(timezone.utc)
        saved_path = await self.file_store.save_upload(video)

        session_id = ObjectId()
        job_id = str(uuid4())

        session_doc = {
            "_id": session_id,
            "jobid": job_id,
            "userid": userid,
            "viewtype": viewtype,
            "clubtype": clubtype,
            "status": "queued",
            "inputfilename": video.filename,
            "storedfilepath": saved_path,
            "trimstart": trimstart,
            "trimend": trimend,
            "durationsec": None,
            "fps": None,
            "analysisresultid": None,
            "createdat": now,
            "updatedat": now,
        }

        await self.session_repository.create_session(session_doc)
        run_analysis.delay(str(session_id), saved_path, viewtype, clubtype, userid)

        return {"jobid": job_id, "status": "queued"}

    async def get_status(self, job_id: str) -> dict[str, Any]:
        session = await self.session_repository.get_by_job_id(job_id)
        if not session:
            raise HTTPException(status_code=404, detail="Analysis job not found.")

        response = {
            "status": session["status"],
            "sessionid": str(session["_id"]) if session["status"] == "done" else None,
            "message": session.get("errormessage"),
        }

        if session["status"] == "error":
            response["sessionid"] = str(session["_id"])

        return response

    async def get_result(self, session_id: str) -> AnalysisResultResponse:
        session_oid = self._to_object_id(session_id)

        session = await self.session_repository.get_by_id(str(session_oid))
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")

        result = None
        if session.get("analysisresultid"):
            result = await self.analysis_repository.get_by_id(session["analysisresultid"])
        elif session["status"] == "done":
            result = await self.analysis_repository.get_by_session_id(str(session_oid))

        result = result or {}

        scores = self._normalize_scores(result.get("scores") or {})
        events = self._normalize_events(
            result.get("events") or session.get("swingevents") or {}
        )
        metrics = self._normalize_metrics(result.get("metrics") or {})
        priority_coaching = self._normalize_priority_coaching(
            result.get("priority_coaching")
            or result.get("prioritycoaching")
            or []
        )
        p1_raw_metrics = self._normalize_float_map(result.get("p1_raw_metrics") or {})

        return AnalysisResultResponse(
            sessionid=str(session["_id"]),
            status=session["status"],
            viewtype=session["viewtype"],
            clubtype=session["clubtype"],
            inputfilename=session.get("inputfilename"),
            analyzedat=result.get("createdat"),
            events=events,
            metrics=metrics,
            scores=scores,
            priority_coaching=priority_coaching,
            charturl=result.get("charturl"),
            message=session.get("errormessage"),
            p1_raw_metrics=p1_raw_metrics,
        )

    async def list_sessions(
        self,
        userid: str = "dev-user",
        page: int = 1,
        limit: int = 20,
    ) -> SessionListResponse:
        skip = (page - 1) * limit
        sessions = await self.session_repository.list_by_user(userid, skip, limit)
        total = await self.session_repository.count_by_user(userid)

        items = [
            {
                "sessionid": str(s["_id"]),
                "status": s["status"],
                "viewtype": s["viewtype"],
                "clubtype": s["clubtype"],
                "inputfilename": s.get("inputfilename"),
                "analyzedat": s.get("updatedat"),
                "createdat": s["createdat"],
            }
            for s in sessions
        ]

        return SessionListResponse(
            sessions=items,
            total=total,
            page=page,
            limit=limit,
        )

    def _normalize_scores(self, value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            return {"metrics": {}, "phases": {}, "overall": None}

        metrics = self._normalize_float_map(value.get("metrics") or {})
        phases = self._normalize_float_map(value.get("phases") or {})

        overall = value.get("overall")
        try:
            overall = float(overall) if overall is not None else None
        except (TypeError, ValueError):
            overall = None

        return {
            "metrics": metrics,
            "phases": phases,
            "overall": overall,
        }

    def _normalize_priority_coaching(self, value: Any) -> list[dict[str, Any]]:
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

    def _normalize_float_map(self, value: Any) -> dict[str, float]:
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

    def _normalize_events(self, value: Any) -> dict[str, int]:
        if isinstance(value, dict):
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

        if isinstance(value, list):
            normalized = {}
            for item in value:
                if not isinstance(item, dict):
                    continue

                key = (
                    item.get("event")
                    or item.get("eventlabel")
                    or item.get("label")
                    or item.get("name")
                )
                frame = (
                    item.get("frame")
                    if item.get("frame") is not None
                    else item.get("frameidx")
                    if item.get("frameidx") is not None
                    else item.get("frame_index")
                )

                if key is None or frame is None:
                    continue

                try:
                    normalized[str(key).lower()] = int(frame)
                except (TypeError, ValueError):
                    continue
            return normalized

        return {}

    def _normalize_metrics(self, value: Any) -> dict[str, float]:
        if isinstance(value, dict):
            normalized = {}
            for key, raw in value.items():
                if isinstance(raw, dict):
                    metric_value = raw.get("value")
                    if metric_value is None:
                        metric_value = raw.get("raw_value")
                    if metric_value is None:
                        metric_value = raw.get("score")
                else:
                    metric_value = raw

                if metric_value is None:
                    continue

                try:
                    normalized[str(key)] = float(metric_value)
                except (TypeError, ValueError):
                    continue
            return normalized

        if isinstance(value, list):
            normalized = {}
            for item in value:
                if not isinstance(item, dict):
                    continue

                key = (
                    item.get("metric_id")
                    or item.get("metricid")
                    or item.get("name")
                )
                metric_value = item.get("value")
                if metric_value is None:
                    metric_value = item.get("raw_value")
                if metric_value is None:
                    metric_value = item.get("score")

                if key is None or metric_value is None:
                    continue

                try:
                    normalized[str(key)] = float(metric_value)
                except (TypeError, ValueError):
                    continue
            return normalized

        return {}

    def _validate_upload(
        self,
        video: UploadFile,
        trimstart: float,
        trimend: float | None,
    ) -> None:
        filename = video.filename or ""
        suffix = Path(filename).suffix.lower()

        if suffix not in {".mp4", ".mov", ".avi"}:
            raise HTTPException(
                status_code=400,
                detail="Only mp4/mov/avi uploads are allowed.",
            )

        if trimstart < 0:
            raise HTTPException(status_code=400, detail="trimstart must be >= 0.")

        if trimend is not None and trimend <= trimstart:
            raise HTTPException(
                status_code=400,
                detail="trimend must be greater than trimstart.",
            )

    def _to_object_id(self, value: str) -> ObjectId:
        if not ObjectId.is_valid(value):
            raise HTTPException(status_code=400, detail="Invalid session id.")
        return ObjectId(value)