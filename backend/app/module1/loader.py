"""
JSON 로더: step4_swingnet/{viewtype}/{video_id}_events.json 파싱
랜드마크 이름 기반 접근 제공 (17-keypoint COCO 포맷 대응)
"""
import json
from dataclasses import dataclass
from typing import Optional


@dataclass
class Landmark:
    x: float
    y: float
    z: float
    visibility: float


@dataclass
class Frame:
    frame_idx: int
    timestamp: float
    landmarks: dict  # str -> Landmark
    has_pose: bool


@dataclass
class SwingData:
    video_id: str
    view_type: str
    fps: float
    frames: list
    events: dict  # event_name -> frame_idx
    total_frames: int
    _frame_index: dict = None


def _normalize_event_name(name: str) -> str:
    key = str(name).strip().lower()
    alias = {
        "toeup": "toe_up",
        "midbackswing": "mid_backswing",
        "middownswing": "mid_downswing",
        "midfollowthrough": "mid_follow_through",
    }
    return alias.get(key, key)


def _extract_event_frame(info) -> Optional[int]:
    if isinstance(info, dict):
        for key in ("frame", "frameidx", "frame_index"):
            if key in info and info[key] is not None:
                return int(info[key])
        return None

    if info is None:
        return None

    return int(info)


def load_swing_json(json_path: str) -> SwingData:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    frames = []
    for frame_data in data.get("frames", []):
        landmarks = {}
        for lm in frame_data.get("landmarks", []):
            name = lm.get("name")
            if not name:
                continue

            landmarks[name] = Landmark(
                x=float(lm.get("x", 0.0)),
                y=float(lm.get("y", 0.0)),
                z=float(lm.get("z", 0.0)),
                visibility=float(lm.get("visibility", 0.0)),
            )

        frames.append(
            Frame(
                frame_idx=int(frame_data.get("frame", frame_data.get("frame_idx", 0))),
                timestamp=float(frame_data.get("timestamp", 0.0)),
                landmarks=landmarks,
                has_pose=bool(frame_data.get("has_pose", frame_data.get("haspose", True))),
            )
        )

    raw_events = data.get("events", {})
    events = {}
    for name, info in raw_events.items():
        frame = _extract_event_frame(info)
        if frame is None:
            continue
        events[_normalize_event_name(name)] = frame

    frame_index = {f.frame_idx: f for f in frames}

    return SwingData(
        video_id=str(data.get("video", "")),
        view_type=str(data.get("view_type") or data.get("viewtype") or "unknown"),
        fps=float(data.get("fps", 30.0)),
        frames=frames,
        events=events,
        total_frames=int(data.get("total_frames", data.get("totalframes", len(frames)))),
        _frame_index=frame_index,
    )


def get_frame(swing: SwingData, frame_idx: int) -> Optional[Frame]:
    if swing._frame_index is not None:
        return swing._frame_index.get(frame_idx)
    for f in swing.frames:
        if f.frame_idx == frame_idx:
            return f
    return None


def get_event_frame(swing: SwingData, event_name: str) -> Optional[Frame]:
    normalized = _normalize_event_name(event_name)
    if normalized not in swing.events:
        return None
    return get_frame(swing, swing.events[normalized])