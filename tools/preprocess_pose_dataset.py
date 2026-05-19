#!/usr/bin/env python3
"""
Preprocess golf pose JSON sequences for Unity avatar retargeting.

This tool is intentionally conservative:
- it never overwrites source files;
- it normalizes event frame indices;
- it repairs short per-joint outlier gaps;
- it applies centered temporal smoothing;
- it enforces approximate per-subject bone-length consistency;
- it limits severe two-hand separation outliers;
- it projects impossible phase-specific body/arm/head states back into a usable range.
"""

from __future__ import annotations

import argparse
import json
import math
import os
from copy import deepcopy
from pathlib import Path
from statistics import median


VERSION = "unity_avatar_preprocess_v2"

ALIASES = {
    "lefteye": "left_eye",
    "righteye": "right_eye",
    "leftear": "left_ear",
    "rightear": "right_ear",
    "leftshoulder": "left_shoulder",
    "rightshoulder": "right_shoulder",
    "leftelbow": "left_elbow",
    "rightelbow": "right_elbow",
    "leftwrist": "left_wrist",
    "rightwrist": "right_wrist",
    "lefthip": "left_hip",
    "righthip": "right_hip",
    "leftknee": "left_knee",
    "rightknee": "right_knee",
    "leftankle": "left_ankle",
    "rightankle": "right_ankle",
    "leftheel": "left_heel",
    "rightheel": "right_heel",
    "leftfootindex": "left_foot_index",
    "rightfootindex": "right_foot_index",
    "hipcenter": "hip_center",
    "lefteyeinner": "left_eye_inner",
    "lefteyeouter": "left_eye_outer",
    "righteyeinner": "right_eye_inner",
    "righteyeouter": "right_eye_outer",
    "mouthleft": "mouth_left",
    "mouthright": "mouth_right",
}

CORE_JOINTS = [
    "nose",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
]

BONES = [
    ("shoulder_width", "left_shoulder", "right_shoulder"),
    ("hip_width", "left_hip", "right_hip"),
    ("left_upper_arm", "left_shoulder", "left_elbow"),
    ("left_lower_arm", "left_elbow", "left_wrist"),
    ("right_upper_arm", "right_shoulder", "right_elbow"),
    ("right_lower_arm", "right_elbow", "right_wrist"),
    ("left_upper_leg", "left_hip", "left_knee"),
    ("left_lower_leg", "left_knee", "left_ankle"),
    ("right_upper_leg", "right_hip", "right_knee"),
    ("right_lower_leg", "right_knee", "right_ankle"),
]

EVENT_ORDER = [
    "address",
    "toe_up",
    "mid_backswing",
    "top",
    "mid_downswing",
    "impact",
    "mid_follow_through",
    "finish",
]

EVENT_ALIASES = {
    "mid_followthrough": "mid_follow_through",
}


def canonical_name(name: str) -> str:
    compact = (name or "").strip().lower().replace("_", "")
    return ALIASES.get(compact, (name or "").strip())


def v_sub(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def v_add(a, b):
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]


def v_mul(a, s: float):
    return [a[0] * s, a[1] * s, a[2] * s]


def v_dot(a, b) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def v_cross(a, b):
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]


def v_lerp(a, b, t: float):
    return v_add(v_mul(a, 1.0 - t), v_mul(b, t))


def v_len(a) -> float:
    return math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])


def v_dist(a, b) -> float:
    return v_len(v_sub(a, b))


def v_norm(a, fallback=None):
    length = v_len(a)
    if length > 1e-9:
        return v_mul(a, 1.0 / length)
    return list(fallback or [0.0, 0.0, 0.0])


def v_angle_deg(a, b) -> float:
    la = v_len(a)
    lb = v_len(b)
    if la <= 1e-9 or lb <= 1e-9:
        return 0.0
    c = max(-1.0, min(1.0, v_dot(a, b) / (la * lb)))
    return math.degrees(math.acos(c))


def clamp_direction_from_reference(reference, candidate, max_angle_deg: float):
    ref = v_norm(reference, fallback=[0.0, 0.0, 1.0])
    cur = v_norm(candidate, fallback=ref)
    angle = v_angle_deg(ref, cur)
    if angle <= max_angle_deg or angle <= 1e-6:
        return cur
    return v_norm(v_lerp(ref, cur, max_angle_deg / angle), fallback=ref)


def percentile(values, q: float):
    if not values:
        return None
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, int((len(ordered) - 1) * q)))
    return ordered[idx]


def mean(values):
    return sum(values) / len(values) if values else None


def stat(values):
    if not values:
        return {"n": 0}
    return {
        "n": len(values),
        "mean": round(mean(values), 6),
        "min": round(min(values), 6),
        "p50": round(percentile(values, 0.50), 6),
        "p90": round(percentile(values, 0.90), 6),
        "p95": round(percentile(values, 0.95), 6),
        "max": round(max(values), 6),
    }


