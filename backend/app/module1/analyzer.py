from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.module1.referenceloader import ReferenceLoader
from app.module1.runner import Module1PipelineRunner
from app.module1.scorer import SwingScorer
from app.module1.loader import load_swing_json
from app.module1.metrics import compute_all_metrics


class Module1Analyzer:
    def __init__(self) -> None:
        self.runner: Module1PipelineRunner | None = None
        self.reference_loader = ReferenceLoader()
        self.scorer = SwingScorer()

    def _get_runner(self) -> Module1PipelineRunner:
        if self.runner is None:
            self.runner = Module1PipelineRunner()
        return self.runner

    def run(self, video_path: str, viewtype: str, clubtype: str) -> dict[str, Any]:
        pipeline_output = self._get_runner().run(
            video_path=video_path,
            viewtype=viewtype,
            clubtype=clubtype,
        )

        artifacts = pipeline_output.get("artifacts", {})
        pose_json_path = artifacts.get("pose_json_path")
        events_json_path = artifacts.get("events_json_path")
        final_json_path = pipeline_output.get("final_json_path")

        poses_payload = self._load_json(pose_json_path)
        events_payload = self._load_json(events_json_path)
        final_payload = self._load_json(final_json_path)

        p1_raw_metrics: dict[str, float] = {}
        try:
            if final_json_path:
                swing = load_swing_json(final_json_path)
                p1_raw_metrics = compute_all_metrics(swing) or {}
                print("[DEBUG] P1 metrics:", p1_raw_metrics)
        except Exception as e:
            print(f"[Module1Analyzer] P1 metric compute failed: {e}")
            p1_raw_metrics = {}

        events = self._normalize_events(
            final_payload.get("events") or events_payload.get("events") or {}
        )
        poses = self._build_pose_frames(final_payload, poses_payload, events)

        reference = self.reference_loader.load(
            viewtype=viewtype,
            clubtype=clubtype,
        )
        score_result = self.scorer.score(
            poses=poses,
            events=self._events_to_list(events),
            reference=reference,
            raw_metrics=p1_raw_metrics,
        )

        result = self._build_result_document(
            score_result=score_result,
            events=events,
            final_payload=final_payload,
            reference=reference,
            pipeline_output=pipeline_output,
            viewtype=viewtype,
            p1_raw_metrics=p1_raw_metrics,
        )

        return {
            "poses": poses,
            "events": events,
            "result": result,
            "pipeline": pipeline_output,
        }

    def _load_json(self, path: str | None) -> dict[str, Any]:
        if not path:
            return {}
        p = Path(path)
        if not p.exists():
            return {}
        with p.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _build_pose_frames(
        self,
        final_payload: dict[str, Any],
        pose_payload: dict[str, Any],
        events: dict[str, int],
    ) -> list[dict[str, Any]]:
        final_frames = final_payload.get("frames", [])
        if not final_frames:
            return []

        original_pose_frames = {
            int(frame.get("frame", -1)): frame
            for frame in pose_payload.get("frames", [])
            if frame.get("frame") is not None
        }

        poses: list[dict[str, Any]] = []
        for idx, frame in enumerate(final_frames):
            frameorig = int(frame.get("frameorig", idx))
            raw_pose_frame = original_pose_frames.get(frameorig, {})

            poses.append(
                {
                    "frameidx": int(frame.get("frame", idx)),
                    "frameorig": frameorig,
                    "timestampms": int(round(float(frame.get("timestamp", 0.0)) * 1000)),
                    "phase": self._frame_to_phase(frameorig, events),
                    "haspose": bool(
                        frame.get("haspose", raw_pose_frame.get("has_pose", True))
                    ),
                    "landmarks": frame.get("landmarks", []),
                }
            )

        return poses

    def _normalize_events(self, events: dict[str, Any]) -> dict[str, int]:
        alias = {
            "toe_up": "toeup",
            "mid_backswing": "midbackswing",
            "mid_downswing": "middownswing",
            "mid_follow_through": "midfollowthrough",
        }

        normalized: dict[str, int] = {}
        for key, value in (events or {}).items():
            raw_key = str(key).strip().lower()
            norm_key = alias.get(raw_key, raw_key.replace("_", ""))

            if isinstance(value, dict):
                frame = value.get("frame")
                if frame is None:
                    frame = value.get("frameidx")
                if frame is None:
                    frame = value.get("frame_index")
            else:
                frame = value

            if frame is None:
                continue

            try:
                normalized[norm_key] = int(frame)
            except (TypeError, ValueError):
                continue

        return normalized

    def _events_to_list(self, events: dict[str, int]) -> list[dict[str, Any]]:
        return [{"name": key, "frame": value} for key, value in events.items()]

    def _frame_to_phase(self, frameidx: int, events: dict[str, int]) -> str | None:
        if not events:
            return None

        ordered = sorted(events.items(), key=lambda x: x[1])
        current_phase = None
        for phase, event_frame in ordered:
            if frameidx >= event_frame:
                current_phase = phase
            else:
                break
        return current_phase

    def _normalize_metric_map(
        self,
        metrics: list[dict[str, Any]] | dict[str, Any],
    ) -> dict[str, float]:
        if isinstance(metrics, dict):
            out: dict[str, float] = {}
            for key, value in metrics.items():
                if isinstance(value, dict):
                    metric_value = value.get("value")
                    if metric_value is None:
                        metric_value = value.get("raw_value")
                    if metric_value is None:
                        metric_value = value.get("score")
                else:
                    metric_value = value

                try:
                    out[str(key)] = float(metric_value)
                except (TypeError, ValueError):
                    continue
            return out

        out: dict[str, float] = {}
        for item in metrics or []:
            if not isinstance(item, dict):
                continue

            key = item.get("metricid") or item.get("metric_id") or item.get("name")
            metric_value = item.get("uservalue")
            if metric_value is None:
                metric_value = item.get("value")
            if metric_value is None:
                metric_value = item.get("raw_value")
            if metric_value is None:
                metric_value = item.get("score")

            if key is None or metric_value is None:
                continue

            try:
                out[str(key)] = float(metric_value)
            except (TypeError, ValueError):
                continue

        return out

    def _build_result_document(
        self,
        score_result: dict[str, Any],
        events: dict[str, int],
        final_payload: dict[str, Any],
        reference: dict[str, Any],
        pipeline_output: dict[str, Any],
        viewtype: str,
        p1_raw_metrics: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        metrics_map = self._normalize_metric_map(score_result.get("metrics") or {})
        scores_raw = score_result.get("scores") or {}

        prioritycoaching = []
        for item in (score_result.get("prioritycoaching") or []):
            if not isinstance(item, dict):
                continue

            metricid = item.get("metricid") or item.get("metric_id")
            score = item.get("score")
            phase = item.get("phase")

            if metricid is None or score is None or phase is None:
                continue

            try:
                prioritycoaching.append(
                    {
                        "metricid": str(metricid),
                        "metric_id": str(metricid),
                        "score": float(score),
                        "phase": str(phase),
                    }
                )
            except (TypeError, ValueError):
                continue

        return {
            "referenceversion": reference.get("referenceversion", "v1"),
            "video_id": final_payload.get("video"),
            "view_type": final_payload.get("viewtype", viewtype),
            "events": events,
            "metrics": score_result.get("metrics", {}),
            "scores": score_result.get("scores", {}),
            "prioritycoaching": score_result.get("prioritycoaching", []),
            "priority_coaching": score_result.get("prioritycoaching", []),
            "summary": score_result.get("summary"),
            "final_json_path": pipeline_output.get("final_json_path"),
            "session_dir": pipeline_output.get("session_dir"),
            "fps": final_payload.get("fps"),
            "totalframes": final_payload.get("totalframes"),
            "p1_raw_metrics": dict(p1_raw_metrics or {}),
        }