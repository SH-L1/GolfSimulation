import json
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter1d


class Step5Postprocessor:
    AXES = ["x", "y", "z"]

    FACE_JOINTS = {
        "nose",
        "left_eye_inner",
        "left_eye",
        "left_eye_outer",
        "right_eye_inner",
        "right_eye",
        "right_eye_outer",
        "left_ear",
        "right_ear",
        "mouth_left",
        "mouth_right",
    }

    IMPACT_HIGH_VEL_JOINTS = {
        "left_wrist",
        "right_wrist",
        "left_elbow",
        "right_elbow",
    }

    def __init__(
        self,
        linear_max_gap: int = 8,
        vel_thr_face: float = 0.08,
        vel_thr_body: float = 0.18,
        vel_thr_impact: float = 0.30,
        gaussian_sigma: float = 1.2,
        wrist_z_span_factor: float = 1.5,
        wrist_z_blend_normal: float = 0.5,
        wrist_z_blend_impact: float = 0.3,
    ):
        self.linear_max_gap = linear_max_gap
        self.vel_thr_face = vel_thr_face
        self.vel_thr_body = vel_thr_body
        self.vel_thr_impact = vel_thr_impact
        self.gaussian_sigma = gaussian_sigma
        self.wrist_z_span_factor = wrist_z_span_factor
        self.wrist_z_blend_normal = wrist_z_blend_normal
        self.wrist_z_blend_impact = wrist_z_blend_impact

    def _lm_map(self, frame: dict) -> dict:
        return {lm["name"]: lm for lm in frame.get("landmarks", []) if lm.get("name")}

    def _get_or_create_landmark(self, frame: dict, joint_name: str) -> dict:
        if "landmarks" not in frame:
            frame["landmarks"] = []

        for lm in frame["landmarks"]:
            if lm.get("name") == joint_name:
                return lm

        lm = {
            "name": joint_name,
            "x": None,
            "y": None,
            "z": None,
            "visibility": 0.0,
            "source": "postprocess",
            "source_used": "postprocess",
            "flags": [],
        }
        frame["landmarks"].append(lm)
        return lm

    def _append_flag(self, lm: dict, flag: str):
        flags = list(lm.get("flags", []))
        if flag not in flags:
            flags.append(flag)
        lm["flags"] = flags

    def _get_axis(self, frame: dict, joint_name: str, axis: str) -> float:
        lm = self._lm_map(frame).get(joint_name)
        if lm is None:
            return np.nan
        value = lm.get(axis)
        if value is None:
            return np.nan
        try:
            return float(value)
        except Exception:
            return np.nan

    def _get_impact_range(self, events: dict, radius: int = 6) -> set[int]:
        impact = events.get("impact")
        frame_idx = impact.get("frame") if isinstance(impact, dict) else None
        if frame_idx is None:
            return set()
        return set(range(max(0, int(frame_idx) - radius), int(frame_idx) + radius + 1))

    def _get_vel_thr(self, joint_name: str, in_impact: bool) -> float:
        if joint_name in self.FACE_JOINTS:
            return self.vel_thr_face
        if in_impact and joint_name in self.IMPACT_HIGH_VEL_JOINTS:
            return self.vel_thr_impact
        return self.vel_thr_body

    def _infer_landmark_names(self, frames: list[dict], fallback: list[str] | None = None) -> list[str]:
        if fallback:
            return list(fallback)

        names = set()
        for frame in frames:
            for lm in frame.get("landmarks", []):
                if lm.get("name"):
                    names.add(lm["name"])
        return sorted(names)

    def _fuse_z(self, frames: list[dict], depth_data: dict):
        z_by_frame = {
            int(frame["frame"]): frame.get("zmap", {})
            for frame in depth_data.get("frames", [])
        }

        total_blended = 0
        total_non_raw = 0

        for frame in frames:
            frame_idx = int(frame["frame"])
            zmap = z_by_frame.get(frame_idx, {})

            for lm in frame.get("landmarks", []):
                name = lm.get("name")
                if not name:
                    continue

                zm = zmap.get(name)
                if not zm:
                    lm["source_used"] = lm.get("source", "unknown")
                    continue

                z_value = zm.get("z")
                z_source = zm.get("source", "unknown")
                lm["z_source"] = z_source
                lm["source_used"] = z_source
                lm["blend_ratio"] = float(zm.get("blend_ratio", 0.0))
                lm["fallback_mode"] = zm.get("fallback_mode", "none")

                if z_value is None:
                    lm["z"] = None
                else:
                    lm["z"] = float(z_value)

                total_blended += 1
                if z_source != "mediapipe_fallback":
                    total_non_raw += 1

        non_raw_ratio = round(total_non_raw / max(total_blended, 1), 6)
        return frames, total_blended, total_non_raw, non_raw_ratio

    def _linear_interp(self, frames: list[dict], landmark_names: list[str]):
        filled_count = 0
        total = len(frames)

        for joint_name in landmark_names:
            for axis in self.AXES:
                arr = np.array(
                    [self._get_axis(frame, joint_name, axis) for frame in frames],
                    dtype=float,
                )
                valid = np.isfinite(arr)

                if valid.sum() == 0:
                    continue
                if valid.sum() == 1:
                    filled = np.full(total, arr[valid][0], dtype=float)
                else:
                    filled = arr.copy()
                    missing_idx = np.where(~valid)[0]
                    valid_idx = np.where(valid)[0]

                    for idx in missing_idx:
                        left = valid_idx[valid_idx < idx]
                        right = valid_idx[valid_idx > idx]

                        if len(left) == 0 and len(right) == 0:
                            continue

                        if len(left) == 0:
                            gap = int(right[0] - idx)
                            if gap <= self.linear_max_gap:
                                filled[idx] = arr[right[0]]
                            continue

                        if len(right) == 0:
                            gap = int(idx - left[-1])
                            if gap <= self.linear_max_gap:
                                filled[idx] = arr[left[-1]]
                            continue

                        gap = int(right[0] - left[-1] - 1)
                        if gap <= self.linear_max_gap:
                            filled[idx] = np.interp(
                                idx,
                                [left[-1], right[0]],
                                [arr[left[-1]], arr[right[0]]],
                            )

                for i in range(total):
                    cur = self._get_axis(frames[i], joint_name, axis)
                    if not np.isfinite(cur) and np.isfinite(filled[i]):
                        lm = self._get_or_create_landmark(frames[i], joint_name)
                        lm[axis] = float(filled[i])
                        lm["source_used"] = "postprocess_linear"
                        self._append_flag(lm, "linear_interpolated")
                        filled_count += 1
                        frames[i]["has_pose"] = True

        return frames, filled_count

    def _remove_velocity_outliers(self, frames: list[dict], events: dict, landmark_names: list[str]):
        impact_range = self._get_impact_range(events, radius=5)
        removed_count = 0
        total = len(frames)

        for joint_name in landmark_names:
            for axis in self.AXES:
                arr = np.array(
                    [self._get_axis(frame, joint_name, axis) for frame in frames],
                    dtype=float,
                )
                valid = np.isfinite(arr)
                if valid.sum() < 3:
                    continue

                vel = np.abs(np.diff(arr, prepend=arr[0]))

                for i in range(total):
                    if not valid[i]:
                        continue

                    thr = self._get_vel_thr(joint_name, i in impact_range)
                    if vel[i] <= thr:
                        continue

                    neighbors = [
                        arr[j]
                        for j in range(max(0, i - 3), min(total, i + 4))
                        if j != i and np.isfinite(arr[j])
                    ]
                    if not neighbors:
                        continue

                    new_value = float(np.mean(neighbors))
                    lm = self._get_or_create_landmark(frames[i], joint_name)
                    lm[axis] = new_value
                    lm["source_used"] = "postprocess_velocity"
                    self._append_flag(lm, "vel_outlier_removed")
                    removed_count += 1

        return frames, removed_count

    def _gaussian_smooth(self, frames: list[dict], landmark_names: list[str]):
        changed_count = 0
        total = len(frames)

        for joint_name in landmark_names:
            for axis in self.AXES:
                arr = np.array(
                    [self._get_axis(frame, joint_name, axis) for frame in frames],
                    dtype=float,
                )
                valid = np.isfinite(arr)
                if valid.sum() < 3:
                    continue

                if np.isnan(arr).any():
                    good = np.where(np.isfinite(arr))[0]
                    bad = np.where(~np.isfinite(arr))[0]
                    arr[bad] = np.interp(bad, good, arr[good])

                smoothed = gaussian_filter1d(arr, sigma=self.gaussian_sigma, mode="nearest")

                for i in range(total):
                    lm = self._get_or_create_landmark(frames[i], joint_name)
                    old_value = lm.get(axis)
                    new_value = float(smoothed[i])

                    if old_value is None or abs(float(old_value) - new_value) > 1e-6:
                        lm[axis] = new_value
                        lm["source_used"] = lm.get("source_used", "postprocess_smooth")
                        self._append_flag(lm, "gaussian_smoothed")
                        changed_count += 1

        return frames, changed_count

    def _enforce_wrist_z_symmetry(self, frames: list[dict], events: dict):
        corrected = 0
        impact_range = self._get_impact_range(events, radius=6)

        for frame in frames:
            landmark_map = self._lm_map(frame)
            lw = landmark_map.get("left_wrist")
            rw = landmark_map.get("right_wrist")
            ls = landmark_map.get("left_shoulder")
            rs = landmark_map.get("right_shoulder")

            if not all([lw, rw, ls, rs]):
                continue

            try:
                lwz = float(lw.get("z"))
                rwz = float(rw.get("z"))
                lsx = float(ls.get("x"))
                rsx = float(rs.get("x"))
            except Exception:
                continue

            shoulder_width = abs(lsx - rsx) + 1e-6
            limit = shoulder_width * self.wrist_z_span_factor

            if abs(lwz - rwz) > limit:
                alpha = (
                    self.wrist_z_blend_impact
                    if int(frame["frame"]) in impact_range
                    else self.wrist_z_blend_normal
                )
                target_z = float(np.clip(rwz, lwz - limit, lwz + limit))
                rw["z"] = float((1.0 - alpha) * rwz + alpha * target_z)
                rw["source_used"] = "postprocess_wrist_z"
                self._append_flag(rw, "wrist_z_corrected")
                corrected += 1

        return frames, corrected

    def _round_frames(self, frames: list[dict]):
        for frame in frames:
            for lm in frame.get("landmarks", []):
                for axis in self.AXES:
                    value = lm.get(axis)
                    if value is None:
                        continue
                    try:
                        lm[axis] = round(float(value), 6)
                    except Exception:
                        pass

                try:
                    lm["visibility"] = round(float(lm.get("visibility", 0.0)), 4)
                except Exception:
                    lm["visibility"] = 0.0

    def run(
        self,
        pose_json_path: str,
        events_json_path: str,
        depth_json_path: str,
        output_dir: str,
        viewtype: str,
    ) -> dict:
        pose_json_path = Path(pose_json_path)
        events_json_path = Path(events_json_path)
        depth_json_path = Path(depth_json_path)
        output_dir = Path(output_dir)

        step_dir = output_dir / "step5" / viewtype
        step_dir.mkdir(parents=True, exist_ok=True)

        with open(pose_json_path, "r", encoding="utf-8") as f:
            pose_data = json.load(f)

        with open(events_json_path, "r", encoding="utf-8") as f:
            events_data = json.load(f)

        with open(depth_json_path, "r", encoding="utf-8") as f:
            depth_data = json.load(f)

        frames = pose_data["frames"]
        events = events_data["events"]
        landmark_names = self._infer_landmark_names(
            frames,
            fallback=pose_data.get("landmark_names"),
        )

        frames, total_blended, total_non_raw, non_raw_ratio = self._fuse_z(frames, depth_data)
        frames, n_interp = self._linear_interp(frames, landmark_names)
        frames, n_vel_removed = self._remove_velocity_outliers(frames, events, landmark_names)
        frames, n_smooth = self._gaussian_smooth(frames, landmark_names)
        frames, n_wrist = self._enforce_wrist_z_symmetry(frames, events)

        self._round_frames(frames)

        video_name = pose_data["video"]
        output_path = step_dir / f"{video_name}_postprocessed.json"

        output = {
            "video": video_name,
            "viewtype": viewtype,
            "fps": float(pose_data["fps"]),
            "totalframes": int(pose_data["totalframes"]),
            "eventmodel": events_data.get("eventmodel", "unknown"),
            "events": events,
            "zsource": depth_data.get("zsource", "unknown"),
            "mbstatus": depth_data.get("mbstatus", "unknown"),
            "mbarchok": bool(depth_data.get("mbarchok", False)),
            "landmark_names": landmark_names,
            "fuse_meta": {
                "total_blended": int(total_blended),
                "total_non_raw": int(total_non_raw),
                "non_raw_z_ratio": float(non_raw_ratio),
            },
            "postprocess": {
                "version": "v1",
                "linear_interp": True,
                "linear_interp_filled": int(n_interp),
                "velocity_outliers_removed": int(n_vel_removed),
                "gaussian_smoothed_cells": int(n_smooth),
                "wrist_z_corrected": int(n_wrist),
                "mbusedratio": float(depth_data.get("mbusedratio", 0.0)),
                "mbfallbackratio": float(depth_data.get("mbfallbackratio", 0.0)),
            },
            "frames": frames,
            "step": "step5_postprocessed_v1",
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        return {
            "video_name": video_name,
            "viewtype": viewtype,
            "postprocessed_json_path": str(output_path),
            "eventmodel": output["eventmodel"],
        }