def frame_maps(sequence):
    maps = []
    for frame in sequence.get("frames", []):
        lm_map = {}
        for landmark in frame.get("landmarks", []):
            landmark["name"] = canonical_name(landmark.get("name", ""))
            lm_map[landmark["name"]] = landmark
        maps.append(lm_map)
    return maps


def get_pos(lm_map, name):
    landmark = lm_map.get(name)
    if not landmark:
        return None
    return [float(landmark.get("x", 0.0)), float(landmark.get("y", 0.0)), float(landmark.get("z", 0.0))]


def set_pos(lm_map, name, pos, source_suffix=None):
    landmark = lm_map.get(name)
    if not landmark:
        return
    landmark["x"], landmark["y"], landmark["z"] = pos
    if source_suffix:
        source = landmark.get("source") or "unknown"
        if source_suffix not in source:
            landmark["source"] = f"{source}+{source_suffix}"


def normalize_metadata(sequence):
    if "view_type" not in sequence and "viewtype" in sequence:
        sequence["view_type"] = sequence["viewtype"]
    if "total_frames" not in sequence and "totalframes" in sequence:
        sequence["total_frames"] = sequence["totalframes"]
    if "keypoint_names" not in sequence and "landmarknames" in sequence:
        sequence["keypoint_names"] = [canonical_name(name) for name in sequence["landmarknames"]]
    if "landmarknames" in sequence:
        sequence["landmarknames"] = [canonical_name(name) for name in sequence["landmarknames"]]


def normalize_events(sequence):
    frames = sequence.get("frames", [])
    events = sequence.get("events") or {}
    if not frames or not events:
        return {"normalized": 0, "clamped": 0}

    for old, new in EVENT_ALIASES.items():
        if old in events and new not in events:
            events[new] = events[old]

    origs = [frame.get("frame_orig", -1) for frame in frames if frame.get("frame_orig", -1) >= 0]
    has_orig = bool(origs)
    min_orig = min(origs) if has_orig else None
    max_orig = max(origs) if has_orig else None

    normalized = 0
    clamped = 0

    def nearest_orig_index(source_frame):
        best_i = 0
        best_d = float("inf")
        for i, frame in enumerate(frames):
            orig = frame.get("frame_orig", -1)
            if orig < 0:
                continue
            distance = abs(orig - source_frame)
            if distance < best_d:
                best_i = i
                best_d = distance
        return best_i

    def nearest_time_index(timestamp):
        best_i = None
        best_d = float("inf")
        for i, frame in enumerate(frames):
            time = frame.get("timestamp")
            if time is None:
                continue
            distance = abs(float(time) - float(timestamp))
            if distance < best_d:
                best_i = i
                best_d = distance
        return best_i

    for name, event in list(events.items()):
        if not isinstance(event, dict):
            continue
        raw_frame = int(event.get("frame", -1))
        source_frame = int(event.get("original_frame", raw_frame))
        event.setdefault("original_frame", source_frame)

        if has_orig and min_orig <= source_frame <= max_orig:
            mapped = nearest_orig_index(source_frame)
            if mapped != raw_frame:
                normalized += 1
            event["frame"] = mapped
            continue

        if not has_orig and 0 <= raw_frame < len(frames):
            continue

        timestamp = event.get("timestamp")
        mapped = nearest_time_index(timestamp) if timestamp is not None else None
        if mapped is not None:
            event["frame"] = mapped
            normalized += 1
            continue

        event["frame"] = max(0, min(raw_frame, len(frames) - 1))
        clamped += 1

    last = -1
    for name in EVENT_ORDER:
        event = events.get(name)
        if not isinstance(event, dict):
            continue
        if event["frame"] < last:
            event["frame"] = last
            clamped += 1
        last = event["frame"]

    sequence["events"] = events
    return {"normalized": normalized, "clamped": clamped}


def trim_after_finish(sequence, tail_frames: int):
    frames = sequence.get("frames", [])
    events = sequence.get("events") or {}
    finish = events.get("finish")
    if not frames or not isinstance(finish, dict):
        return 0
    finish_frame = int(finish.get("frame", len(frames) - 1))
    keep = max(1, min(len(frames), finish_frame + 1 + max(0, tail_frames)))
    removed = len(frames) - keep
    if removed <= 0:
        return 0
    sequence["frames"] = frames[:keep]
    sequence["total_frames"] = keep
    sequence["totalframes"] = keep
    return removed


def phase_for_frame(sequence, frame_index: int):
    events = sequence.get("events") or {}
    phases = [
        ("address", "address"),
        ("toe_up", "takeaway"),
        ("mid_backswing", "mid_backswing"),
        ("top", "top"),
        ("mid_downswing", "transition"),
        ("impact", "downswing"),
        ("mid_follow_through", "mid_follow_through"),
        ("finish", "finish"),
    ]
    last_label = "setup"
    for event_name, label in phases:
        event = events.get(event_name)
        if isinstance(event, dict) and frame_index >= int(event.get("frame", -1)):
            last_label = label
    if last_label == "finish" and isinstance(events.get("finish"), dict):
        if frame_index > int(events["finish"].get("frame", frame_index)):
            return "after_finish"
    return last_label


