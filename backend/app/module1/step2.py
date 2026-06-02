import json
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision


class Step2MediaPipePoseExtractor:
    def __init__(self, model_path: str = "models/pose_landmarker_heavy.task"):
        self.model_path = Path(model_path)
        self.landmarker = None

        self.mp_task_joint_names = [
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
            "left_shoulder",
            "right_shoulder",
            "left_elbow",
            "right_elbow",
            "left_wrist",
            "right_wrist",
            "left_pinky",
            "right_pinky",
            "left_index",
            "right_index",
            "left_thumb",
            "right_thumb",
            "left_hip",
            "right_hip",
            "left_knee",
            "right_knee",
            "left_ankle",
            "right_ankle",
            "left_heel",
            "right_heel",
            "left_foot_index",
            "right_foot_index",
        ]

        self.output_joint_names = {
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
            "left_heel",
            "right_heel",
            "left_foot_index",
            "right_foot_index",
            "hip_center",
        }

    def _normalize_name(self, name: str) -> str:
        return name.lower()

    def _create_landmarker(self):
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"MediaPipe task 모델 파일이 없습니다: {self.model_path}"
            )

        base_options = mp_python.BaseOptions(model_asset_path=str(self.model_path))
        options = mp_vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=mp_vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_segmentation_masks=False,
        )
        return mp_vision.PoseLandmarker.create_from_options(options)

    def _result_to_landmarks(self, result):
        if not result.pose_landmarks or len(result.pose_landmarks) == 0:
            return [], False

        image_landmarks = result.pose_landmarks[0]
        world_landmarks = result.pose_world_landmarks[0] if result.pose_world_landmarks else None

        output = []
        for idx, image_lm in enumerate(image_landmarks):
            if idx >= len(self.mp_task_joint_names):
                break

            raw_name = self.mp_task_joint_names[idx]
            name = self._normalize_name(raw_name)

            if name not in self.output_joint_names:
                continue

            world_lm = world_landmarks[idx] if world_landmarks is not None else None
            z_value = float(world_lm.z) if world_lm is not None else float(image_lm.z)

            output.append(
                {
                    "name": name,
                    "x": float(image_lm.x),
                    "y": float(image_lm.y),
                    "z": z_value,
                    "visibility": float(
                        getattr(image_lm, "visibility", getattr(image_lm, "presence", 1.0))
                    ),
                    "source": "mediapipe_tasks",
                }
            )

        landmark_map = {lm["name"]: lm for lm in output}
        if "left_hip" in landmark_map and "right_hip" in landmark_map:
            lh = landmark_map["left_hip"]
            rh = landmark_map["right_hip"]
            output.append(
                {
                    "name": "hip_center",
                    "x": float((lh["x"] + rh["x"]) / 2.0),
                    "y": float((lh["y"] + rh["y"]) / 2.0),
                    "z": float((lh["z"] + rh["z"]) / 2.0),
                    "visibility": float(min(lh["visibility"], rh["visibility"])),
                    "source": "mediapipe_tasks",
                }
            )

        return output, True

    def run(
        self,
        square_video_path: str,
        metadata_path: str,
        output_dir: str,
        viewtype: str,
    ) -> dict:
        square_video_path = Path(square_video_path)
        metadata_path = Path(metadata_path)
        output_dir = Path(output_dir)

        step_dir = output_dir / "step2_mediapipe" / viewtype
        step_dir.mkdir(parents=True, exist_ok=True)

        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        video_name = metadata["video"]
        pose_json_path = step_dir / f"{video_name}_mediapipe.json"

        cap = cv2.VideoCapture(str(square_video_path))
        if not cap.isOpened():
            raise ValueError(f"영상을 열 수 없습니다: {square_video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        frames_out = []

        with self._create_landmarker() as landmarker:
            frame_idx = 0

            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                timestamp_ms = int(frame_idx * 1000.0 / fps)

                result = landmarker.detect_for_video(mp_image, timestamp_ms)
                landmarks, has_pose = self._result_to_landmarks(result)

                frames_out.append(
                    {
                        "frame": int(frame_idx),
                        "timestamp": round(frame_idx / fps, 4),
                        "has_pose": bool(has_pose),
                        "landmarks": landmarks,
                    }
                )
                frame_idx += 1

        cap.release()

        poses_detected = sum(1 for frame in frames_out if frame["has_pose"])
        detection_rate = (poses_detected / len(frames_out) * 100.0) if frames_out else 0.0

        output = {
            "video": video_name,
            "viewtype": viewtype,
            "fps": float(fps),
            "totalframes": int(total_frames),
            "poses_detected": int(poses_detected),
            "detection_rate": round(detection_rate, 2),
            "landmark_names": sorted(self.output_joint_names),
            "pose_extraction": {
                "api": "mediapipe.tasks",
                "model": self.model_path.name,
                "mode": "VIDEO",
                "z_source": "pose_world_landmarks",
                "xy_source": "pose_landmarks",
            },
            "metadata": metadata.get("metadata"),
            "frames": frames_out,
        }

        with open(pose_json_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        return {
            "video_name": video_name,
            "viewtype": viewtype,
            "pose_json_path": str(pose_json_path),
            "fps": float(fps),
            "total_frames": int(total_frames),
            "poses_detected": int(poses_detected),
            "detection_rate": round(detection_rate, 2),
        }