from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import numpy as np


class Step6PhysicsCorrector:
    BODY_JOINTS28 = [
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
    ]

    FACE_JOINTS = {
        "nose",
        "left_eye_inner", "left_eye", "left_eye_outer",
        "right_eye_inner", "right_eye", "right_eye_outer",
        "left_ear", "right_ear", "mouth_left", "mouth_right",
    }

    PHASE_ORDER = [
        "address",
        "toeup",
        "midbackswing",
        "top",
        "middownswing",
        "impact",
        "midfollowthrough",
        "finish",
    ]

    PHYSICS_EXCLUDE_PHASES = {"middownswing", "impact", "midfollowthrough"}
    PHYSICS_MAX_GAP = 15

    def run(
        self,
        postprocessed_json_path: str,
        output_dir: str,
        viewtype: str,
    ) -> dict[str, Any]:
        src_path = Path(postprocessed_json_path)
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        with src_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        frames = deepcopy(data.get("frames", []))
        events = self._normalize_event_keys(data.get("events", {}))
        fps = float(data.get("fps", 30.0))

        corrected_frames, corrected_count = self._physics_correct_frames(
            frames=frames,
            events=events,
            fps=fps,
        )

        output = deepcopy(data)
        output["frames"] = corrected_frames
        output["step"] = "step06physics"
        output["physics"] = {
            "version": "v1",
            "correctedcells": int(corrected_count),
            "excludephases": sorted(self.PHYSICS_EXCLUDE_PHASES),
            "maxgap": self.PHYSICS_MAX_GAP,
        }

        video = data.get("video") or src_path.stem.replace("postprocessed", "")
        physics_json_path = out_dir / f"{video}physics.json"

        with physics_json_path.open("w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        return {
            "physics_json_path": str(physics_json_path),
            "viewtype": viewtype,
            "corrected_cells": int(corrected_count),
            "step": "step06physics",
        }

    def _normalize_event_keys(self, events: dict[str, Any]) -> dict[str, Any]:
        alias = {
            "toe_up": "toeup",
            "mid_backswing": "midbackswing",
            "mid_downswing": "middownswing",
            "mid_follow_through": "midfollowthrough",
        }
        out = {}
        for k, v in (events or {}).items():
            nk = alias.get(k, k.replace("_", "").lower())
            out[nk] = v
        return out

    def _find_landmark(self, frame: dict[str, Any], name: str) -> dict[str, Any] | None:
        for lm in frame.get("landmarks", []):
            if lm.get("name") == name:
                return lm
        return None

    def _get_impact_range(self, events: dict[str, Any], radius: int = 6) -> set[int]:
        impact = events.get("impact")
        if not isinstance(impact, dict):
            return set()
        fi = impact.get("frame")
        if fi is None:
            return set()
        fi = int(fi)
        return set(range(max(0, fi - radius), fi + radius + 1))

    def _get_physics_exclude_frames(
        self,
        frames: list[dict[str, Any]],
        events: dict[str, Any],
    ) -> set[int]:
        exclude = set()
        total = len(frames)

        for phase in self.PHYSICS_EXCLUDE_PHASES:
            ev = events.get(phase)
            if not isinstance(ev, dict) or ev.get("frame") is None:
                continue

            start = int(ev["frame"])
            end = total

            idx = self.PHASE_ORDER.index(phase)
            if idx + 1 < len(self.PHASE_ORDER):
                nxt = events.get(self.PHASE_ORDER[idx + 1])
                if isinstance(nxt, dict) and nxt.get("frame") is not None:
                    end = int(nxt["frame"])

            for fi in range(start, end):
                exclude.add(fi)

        exclude |= self._get_impact_range(events, radius=6)
        return exclude

    def _physics_correct_frames(
        self,
        frames: list[dict[str, Any]],
        events: dict[str, Any],
        fps: float,
    ) -> tuple[list[dict[str, Any]], int]:
        exclude_frames = self._get_physics_exclude_frames(frames, events)
        corrected_count = 0
        axes = ("x", "y", "z")

        for name in self.BODY_JOINTS28:
            if name in self.FACE_JOINTS:
                continue

            for ax in axes:
                arr = np.array(
                    [
                        self._find_landmark(f, name).get(ax, np.nan)
                        if self._find_landmark(f, name) is not None
                        else np.nan
                        for f in frames
                    ],
                    dtype=np.float32,
                )

                valid = np.isfinite(arr)
                if valid.sum() < 4:
                    continue

                vel = np.gradient(arr)
                acc = np.gradient(vel)
                acc_valid = acc[np.isfinite(acc)]
                if len(acc_valid) == 0:
                    continue

                acc_std = float(np.nanstd(acc_valid))
                acc_mean = float(np.nanmean(acc_valid))
                thr = abs(acc_mean) + 4.0 * acc_std

                for i, frame in enumerate(frames):
                    frame_idx = int(frame.get("frame", i))
                    if frame_idx in exclude_frames or not valid[i]:
                        continue
                    if not np.isfinite(acc[i]) or abs(float(acc[i])) <= thr:
                        continue

                    i0 = max(0, i - self.PHYSICS_MAX_GAP)
                    i1 = min(len(arr), i + self.PHYSICS_MAX_GAP + 1)
                    window = [arr[j] for j in range(i0, i1) if j != i and np.isfinite(arr[j])]
                    if not window:
                        continue

                    replacement = float(np.median(window))
                    lm = self._find_landmark(frame, name)
                    if lm is None:
                        continue

                    lm[ax] = replacement
                    flags = set(lm.get("flags", []))
                    flags.add("physicscorrected")
                    lm["flags"] = sorted(flags)
                    corrected_count += 1

        return frames, corrected_count