def estimate_subject_scale(maps):
    widths = []
    for lm_map in maps:
        ls = get_pos(lm_map, "left_shoulder")
        rs = get_pos(lm_map, "right_shoulder")
        if ls and rs:
            widths.append(v_dist(ls, rs))
    return median(widths) if widths else 1.0


def detect_bad_samples(maps, scale, max_jump_ratio):
    bad = {joint: [False] * len(maps) for joint in CORE_JOINTS}
    max_jump = scale * max_jump_ratio
    count = 0
    for joint in CORE_JOINTS:
        prev = None
        for i, lm_map in enumerate(maps):
            pos = get_pos(lm_map, joint)
            if pos is None:
                bad[joint][i] = True
                count += 1
                continue
            landmark = lm_map.get(joint)
            if landmark and float(landmark.get("visibility", 1.0)) < 0.2:
                bad[joint][i] = True
                count += 1
            if prev is not None and v_dist(pos, prev) > max_jump:
                bad[joint][i] = True
                count += 1
            if not bad[joint][i]:
                prev = pos
    return bad, count


def repair_short_gaps(maps, bad, max_gap):
    repaired = 0
    n = len(maps)
    for joint, flags in bad.items():
        i = 0
        while i < n:
            if not flags[i]:
                i += 1
                continue
            start = i
            while i < n and flags[i]:
                i += 1
            end = i - 1
            before = start - 1
            after = i if i < n else -1
            gap = end - start + 1
            if before < 0 or after < 0 or gap > max_gap:
                continue
            a = get_pos(maps[before], joint)
            b = get_pos(maps[after], joint)
            if not a or not b:
                continue
            for f in range(start, end + 1):
                t = (f - before) / (after - before)
                smooth_t = t * t * (3.0 - 2.0 * t)
                pos = v_add(v_mul(a, 1.0 - smooth_t), v_mul(b, smooth_t))
                set_pos(maps[f], joint, pos, "gapfix")
                flags[f] = False
                repaired += 1
    return repaired


def smooth_positions(maps, joints, window, blend):
    if window <= 1 or blend <= 0:
        return 0
    half = window // 2
    smoothed = 0
    for joint in joints:
        original = [get_pos(lm_map, joint) for lm_map in maps]
        for i, pos in enumerate(original):
            if pos is None:
                continue
            samples = []
            weights = []
            for offset in range(-half, half + 1):
                j = i + offset
                if j < 0 or j >= len(original) or original[j] is None:
                    continue
                weight = half + 1 - abs(offset)
                samples.append(original[j])
                weights.append(weight)
            if not samples:
                continue
            total = float(sum(weights))
            avg = [0.0, 0.0, 0.0]
            for sample, weight in zip(samples, weights):
                avg = v_add(avg, v_mul(sample, weight / total))
            out = v_add(v_mul(pos, 1.0 - blend), v_mul(avg, blend))
            set_pos(maps[i], joint, out, "smooth")
            smoothed += 1
    return smoothed


def median_bone_lengths(maps):
    lengths = {}
    for label, a, b in BONES:
        values = []
        for lm_map in maps:
            pa = get_pos(lm_map, a)
            pb = get_pos(lm_map, b)
            if pa and pb:
                values.append(v_dist(pa, pb))
        if values:
            lengths[label] = median(values)
    return lengths


def set_child_length(lm_map, parent, child, target_length):
    p = get_pos(lm_map, parent)
    c = get_pos(lm_map, child)
    if not p or not c or target_length <= 0:
        return False
    direction = v_norm(v_sub(c, p), fallback=[0.0, -1.0, 0.0])
    set_pos(lm_map, child, v_add(p, v_mul(direction, target_length)), "bone")
    return True


def enforce_bone_lengths(maps, lengths, blend):
    changed = 0
    if blend <= 0:
        return changed
    chains = [
        ("left_shoulder", "left_elbow", "left_upper_arm"),
        ("left_elbow", "left_wrist", "left_lower_arm"),
        ("right_shoulder", "right_elbow", "right_upper_arm"),
        ("right_elbow", "right_wrist", "right_lower_arm"),
        ("left_hip", "left_knee", "left_upper_leg"),
        ("left_knee", "left_ankle", "left_lower_leg"),
        ("right_hip", "right_knee", "right_upper_leg"),
        ("right_knee", "right_ankle", "right_lower_leg"),
    ]
    for lm_map in maps:
        for parent, child, label in chains:
            target = lengths.get(label)
            if not target:
                continue
            old = get_pos(lm_map, child)
            if old is None:
                continue
            p = get_pos(lm_map, parent)
            if p is None:
                continue
            direction = v_norm(v_sub(old, p), fallback=[0.0, -1.0, 0.0])
            projected = v_add(p, v_mul(direction, target))
            out = v_add(v_mul(old, 1.0 - blend), v_mul(projected, blend))
            set_pos(lm_map, child, out, "bone")
            changed += 1
    return changed


