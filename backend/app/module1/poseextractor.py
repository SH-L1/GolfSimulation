from pathlib import Path

import cv2


class PoseExtractor:
    def extract(self, video_path: str, viewtype: str) -> list[dict]:
        video_file = Path(video_path)
        if not video_file.exists():
            raise FileNotFoundError(f"Video not found: {video_path}")

        cap = cv2.VideoCapture(str(video_file))
        if not cap.isOpened():
            raise RuntimeError("Failed to open uploaded video.")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

        sampled_frames: list[dict] = []
        sample_limit = min(total_frames, 12)

        for idx in range(sample_limit):
            ok, _ = cap.read()
            if not ok:
                break

            sampled_frames.append(
                {
                    "frameidx": idx,
                    "timestampms": round((idx / fps) * 1000, 2),
                    "phase": self._phase_from_index(idx, sample_limit),
                    "landmarks": [],
                    "meta": {
                        "viewtype": viewtype,
                        "source": "bootstrap",
                    },
                }
            )

        cap.release()
        return sampled_frames

    def _phase_from_index(self, idx: int, total: int) -> str:
        if total <= 1:
            return "address"

        ratio = idx / max(total - 1, 1)
        if ratio <= 0.15:
            return "address"
        if ratio <= 0.5:
            return "top"
        if ratio <= 0.75:
            return "impact"
        return "finish"