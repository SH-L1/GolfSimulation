import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
from torchvision import transforms


class Step3SwingNetEventDetector:
    EVENT_NAMES = [
        "address",
        "toe_up",
        "mid_backswing",
        "top",
        "mid_downswing",
        "impact",
        "mid_follow_through",
        "finish",
    ]

    def __init__(
        self,
        checkpoint_path: str = "../../models/swingnet_1800.pth",
        repo_dir: str = "../../external/golfdb",
        device: str | None = None,
        seq_len: int = 64,
        conf_thr: float = 0.08,
        collapse_thr: float = 0.15,
        min_event_gap: int = 3,
    ):
        base_dir = Path(__file__).resolve().parent
        self.checkpoint_path = self._resolve_path(base_dir, checkpoint_path)
        self.repo_dir = self._resolve_path(base_dir, repo_dir)
        self.device = torch.device(
            device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        )

        self.seq_len = seq_len
        self.conf_thr = conf_thr
        self.collapse_thr = collapse_thr
        self.min_event_gap = min_event_gap

        self.model = None
        self.load_report = {
            "loaded": False,
            "reason": "not_initialized",
        }

        self.transform = transforms.Compose(
            [
                transforms.ToPILImage(),
                transforms.Resize((160, 160)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225],
                ),
            ]
        )

        self.model = self._load_model()

    def _resolve_path(self, base_dir: Path, raw_path: str) -> Path:
        p = Path(raw_path)
        if p.is_absolute():
            return p
        return (base_dir / p).resolve()

    def _ensure_repo(self):
        event_detector_path = self.repo_dir / "model.py"
        if event_detector_path.exists():
            return

        self.repo_dir.parent.mkdir(parents=True, exist_ok=True)

        if self.repo_dir.exists():
            shutil.rmtree(self.repo_dir, ignore_errors=True)

        subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "https://github.com/wmcnally/golfdb.git",
                str(self.repo_dir),
            ],
            check=True,
        )

        if not event_detector_path.exists():
            raise FileNotFoundError(
                f"golfdb repo structure invalid after clone: {event_detector_path}"
            )

    def _load_model(self):
        if not self.checkpoint_path.exists():
            self.load_report = {
                "loaded": False,
                "reason": "checkpoint_not_found",
                "message": str(self.checkpoint_path),
            }
            return None

        self._ensure_repo()

        mobilenet_weight = self.repo_dir / "mobilenet_v2.pth.tar"
        if not mobilenet_weight.exists():
            self.load_report = {
                "loaded": False,
                "reason": "mobilenet_weight_not_found",
                "message": str(mobilenet_weight),
            }
            return None

        repo_path = str(self.repo_dir.resolve())
        if repo_path not in sys.path:
            sys.path.insert(0, repo_path)

        try:
            from model import EventDetector
        except ModuleNotFoundError:
            from models.model import EventDetector

        old_cwd = Path.cwd()
        try:
            os.chdir(self.repo_dir)

            model = EventDetector(
                pretrain=False,
                width_mult=1.0,
                lstm_layers=1,
                lstm_hidden=256,
                bidirectional=True,
                dropout=False,
            ).to(self.device)
        finally:
            os.chdir(old_cwd)

        checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
        state = checkpoint.get("model_state_dict") or checkpoint.get("state_dict") or checkpoint
        state = {
            key[7:] if isinstance(key, str) and key.startswith("module.") else key: value
            for key, value in state.items()
        }

        missing, unexpected = model.load_state_dict(state, strict=False)
        model.eval()

        self.load_report = {
            "loaded": True,
            "reason": "ok",
            "checkpoint_path": str(self.checkpoint_path),
            "repo_dir": str(self.repo_dir),
            "mobilenet_weight": str(mobilenet_weight),
            "missing_after_load": list(missing)[:20],
            "unexpected_after_load": list(unexpected)[:20],
        }
        return model

    def _ensure_model_loaded(self):
        if self.model is None:
            self.model = self._load_model()
        return self.model

    def _load_frames(self, source_video_path: str) -> tuple[list[np.ndarray], float]:
        cap = cv2.VideoCapture(str(source_video_path))
        if not cap.isOpened():
            raise ValueError(f"영상을 열 수 없습니다: {source_video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frames = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(rgb)

        cap.release()
        return frames, float(fps)

    def _predict_logits(self, frames: list[np.ndarray]) -> np.ndarray:
        model = self._ensure_model_loaded()

        if not frames:
            return np.zeros((0, len(self.EVENT_NAMES)), dtype=np.float32)

        if model is None:
            return np.zeros((len(frames), len(self.EVENT_NAMES)), dtype=np.float32)

        tensors = [self.transform(frame) for frame in frames]
        video_tensor = torch.stack(tensors, dim=0)

        logits_out = []

        with torch.no_grad():
            for start in range(0, len(video_tensor), self.seq_len):
                chunk = video_tensor[start : start + self.seq_len]
                valid_len = len(chunk)

                if valid_len < self.seq_len:
                    pad = chunk[-1:].repeat(self.seq_len - valid_len, 1, 1, 1)
                    chunk = torch.cat([chunk, pad], dim=0)

                chunk = chunk.unsqueeze(0).to(self.device)
                logits = model(chunk)
                logits = logits.squeeze(0).detach().cpu().numpy()
                logits_out.append(logits[:valid_len])

        if logits_out:
            return np.concatenate(logits_out, axis=0)

        return np.zeros((0, len(self.EVENT_NAMES)), dtype=np.float32)

    def _prepare_probs(self, logits: np.ndarray) -> tuple[np.ndarray, dict]:
        if len(logits) == 0:
            return np.zeros((0, len(self.EVENT_NAMES)), dtype=np.float32), {
                "raw_logits_shape": [0, len(self.EVENT_NAMES)],
                "raw_class_count": len(self.EVENT_NAMES),
                "used_class_count": len(self.EVENT_NAMES),
                "background_dropped": False,
            }

        probs = torch.softmax(torch.from_numpy(logits), dim=-1).cpu().numpy()
        raw_class_count = int(probs.shape[1]) if probs.ndim == 2 else 0

        background_dropped = False
        if probs.ndim == 2 and raw_class_count == len(self.EVENT_NAMES) + 1:
            probs = probs[:, 1:]
            background_dropped = True

        if probs.ndim != 2 or probs.shape[1] < len(self.EVENT_NAMES):
            fixed = np.zeros((len(logits), len(self.EVENT_NAMES)), dtype=np.float32)
            if probs.ndim == 2:
                usable = min(probs.shape[1], len(self.EVENT_NAMES))
                fixed[:, :usable] = probs[:, :usable]
            probs = fixed
        elif probs.shape[1] > len(self.EVENT_NAMES):
            probs = probs[:, : len(self.EVENT_NAMES)]

        return probs.astype(np.float32), {
            "raw_logits_shape": list(logits.shape),
            "raw_class_count": raw_class_count,
            "used_class_count": int(probs.shape[1]),
            "background_dropped": background_dropped,
        }

    def _find_local_peaks(self, values: np.ndarray, min_value: float) -> list[tuple[int, float]]:
        peaks = []
        n = len(values)

        for i in range(n):
            v = float(values[i])
            if v < min_value:
                continue

            left_ok = i == 0 or v >= float(values[i - 1])
            right_ok = i == n - 1 or v >= float(values[i + 1])

            if left_ok and right_ok:
                peaks.append((i, v))

        peaks.sort(key=lambda x: (-x[1], x[0]))
        return peaks

    def _dedupe_close_peaks(self, peaks: list[tuple[int, float]]) -> list[tuple[int, float]]:
        kept = []
        for frame_idx, confidence in peaks:
            too_close = False
            for kept_frame, kept_conf in kept:
                if abs(frame_idx - kept_frame) <= self.min_event_gap:
                    too_close = True
                    if confidence > kept_conf:
                        kept.remove((kept_frame, kept_conf))
                        kept.append((frame_idx, confidence))
                    break
            if not too_close:
                kept.append((frame_idx, confidence))

        kept.sort(key=lambda x: x[0])
        return kept

    def _select_ordered_events(self, probs: np.ndarray) -> tuple[dict[str, dict], dict]:
        event_candidates = {}
        top_frames = {}

        for event_idx, event_name in enumerate(self.EVENT_NAMES):
            column = probs[:, event_idx]
            if len(column) == 0:
                event_candidates[event_name] = []
                top_frames[event_name] = {"frame": None, "confidence": 0.0}
                continue

            best_idx = int(np.argmax(column))
            best_conf = float(column[best_idx])
            top_frames[event_name] = {
                "frame": best_idx,
                "confidence": round(best_conf, 6),
            }

            peaks = self._find_local_peaks(column, self.conf_thr)
            peaks = self._dedupe_close_peaks(peaks)

            if not peaks and best_conf >= self.conf_thr:
                peaks = [(best_idx, best_conf)]

            event_candidates[event_name] = peaks

        filtered = {}
        last_frame = -10**9

        for event_name in self.EVENT_NAMES:
            candidates = event_candidates.get(event_name, [])
            picked = None

            ordered_candidates = sorted(candidates, key=lambda x: x[0])
            for frame_idx, confidence in ordered_candidates:
                if frame_idx < last_frame + self.min_event_gap:
                    continue
                picked = (frame_idx, confidence)
                break

            if picked is None and candidates:
                fallback_candidates = sorted(candidates, key=lambda x: (-x[1], x[0]))
                for frame_idx, confidence in fallback_candidates:
                    if frame_idx >= last_frame:
                        picked = (frame_idx, confidence)
                        break

            if picked is None:
                continue

            frame_idx, confidence = picked
            filtered[event_name] = {
                "frame": int(frame_idx),
                "confidence": round(float(confidence), 4),
            }
            last_frame = frame_idx

        return filtered, {
            "top_frames": top_frames,
            "candidate_count_by_event": {
                name: len(event_candidates.get(name, [])) for name in self.EVENT_NAMES
            },
        }

    def _collapse_events(self, probs: np.ndarray) -> tuple[dict[str, dict], dict]:
        if len(probs) == 0:
            return {}, {
                "top_frames": {},
                "candidate_count_by_event": {},
            }
        return self._select_ordered_events(probs)

    def run(
        self,
        source_video_path: str,
        pose_json_path: str,
        output_dir: str,
        viewtype: str,
    ) -> dict:
        output_dir = Path(output_dir)
        step_dir = output_dir / "step3_events" / viewtype
        step_dir.mkdir(parents=True, exist_ok=True)

        with open(pose_json_path, "r", encoding="utf-8") as f:
            pose_data = json.load(f)

        video_name = pose_data["video"]
        events_json_path = step_dir / f"{video_name}_events.json"

        frames, fps = self._load_frames(source_video_path)
        logits = self._predict_logits(frames)
        probs, probs_report = self._prepare_probs(logits)
        events, debug_report = self._collapse_events(probs)

        output = {
            "video": video_name,
            "viewtype": viewtype,
            "fps": float(fps),
            "totalframes": int(len(frames)),
            "eventmodel": "swingnet",
            "events": events,
            "event_names": self.EVENT_NAMES,
            "load_report": self.load_report,
            "probs_report": probs_report,
            "debug_report": debug_report,
            "step": "step3_events",
        }

        with open(events_json_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        return {
            "video_name": video_name,
            "viewtype": viewtype,
            "events_json_path": str(events_json_path),
            "eventmodel": "swingnet",
            "event_count": len(events),
            "load_report": self.load_report,
            "probs_report": probs_report,
            "debug_report": debug_report,
        }