def constrain_grip(maps, max_ratio, elbow_follow):
    changed = 0
    for lm_map in maps:
        ls = get_pos(lm_map, "left_shoulder")
        rs = get_pos(lm_map, "right_shoulder")
        lw = get_pos(lm_map, "left_wrist")
        rw = get_pos(lm_map, "right_wrist")
        if not ls or not rs or not lw or not rw:
            continue
        shoulder_width = v_dist(ls, rs)
        current = v_dist(lw, rw)
        max_sep = shoulder_width * max_ratio
        if shoulder_width <= 1e-9 or current <= max_sep or current <= 1e-9:
            continue
        center = v_mul(v_add(lw, rw), 0.5)
        direction = v_norm(v_sub(rw, lw), fallback=[1.0, 0.0, 0.0])
        new_lw = v_sub(center, v_mul(direction, max_sep * 0.5))
        new_rw = v_add(center, v_mul(direction, max_sep * 0.5))
        old_lw, old_rw = lw, rw
        set_pos(lm_map, "left_wrist", new_lw, "grip")
        set_pos(lm_map, "right_wrist", new_rw, "grip")
        for elbow_name, shoulder_name, old_wrist, new_wrist in [
            ("left_elbow", "left_shoulder", old_lw, new_lw),
            ("right_elbow", "right_shoulder", old_rw, new_rw),
        ]:
            elbow = get_pos(lm_map, elbow_name)
            shoulder = get_pos(lm_map, shoulder_name)
            if elbow and shoulder:
                target_elbow = v_add(shoulder, v_mul(v_sub(new_wrist, shoulder), 0.5))
                set_pos(
                    lm_map,
                    elbow_name,
                    v_add(v_mul(elbow, 1.0 - elbow_follow), v_mul(target_elbow, elbow_follow)),
                    "grip",
                )
        changed += 1
    return changed


def constrain_trunk_pitch(sequence, maps, max_back_deg, max_finish_back_deg, blend):
    if blend <= 0:
        return 0
    changed = 0
    upper_body = [
        "nose",
        "left_eye",
        "right_eye",
        "left_eye_inner",
        "left_eye_outer",
        "right_eye_inner",
        "right_eye_outer",
        "left_ear",
        "right_ear",
        "mouth_left",
        "mouth_right",
        "left_shoulder",
        "right_shoulder",
        "left_elbow",
        "right_elbow",
        "left_wrist",
        "right_wrist",
    ]
    finish_like = {"mid_follow_through", "finish", "after_finish"}
    for i, lm_map in enumerate(maps):
        ls = get_pos(lm_map, "left_shoulder")
        rs = get_pos(lm_map, "right_shoulder")
        lh = get_pos(lm_map, "left_hip")
        rh = get_pos(lm_map, "right_hip")
        if not ls or not rs or not lh or not rh:
            continue
        shoulder_center = v_mul(v_add(ls, rs), 0.5)
        hip_center = v_mul(v_add(lh, rh), 0.5)
        trunk = v_sub(shoulder_center, hip_center)
        horizontal = math.sqrt(trunk[0] * trunk[0] + trunk[1] * trunk[1])
        if horizontal <= 1e-9:
            continue
        phase = phase_for_frame(sequence, i)
        limit = max_finish_back_deg if phase in finish_like else max_back_deg
        max_z = math.tan(math.radians(limit)) * horizontal
        if trunk[2] <= max_z:
            continue
        shift = (trunk[2] - max_z) * blend
        for joint in upper_body:
            pos = get_pos(lm_map, joint)
            if pos:
                pos[2] -= shift
                set_pos(lm_map, joint, pos, "trunklimit")
        changed += 1
    return changed


def constrain_arm_depth(sequence, maps, max_behind_ratio, blend):
    if blend <= 0:
        return 0
    changed = 0
    relaxed = {"top", "mid_follow_through", "finish", "after_finish"}
    for i, lm_map in enumerate(maps):
        ls = get_pos(lm_map, "left_shoulder")
        rs = get_pos(lm_map, "right_shoulder")
        if not ls or not rs:
            continue
        shoulder_width = v_dist(ls, rs)
        if shoulder_width <= 1e-9:
            continue
        phase = phase_for_frame(sequence, i)
        phase_ratio = max_behind_ratio * (1.35 if phase in relaxed else 1.0)
        for side in ("left", "right"):
            shoulder = get_pos(lm_map, f"{side}_shoulder")
            elbow = get_pos(lm_map, f"{side}_elbow")
            wrist = get_pos(lm_map, f"{side}_wrist")
            if not shoulder or not elbow or not wrist:
                continue
            max_z = shoulder[2] + shoulder_width * phase_ratio
            worst_z = max(elbow[2], wrist[2])
            if worst_z <= max_z:
                continue
            shift = (worst_z - max_z) * blend
            elbow[2] -= shift
            wrist[2] -= shift
            set_pos(lm_map, f"{side}_elbow", elbow, "armdepth")
            set_pos(lm_map, f"{side}_wrist", wrist, "armdepth")
            changed += 1
    return changed


