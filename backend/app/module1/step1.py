import json
from pathlib import Path

import cv2
import numpy as np


class Step1SquarePadder:
    def __init__(self, target_size: int = 1024):
        self.target_size = target_size

    def _make_square_padding(self, frame):
        h, w = frame.shape[:2]

        if h > w:
            new_h = self.target_size
            new_w = int(w * (self.target_size / h))
        else:
            new_w = self.target_size
            new_h = int(h * (self.target_size / w))

        resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        square = np.zeros((self.target_size, self.target_size, 3), dtype=np.uint8)

        y_offset = (self.target_size - new_h) // 2
        x_offset = (self.target_size - new_w) // 2
        square[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = resized

        metadata = {
            "original_size": {"width": int(w), "height": int(h)},
            "resized_size": {"width": int(new_w), "height": int(new_h)},
            "offset": {"x": int(x_offset), "y": int(y_offset)},
            "target_size": int(self.target_size),
            "is_square": bool(h == w),
            "aspect_ratio": round(w / h if h > 0 else 1.0, 3),
            "padding_added": bool(h != w),
        }
        return square, metadata

    def run(self, video_path: str, output_dir: str, viewtype: str) -> dict:
        video_path = Path(video_path)
        output_dir = Path(output_dir)

        step_dir = output_dir / "step1_square_padded" / viewtype
        step_dir.mkdir(parents=True, exist_ok=True)

        video_name = video_path.stem
        padded_video_path = step_dir / f"{video_name}_square.mp4"
        metadata_path = step_dir / f"{video_name}_metadata.json"

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise ValueError(f"영상을 열 수 없습니다: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(
            str(padded_video_path),
            fourcc,
            fps,
            (self.target_size, self.target_size),
        )

        first_frame_metadata = None
        processed_frames = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            square_frame, metadata = self._make_square_padding(frame)
            writer.write(square_frame)

            if first_frame_metadata is None:
                first_frame_metadata = metadata

            processed_frames += 1

        cap.release()
        writer.release()

        payload = {
            "video": video_name,
            "video_path": str(video_path),
            "view_type": viewtype,
            "target_size": int(self.target_size),
            "fps": float(fps),
            "total_frames": int(total_frames),
            "processed_frames": int(processed_frames),
            "original_size": {"width": width, "height": height},
            "metadata": first_frame_metadata,
        }

        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)

        return {
            "video_name": video_name,
            "viewtype": viewtype,
            "padded_video_path": str(padded_video_path),
            "metadata_path": str(metadata_path),
            "fps": float(fps),
            "total_frames": int(total_frames),
            "processed_frames": int(processed_frames),
            "original_size": {"width": width, "height": height},
            "padding_metadata": first_frame_metadata,
        }