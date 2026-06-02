from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class Step7CleanSwingExporter:
    LANDMARK_SET = {
        "nose",
        "left_eye_inner", "left_eye", "left_eye_outer",
        "right_eye_inner", "right_eye", "right_eye_outer",
        "left_ear", "right_ear", "mouth_left", "mouth_right",
        "left_shoulder", "right_shoulder",
        "left_elbow", "right_elbow",
        "left_wrist", "right_wrist",
        "left_hip", "right_hip",
        "left_knee", "right_knee",
        "left_ankle", "right_ankle",
        "left_heel", "right_heel",
        "left_foot_index", "right_foot_index",
        "hipcenter",
    }

    UNITY_FLIP_Y = True
    UNITY_FLIP_Z = True

    def run(
        self,
        physics_json_path: str,
        output_dir: str,
        viewtype: str,
    ) -> dict[str, Any]:
        src_path = Path(physics_json_path)
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        with src_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        clean = self._build_clean_swing_data(data=data, view=viewtype)

        video = data.get("video") or src_path.stem.replace("physics", "")
        cleanswing_json_path = out_dir / f"{video}cleanswing.json"

        with cleanswing_json_path.open("w", encoding="utf-8") as f:
            json.dump(clean, f, indent=2, ensure_ascii=False)

        return {
            "cleanswing_json_path": str(cleanswing_json_path),
            "viewtype": viewtype,
            "totalframes": int(clean.get("totalframes", 0)),
            "step": "step07cleanswing",
        }

    def _normalize_event_keys(self, events: dict[str, Any]) -> dict[str, Any]:
        # 분석 단계(metrics.py)는 snake_case 이벤트명을 기대하므로
        # 여기서는 이벤트 키를 바꾸지 않고 원본을 그대로 유지한다.
        return dict(events or {})

    def _event_frame_value(self, event_value: Any, default: int) -> int:
        if isinstance(event_value, dict):
            for key in ("frame", "frameidx", "frame_index"):
                if key in event_value and event_value[key] is not None:
                    return int(event_value[key])
            return int(default)

        if event_value is None:
            return int(default)

        return int(event_value)

    def _ratio_based_finish_keep(self, total_frames: int) -> int:
        if total_frames <= 0:
            return 0
        return max(8, int(round(total_frames * 0.12)))

    def _lm_masks_from_source_flags(self, lm: dict[str, Any]) -> tuple[int, int, int]:
        flags = set(lm.get("flags", []))
        source = lm.get("sourceused") or lm.get("zsource") or lm.get("source") or "unknown"

        observed = int(
            source in {"mediapipetasksraw", "mediapipetasks", "mediapipefallback"}
            and "linearinterp" not in flags
            and "mcfilled" not in flags
        )

        predicted = int(
            "kalmanpredicted" in flags
            or "mcfilled" in flags
            or "fallback" in str(lm.get("fallbackmode", ""))
            or source in {"motionbertrel", "relzsmoothfallback"}
        )

        corrected = int(
            any(
                x in flags
                for x in {
                    "bonecorrected",
                    "elbowspancorrected",
                    "wristzleadcorrected",
                    "physicscorrected",
                    "veloutlierremoved",
                    "zpriorblended",
                    "linearinterp",
                    "mcfilled",
                    "shoulderclamped",
                }
            )
        )
        return observed, predicted, corrected

    def _build_clean_swing_data(self, data: dict[str, Any], view: str) -> dict[str, Any]:
        events = self._normalize_event_keys(data.get("events", {}))
        fps = float(data.get("fps", 30.0))
        frames = data.get("frames", [])

        addr_fi = self._event_frame_value(events.get("address"), 0)
        fin_fi = self._event_frame_value(events.get("finish"), max(len(frames) - 1, 0))

        keep_after = self._ratio_based_finish_keep(len(frames))
        cut_fi = min(len(frames) - 1, fin_fi + keep_after) if frames else -1

        swing_frames = [f for f in frames if addr_fi <= int(f.get("frame", -1)) <= cut_fi]

        clean_frames = []
        for new_idx, frame in enumerate(swing_frames):
            lms_clean = []
            observed_cnt = 0
            predicted_cnt = 0
            corrected_cnt = 0

            for lm in frame.get("landmarks", []):
                name = lm.get("name")
                if name not in self.LANDMARK_SET:
                    continue

                x = float(lm.get("x", 0.0))
                y = float(lm.get("y", 0.0))
                z = float(lm.get("z", 0.0))

                if self.UNITY_FLIP_Y:
                    y = -y
                if self.UNITY_FLIP_Z:
                    z = -z

                observed, predicted, corrected = self._lm_masks_from_source_flags(lm)
                observed_cnt += observed
                predicted_cnt += predicted
                corrected_cnt += corrected

                lms_clean.append(
                    {
                        "name": name,
                        "x": round(x, 6),
                        "y": round(y, 6),
                        "z": round(z, 6),
                        "visibility": round(float(lm.get("visibility", 0.0)), 4),
                        "source": lm.get("sourceused", lm.get("source", "unknown")),
                        "flags": lm.get("flags", []),
                        "observedmask": observed,
                        "predictedmask": predicted,
                        "correctedmask": corrected,
                    }
                )

            clean_frames.append(
                {
                    "frame": new_idx,
                    "frameorig": int(frame.get("frame", new_idx)),
                    "timestamp": round(new_idx / fps, 4) if fps > 0 else 0.0,
                    "haspose": bool(frame.get("haspose", frame.get("has_pose", False))),
                    "observedcount": observed_cnt,
                    "predictedcount": predicted_cnt,
                    "correctedcount": corrected_cnt,
                    "landmarks": lms_clean,
                }
            )

        return {
            "video": data.get("video"),
            "viewtype": view,
            "fps": fps,
            "totalframes": len(clean_frames),
            "eventmodel": data.get("eventmodel", "unknown"),
            "events": events,
            "zsource": data.get("zsource", "unknown"),
            "mbstatus": data.get("mbstatus", "unknown"),
            "mbarchok": data.get("mbarchok", False),
            "postprocess": data.get("postprocess", {}),
            "landmarknames": sorted(self.LANDMARK_SET),
            "frames": clean_frames,
            "step": "step07cleanswing",
        }