def constrain_two_bone_reach(maps, lengths, max_reach_ratio, min_elbow_angle_deg):
    changed = 0
    for lm_map in maps:
        for side in ("left", "right"):
            shoulder_name = f"{side}_shoulder"
            elbow_name = f"{side}_elbow"
            wrist_name = f"{side}_wrist"
            upper_len = lengths.get(f"{side}_upper_arm")
            lower_len = lengths.get(f"{side}_lower_arm")
            shoulder = get_pos(lm_map, shoulder_name)
            elbow = get_pos(lm_map, elbow_name)
            wrist = get_pos(lm_map, wrist_name)
            if not shoulder or not elbow or not wrist or not upper_len or not lower_len:
                continue

            shoulder_to_wrist = v_sub(wrist, shoulder)
            reach = v_len(shoulder_to_wrist)
            max_reach = (upper_len + lower_len) * max_reach_ratio
            min_reach = max(0.0, abs(upper_len - lower_len) * 1.02)
            target_wrist = None
            if reach > max_reach and reach > 1e-9:
                target_wrist = v_add(shoulder, v_mul(v_norm(shoulder_to_wrist), max_reach))
            elif 1e-9 < reach < min_reach:
                target_wrist = v_add(shoulder, v_mul(v_norm(shoulder_to_wrist), min_reach))

            upper_vec = v_sub(shoulder, elbow)
            lower_vec = v_sub(wrist, elbow)
            elbow_angle = v_angle_deg(upper_vec, lower_vec)
            if elbow_angle < min_elbow_angle_deg and v_len(lower_vec) > 1e-9:
                straight_dir = v_norm(v_mul(upper_vec, -1.0), fallback=v_norm(lower_vec))
                lower_dir = clamp_direction_from_reference(straight_dir, lower_vec, 180.0 - min_elbow_angle_deg)
                target_wrist = v_add(elbow, v_mul(lower_dir, lower_len))

            if target_wrist is not None:
                set_pos(lm_map, wrist_name, target_wrist, "armlimit")
                changed += 1
    return changed


def body_forward_for_frame(lm_map, previous_forward=None):
    ls = get_pos(lm_map, "left_shoulder")
    rs = get_pos(lm_map, "right_shoulder")
    lh = get_pos(lm_map, "left_hip")
    rh = get_pos(lm_map, "right_hip")
    if not ls or not rs or not lh or not rh:
        return previous_forward or [0.0, 0.0, 1.0]
    shoulder_right = v_sub(rs, ls)
    shoulder_center = v_mul(v_add(ls, rs), 0.5)
    hip_center = v_mul(v_add(lh, rh), 0.5)
    trunk = v_sub(shoulder_center, hip_center)
    forward = v_norm(v_cross(shoulder_right, trunk), fallback=previous_forward or [0.0, 0.0, 1.0])
    if previous_forward and v_dot(forward, previous_forward) < 0:
        forward = v_mul(forward, -1.0)
    return forward


def stabilize_head_proxy(maps, max_from_body_deg, max_per_frame_deg, blend):
    if blend <= 0:
        return 0
    face_lengths = []
    for lm_map in maps:
        nose = get_pos(lm_map, "nose")
        le = get_pos(lm_map, "left_ear")
        re = get_pos(lm_map, "right_ear")
        if nose and le and re:
            ears = v_mul(v_add(le, re), 0.5)
            face_lengths.append(v_dist(nose, ears))
    face_length = median(face_lengths) if face_lengths else 0.08

    changed = 0
    previous_forward = None
    for lm_map in maps:
        nose = get_pos(lm_map, "nose")
        le = get_pos(lm_map, "left_ear")
        re = get_pos(lm_map, "right_ear")
        if not nose or not le or not re:
            continue
        ears = v_mul(v_add(le, re), 0.5)
        current = v_norm(v_sub(nose, ears), fallback=previous_forward or [0.0, 0.0, 1.0])
        body_forward = body_forward_for_frame(lm_map, previous_forward)
        if previous_forward is not None:
            current = clamp_direction_from_reference(previous_forward, current, max_per_frame_deg)
        target = clamp_direction_from_reference(body_forward, current, max_from_body_deg)
        corrected = v_norm(v_lerp(current, target, blend), fallback=target)
        if v_angle_deg(current, corrected) > 0.25:
            set_pos(lm_map, "nose", v_add(ears, v_mul(corrected, face_length)), "headlimit")
            changed += 1
        previous_forward = corrected
    return changed


