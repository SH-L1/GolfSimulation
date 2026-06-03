"""
Step 6: P1 지표 6종 계산 (WRIST_ANGLE 제외)

회전 지표(SHOULDER_ROT, X_FACTOR, HIP_ROTATION)는 width-ratio 방식 사용.
 - 어깨/힙이 회전할수록 2D 투영 너비가 줄어드는 원리
 - rotation_angle = arccos(width_at_event / width_at_address)
 - face_on 뷰에 최적화 (DTL 뷰는 reference stats 별도 필요)

좌표 규약:
 - MediaPipe 라벨은 사람 기준 (left = 사람의 왼쪽)
 - face_on 뷰에서는 left_shoulder.x > right_shoulder.x (image 좌우 반전)
 - 너비는 abs() 처리하므로 좌우 반전 무관
"""
import numpy as np
from typing import Optional
from .loader import Frame, SwingData, get_event_frame


DEBUG_METRICS = True


def _debug(*args):
    if DEBUG_METRICS:
        print("[DEBUG][metrics]", *args)


def _dist2d(a, b) -> float:
    return float(np.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2))


def _x_width(lm: dict, key_a: str, key_b: str) -> Optional[float]:
    if key_a not in lm or key_b not in lm:
        return None
    return abs(lm[key_a].x - lm[key_b].x)


def _rotation_from_width(w_event: float, w_address: float) -> Optional[float]:
    if w_address < 1e-6:
        return None
    ratio_raw = w_event / w_address
    ratio = float(np.clip(ratio_raw, 0.0, 1.0))
    angle = float(np.degrees(np.arccos(ratio)))
    return angle


def _has_keys(frame: Frame, *keys: str) -> bool:
    return all(k in frame.landmarks for k in keys)


def _angle_from_horizontal(vec: np.ndarray) -> float:
    return float(np.degrees(np.arctan2(vec[1], vec[0])))


def _angle_between_vecs(v1: np.ndarray, v2: np.ndarray) -> float:
    denom = np.linalg.norm(v1) * np.linalg.norm(v2)
    if denom < 1e-9:
        return 0.0
    cos_a = np.clip(np.dot(v1, v2) / denom, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_a)))


def stance_ratio(address_frame: Frame) -> Optional[float]:
    lm = address_frame.landmarks
    needed = ["left_ankle", "right_ankle", "left_shoulder", "right_shoulder"]
    if not _has_keys(address_frame, *needed):
        _debug("STANCE_RATIO missing keys")
        return None

    foot_w = _dist2d(lm["left_ankle"], lm["right_ankle"])
    sho_w = _dist2d(lm["left_shoulder"], lm["right_shoulder"])

    _debug("STANCE_RATIO", {"foot_w": foot_w, "sho_w": sho_w})

    if sho_w < 1e-6:
        return None
    return float(foot_w / sho_w)


def shoulder_rot(mid_bs_frame: Frame, address_frame: Frame) -> Optional[float]:
    needed = ["left_shoulder", "right_shoulder"]
    if not _has_keys(address_frame, *needed) or not _has_keys(mid_bs_frame, *needed):
        _debug("SHOULDER_ROT missing keys")
        return None

    w_addr = _x_width(address_frame.landmarks, "left_shoulder", "right_shoulder")
    w_mid = _x_width(mid_bs_frame.landmarks, "left_shoulder", "right_shoulder")

    _debug("SHOULDER_ROT widths", {"address": w_addr, "mid_backswing": w_mid})

    if w_addr is None or w_mid is None:
        return None

    angle = _rotation_from_width(w_mid, w_addr)
    _debug("SHOULDER_ROT angle", angle)
    return angle


def x_factor(top_frame: Frame, address_frame: Frame) -> Optional[float]:
    sho_keys = ["left_shoulder", "right_shoulder"]
    hip_keys = ["left_hip", "right_hip"]
    needed = sho_keys + hip_keys

    if not _has_keys(address_frame, *needed) or not _has_keys(top_frame, *needed):
        _debug("X_FACTOR missing keys")
        return None

    w_sho_addr = _x_width(address_frame.landmarks, "left_shoulder", "right_shoulder")
    w_sho_top = _x_width(top_frame.landmarks, "left_shoulder", "right_shoulder")
    w_hip_addr = _x_width(address_frame.landmarks, "left_hip", "right_hip")
    w_hip_top = _x_width(top_frame.landmarks, "left_hip", "right_hip")

    _debug("X_FACTOR widths", {
        "sho_addr": w_sho_addr,
        "sho_top": w_sho_top,
        "hip_addr": w_hip_addr,
        "hip_top": w_hip_top,
    })

    if any(v is None for v in [w_sho_addr, w_sho_top, w_hip_addr, w_hip_top]):
        return None

    sho_rot = _rotation_from_width(w_sho_top, w_sho_addr)
    hip_rot = _rotation_from_width(w_hip_top, w_hip_addr)

    _debug("X_FACTOR rotations", {"sho_rot": sho_rot, "hip_rot": hip_rot})

    if sho_rot is None or hip_rot is None:
        return None

    return float(max(0.0, sho_rot - hip_rot))