def limit_joint_dynamics(maps, joints, scale, max_velocity_ratio, max_accel_ratio):
    max_velocity = max(scale * max_velocity_ratio, 1e-9)
    max_accel = max(scale * max_accel_ratio, 1e-9)
    changed = 0
    for joint in joints:
        prev = None
        prev_vel = [0.0, 0.0, 0.0]
        for lm_map in maps:
            pos = get_pos(lm_map, joint)
            if pos is None:
                continue
            if prev is None:
                prev = pos
                continue
            vel = v_sub(pos, prev)
            speed = v_len(vel)
            if speed > max_velocity:
                vel = v_mul(v_norm(vel), max_velocity)
                pos = v_add(prev, vel)
                changed += 1
            accel = v_sub(vel, prev_vel)
            accel_len = v_len(accel)
            if accel_len > max_accel:
                vel = v_add(prev_vel, v_mul(v_norm(accel), max_accel))
                pos = v_add(prev, vel)
                changed += 1
            set_pos(lm_map, joint, pos, "dynamics")
            prev = pos
            prev_vel = vel
    return changed


def collect_metrics(maps):
    scale = estimate_subject_scale(maps)
    grip = []
    hand_depth = []
    trunk_pitch = []
    head_hand_opposite = 0
    wrist_jumps = []
    bone_ranges = []
    prev_lw = prev_rw = None
    for lm_map in maps:
        ls = get_pos(lm_map, "left_shoulder")
        rs = get_pos(lm_map, "right_shoulder")
        lw = get_pos(lm_map, "left_wrist")
        rw = get_pos(lm_map, "right_wrist")
        if ls and rs and lw and rw:
            sw = max(v_dist(ls, rs), 1e-9)
            grip.append(v_dist(lw, rw) / sw)
            shoulder_center = v_mul(v_add(ls, rs), 0.5)
            wrist_center = v_mul(v_add(lw, rw), 0.5)
            hand_depth.append((wrist_center[2] - shoulder_center[2]) / sw)
            lh = get_pos(lm_map, "left_hip")
            rh = get_pos(lm_map, "right_hip")
            nose = get_pos(lm_map, "nose")
            le = get_pos(lm_map, "left_ear")
            re = get_pos(lm_map, "right_ear")
            if lh and rh:
                hip_center = v_mul(v_add(lh, rh), 0.5)
                trunk = v_sub(shoulder_center, hip_center)
                trunk_pitch.append(math.degrees(math.atan2(trunk[2], math.sqrt(trunk[0] * trunk[0] + trunk[1] * trunk[1]))))
                if nose and le and re:
                    ears = v_mul(v_add(le, re), 0.5)
                    head_vec = v_sub(nose, ears)
                    head_yaw = math.atan2(head_vec[0], head_vec[2])
                    hand_x = (wrist_center[0] - hip_center[0]) / sw
                    if head_yaw and hand_x and math.copysign(1.0, head_yaw) != math.copysign(1.0, hand_x):
                        head_hand_opposite += 1
        if lw and prev_lw:
            wrist_jumps.append(v_dist(lw, prev_lw))
        if rw and prev_rw:
            wrist_jumps.append(v_dist(rw, prev_rw))
        prev_lw, prev_rw = lw, rw

    for _label, a, b in BONES:
        values = []
        for lm_map in maps:
            pa = get_pos(lm_map, a)
            pb = get_pos(lm_map, b)
            if pa and pb:
                values.append(v_dist(pa, pb))
        if values and mean(values):
            bone_ranges.append((max(values) - min(values)) / mean(values))

    return {
        "scale": round(scale, 6),
        "grip": stat(grip),
        "hand_depth": stat(hand_depth),
        "trunk_pitch": stat(trunk_pitch),
        "head_hand_opposite_frames": head_hand_opposite,
        "wrist_jump": stat(wrist_jumps),
        "max_bone_range_rel": round(max(bone_ranges), 6) if bone_ranges else None,
    }