def backswing_max(top_frame: Frame) -> Optional[float]:
    if not _has_keys(top_frame, "left_elbow", "left_wrist"):
        _debug("BACKSWING_MAX missing keys")
        return None

    lm = top_frame.landmarks
    vec = np.array([
        lm["left_wrist"].x - lm["left_elbow"].x,
        -(lm["left_wrist"].y - lm["left_elbow"].y),
    ])
    angle = abs(_angle_from_horizontal(vec))
    _debug("BACKSWING_MAX", angle)
    return angle


def hip_rotation(impact_frame: Frame, address_frame: Frame) -> Optional[float]:
    needed = ["left_hip", "right_hip"]
    if not _has_keys(address_frame, *needed) or not _has_keys(impact_frame, *needed):
        _debug("HIP_ROTATION missing keys")
        return None

    w_addr = _x_width(address_frame.landmarks, "left_hip", "right_hip")
    w_impact = _x_width(impact_frame.landmarks, "left_hip", "right_hip")

    _debug("HIP_ROTATION widths", {"address": w_addr, "impact": w_impact})

    if w_addr is None or w_impact is None:
        return None

    angle = _rotation_from_width(w_impact, w_addr)
    _debug("HIP_ROTATION angle", angle)
    return angle


def spine_tilt(finish_frame: Frame) -> Optional[float]:
    needed = ["left_shoulder", "right_shoulder", "left_hip", "right_hip"]
    if not _has_keys(finish_frame, *needed):
        _debug("SPINE_TILT missing keys")
        return None

    lm = finish_frame.landmarks
    sho_mid = np.array([
        (lm["left_shoulder"].x + lm["right_shoulder"].x) / 2,
        (lm["left_shoulder"].y + lm["right_shoulder"].y) / 2,
    ])
    hip_mid = np.array([
        (lm["left_hip"].x + lm["right_hip"].x) / 2,
        (lm["left_hip"].y + lm["right_hip"].y) / 2,
    ])

    spine_vec = np.array([sho_mid[0] - hip_mid[0], -(sho_mid[1] - hip_mid[1])])
    vertical = np.array([0.0, 1.0])
    angle = _angle_between_vecs(spine_vec, vertical)
    _debug("SPINE_TILT", angle)
    return angle


def compute_all_metrics(swing: SwingData) -> dict:
    address_frame = get_event_frame(swing, "address")
    mid_bs_frame = get_event_frame(swing, "mid_backswing")
    top_frame = get_event_frame(swing, "top")
    impact_frame = get_event_frame(swing, "impact")
    finish_frame = get_event_frame(swing, "finish")

    _debug("event frames", {
        "address": None if address_frame is None else address_frame.frame_idx,
        "mid_backswing": None if mid_bs_frame is None else mid_bs_frame.frame_idx,
        "top": None if top_frame is None else top_frame.frame_idx,
        "impact": None if impact_frame is None else impact_frame.frame_idx,
        "finish": None if finish_frame is None else finish_frame.frame_idx,
    })

    candidates = {
        "STANCE_RATIO": stance_ratio(address_frame) if address_frame else None,
        "SHOULDER_ROT": shoulder_rot(mid_bs_frame, address_frame)
                        if mid_bs_frame and address_frame else None,
        "X_FACTOR": x_factor(top_frame, address_frame)
                    if top_frame and address_frame else None,
        "BACKSWING_MAX": backswing_max(top_frame) if top_frame else None,
        "HIP_ROTATION": hip_rotation(impact_frame, address_frame)
                        if impact_frame and address_frame else None,
        "SPINE_TILT": spine_tilt(finish_frame) if finish_frame else None,
    }

    _debug("final candidates", candidates)

    return {k: v for k, v in candidates.items() if v is not None}