def preprocess_sequence(sequence, args):
    normalize_metadata(sequence)
    event_stats = normalize_events(sequence)
    trimmed_frames = trim_after_finish(sequence, args.finish_tail_frames) if args.trim_after_finish else 0
    maps = frame_maps(sequence)
    before = collect_metrics(maps)

    scale = estimate_subject_scale(maps)
    bad, bad_count = detect_bad_samples(maps, scale, args.max_jump_ratio)
    repaired = repair_short_gaps(maps, bad, args.max_gap)
    smoothed = smooth_positions(maps, CORE_JOINTS, args.smooth_window, args.smooth_blend)
    lengths = median_bone_lengths(maps)
    bone_changed = enforce_bone_lengths(maps, lengths, args.bone_blend)
    grip_changed = constrain_grip(maps, args.max_grip_ratio, args.elbow_follow)
    trunk_changed = arm_depth_changed = reach_changed = head_changed = dynamics_changed = 0
    if not args.disable_phase_constraints:
        trunk_changed = constrain_trunk_pitch(
            sequence,
            maps,
            args.max_trunk_back_deg,
            args.max_finish_trunk_back_deg,
            args.trunk_correction_blend,
        )
        arm_depth_changed = constrain_arm_depth(sequence, maps, args.max_arm_behind_ratio, args.arm_depth_blend)
        reach_changed = constrain_two_bone_reach(
            maps,
            lengths,
            args.max_arm_reach_ratio,
            args.min_elbow_angle_deg,
        )
        head_changed = stabilize_head_proxy(
            maps,
            args.max_head_angle_from_body_deg,
            args.max_head_frame_angle_deg,
            args.head_correction_blend,
        )
        dynamics_changed = limit_joint_dynamics(
            maps,
            CORE_JOINTS,
            scale,
            args.max_velocity_ratio,
            args.max_accel_ratio,
        )
    post_grip_bone_changed = enforce_bone_lengths(maps, lengths, args.post_grip_bone_blend)
    final_grip_changed = constrain_grip(maps, args.final_max_grip_ratio, args.elbow_follow * 0.5)

    after = collect_metrics(maps)
    post = sequence.setdefault("preprocess", {})
    quality_flags = []
    frame_count = len(maps)
    core_sample_count = max(1, frame_count * len(CORE_JOINTS))
    if after["grip"]["max"] is not None and after["grip"]["max"] > args.flag_grip_max_ratio:
        quality_flags.append("residual_grip_outlier")
    if (
        after["max_bone_range_rel"] is not None
        and after["max_bone_range_rel"] > args.flag_bone_range_ratio
    ):
        quality_flags.append("residual_bone_length_variation")
    if bad_count / core_sample_count > args.flag_bad_sample_ratio:
        quality_flags.append("many_repaired_or_unreliable_joint_samples")
    for event_name in ("top", "impact"):
        event = sequence.get("events", {}).get(event_name)
        if isinstance(event, dict) and float(event.get("confidence", 1.0) or 0.0) < args.flag_event_confidence:
            quality_flags.append(f"low_{event_name}_event_confidence")
    finish = sequence.get("events", {}).get("finish")
    if isinstance(finish, dict) and float(finish.get("confidence", 1.0) or 0.0) < args.flag_finish_confidence:
        quality_flags.append("low_finish_event_confidence")
    if after["trunk_pitch"].get("max") is not None and after["trunk_pitch"]["max"] > args.flag_trunk_back_deg:
        quality_flags.append("residual_trunk_back_drift")
    if frame_count and after["head_hand_opposite_frames"] / frame_count > args.flag_head_opposite_ratio:
        quality_flags.append("residual_head_hand_opposition")

    post[VERSION] = {
        "trimmed_frames": trimmed_frames,
        "bad_samples": bad_count,
        "gap_repaired": repaired,
        "smoothed_samples": smoothed,
        "bone_length_samples": bone_changed,
        "post_grip_bone_length_samples": post_grip_bone_changed,
        "grip_constrained_frames": grip_changed,
        "final_grip_constrained_frames": final_grip_changed,
        "trunk_constrained_frames": trunk_changed,
        "arm_depth_constrained_segments": arm_depth_changed,
        "arm_reach_constrained_frames": reach_changed,
        "head_constrained_frames": head_changed,
        "dynamics_constrained_samples": dynamics_changed,
        "event_stats": event_stats,
        "quality_flags": sorted(set(quality_flags)),
        "avatar_use": "needs_review" if quality_flags else "ok",
        "parameters": {
            "max_jump_ratio": args.max_jump_ratio,
            "max_gap": args.max_gap,
            "smooth_window": args.smooth_window,
            "smooth_blend": args.smooth_blend,
            "bone_blend": args.bone_blend,
            "post_grip_bone_blend": args.post_grip_bone_blend,
            "max_grip_ratio": args.max_grip_ratio,
            "final_max_grip_ratio": args.final_max_grip_ratio,
            "elbow_follow": args.elbow_follow,
            "trim_after_finish": args.trim_after_finish,
            "finish_tail_frames": args.finish_tail_frames,
            "disable_phase_constraints": args.disable_phase_constraints,
            "max_trunk_back_deg": args.max_trunk_back_deg,
            "max_finish_trunk_back_deg": args.max_finish_trunk_back_deg,
            "trunk_correction_blend": args.trunk_correction_blend,
            "max_arm_behind_ratio": args.max_arm_behind_ratio,
            "arm_depth_blend": args.arm_depth_blend,
            "max_arm_reach_ratio": args.max_arm_reach_ratio,
            "min_elbow_angle_deg": args.min_elbow_angle_deg,
            "max_head_angle_from_body_deg": args.max_head_angle_from_body_deg,
            "max_head_frame_angle_deg": args.max_head_frame_angle_deg,
            "head_correction_blend": args.head_correction_blend,
            "max_velocity_ratio": args.max_velocity_ratio,
            "max_accel_ratio": args.max_accel_ratio,
            "flag_grip_max_ratio": args.flag_grip_max_ratio,
            "flag_bone_range_ratio": args.flag_bone_range_ratio,
            "flag_bad_sample_ratio": args.flag_bad_sample_ratio,
            "flag_event_confidence": args.flag_event_confidence,
            "flag_finish_confidence": args.flag_finish_confidence,
            "flag_trunk_back_deg": args.flag_trunk_back_deg,
            "flag_head_opposite_ratio": args.flag_head_opposite_ratio,
        },
    }
    return {"before": before, "after": after, "operations": post[VERSION]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-file")
    parser.add_argument("--output-file")
    parser.add_argument("--input-dir", default="data/new pose/face_on")
    parser.add_argument("--output-dir", default="data/preprocessed/face_on")
    parser.add_argument("--report", default="data/preprocessed/face_on_preprocess_report.json")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--allow-overwrite", action="store_true")
    parser.add_argument("--max-jump-ratio", type=float, default=0.85)
    parser.add_argument("--max-gap", type=int, default=12)
    parser.add_argument("--smooth-window", type=int, default=5)
    parser.add_argument("--smooth-blend", type=float, default=0.35)
    parser.add_argument("--bone-blend", type=float, default=0.85)
    parser.add_argument("--post-grip-bone-blend", type=float, default=0.55)
    parser.add_argument("--max-grip-ratio", type=float, default=0.65)
    parser.add_argument("--final-max-grip-ratio", type=float, default=0.95)
    parser.add_argument("--elbow-follow", type=float, default=0.35)
    parser.add_argument("--trim-after-finish", action="store_true")
    parser.add_argument("--finish-tail-frames", type=int, default=0)
    parser.add_argument("--disable-phase-constraints", action="store_true")
    parser.add_argument("--max-trunk-back-deg", type=float, default=14.0)
    parser.add_argument("--max-finish-trunk-back-deg", type=float, default=16.0)
    parser.add_argument("--trunk-correction-blend", type=float, default=0.85)
    parser.add_argument("--max-arm-behind-ratio", type=float, default=0.18)
    parser.add_argument("--arm-depth-blend", type=float, default=0.9)
    parser.add_argument("--max-arm-reach-ratio", type=float, default=0.985)
    parser.add_argument("--min-elbow-angle-deg", type=float, default=25.0)
    parser.add_argument("--max-head-angle-from-body-deg", type=float, default=180.0)
    parser.add_argument("--max-head-frame-angle-deg", type=float, default=12.0)
    parser.add_argument("--head-correction-blend", type=float, default=0.65)
    parser.add_argument("--max-velocity-ratio", type=float, default=0.42)
    parser.add_argument("--max-accel-ratio", type=float, default=0.55)
    parser.add_argument("--flag-grip-max-ratio", type=float, default=1.5)
    parser.add_argument("--flag-bone-range-ratio", type=float, default=1.2)
    parser.add_argument("--flag-bad-sample-ratio", type=float, default=0.05)
    parser.add_argument("--flag-event-confidence", type=float, default=0.2)
    parser.add_argument("--flag-finish-confidence", type=float, default=0.35)
    parser.add_argument("--flag-trunk-back-deg", type=float, default=18.0)
    parser.add_argument("--flag-head-opposite-ratio", type=float, default=0.25)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    if args.input_file:
        input_path = Path(args.input_file)
        if args.output_file:
            output_path = Path(args.output_file)
        else:
            output_path = output_dir / input_path.name
        files = [(input_path, output_path)]
    else:
        files = [(file_path, output_dir / file_path.name) for file_path in sorted(input_dir.glob("*.json"))]
        if args.limit > 0:
            files = files[: args.limit]

    report = {
        "version": VERSION,
        "input_dir": str(input_dir) if not args.input_file else None,
        "input_file": args.input_file,
        "output_dir": str(output_dir),
        "output_file": args.output_file,
        "files": [],
    }
    if not args.dry_run:
        for input_path, output_path in files:
            if input_path.resolve() == output_path.resolve() and not args.allow_overwrite:
                raise SystemExit("--allow-overwrite is required when output path equals input path")
            output_path.parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)

    for file_path, out_path in files:
        with file_path.open("r", encoding="utf-8") as f:
            original = json.load(f)
        sequence = deepcopy(original)
        metrics = preprocess_sequence(sequence, args)
        report["files"].append({"file": file_path.name, **metrics})
        if not args.dry_run:
            with out_path.open("w", encoding="utf-8", newline="\n") as f:
                json.dump(sequence, f, ensure_ascii=False, indent=2)

    if not args.dry_run:
        with open(args.report, "w", encoding="utf-8", newline="\n") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    improved_grip = []
    improved_bones = []
    for item in report["files"]:
        before_grip = item["before"]["grip"].get("p90")
        after_grip = item["after"]["grip"].get("p90")
        if before_grip is not None and after_grip is not None:
            improved_grip.append(before_grip - after_grip)
        before_bone = item["before"].get("max_bone_range_rel")
        after_bone = item["after"].get("max_bone_range_rel")
        if before_bone is not None and after_bone is not None:
            improved_bones.append(before_bone - after_bone)

    print(json.dumps({
        "processed": len(report["files"]),
        "dry_run": args.dry_run,
        "avg_grip_p90_reduction": round(mean(improved_grip) or 0.0, 6),
        "avg_max_bone_range_reduction": round(mean(improved_bones) or 0.0, 6),
        "report": None if args.dry_run else args.report,
        "output_dir": None if args.dry_run else str(output_dir),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
