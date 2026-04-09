"""
golf_swing_preprocessor_step1_2.py
Step 1: 정사각형 패딩 (1024x1024)
Step 2: MediaPipe Pose 추출 (COCO 17 keypoints)

[mediapipe 0.10+ Tasks API 적용]
- mp.solutions.pose → mediapipe.tasks.vision.PoseLandmarker
- 모델: pose_landmarker_heavy.task (별도 다운로드 필요)
- x, y: pose_landmarks       (이미지 정규화 좌표, 2D 위치 신뢰도 높음)
- z:    pose_world_landmarks  (world 3D 미터 단위, 깊이 신뢰도 높음)
- wx, wy: pose_world_landmarks (미터 단위, Bone Length 계산용)
- smooth 비활성화 → step3 Cubic Spline으로 처리
- global_timestamp_ms: 영상 간 타임스탬프 단조증가 보장 (모델 1회만 로드)

모델 다운로드:
  curl -o pose_landmarker_heavy.task https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
"""

import cv2
import mediapipe as mp
import numpy as np
import json
import glob
import pandas as pd
from pathlib import Path


class GolfSwingPreprocessor:
    """
    GolfDB 영상을 Unity 3D 시뮬레이션용으로 전처리

    Step 1: 정사각형 패딩 (1024x1024)
    Step 2: MediaPipe Pose 추출 (COCO 17 keypoints)

    디렉토리 구조:
    output_dir/
    ├── step1_square_padded/
    │   ├── face_on/
    │   ├── dtl/
    │   └── other/
    └── step2_mpp_landmarks/
        ├── face_on/
        ├── dtl/
        └── other/
    """

    def __init__(self, target_size=1024):
        self.target_size = target_size
        self.mp_pose = None
        self.global_timestamp_ms = 0  # 영상 간 타임스탬프 단조증가용

        # COCO 17 keypoints 매핑 (MediaPipe 인덱스 → COCO 이름)
        self.coco_indices = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
        self.coco_names = [
            'nose',
            'left_eye',
            'right_eye',
            'left_ear',
            'right_ear',
            'left_shoulder',
            'right_shoulder',
            'left_elbow',
            'right_elbow',
            'left_wrist',
            'right_wrist',
            'left_hip',
            'right_hip',
            'left_knee',
            'right_knee',
            'left_ankle',
            'right_ankle',
        ]

    # ──────────────────────────────────────────────────────
    # GolfDB CSV
    # ──────────────────────────────────────────────────────

    def load_golfdb_csv(self, csv_path='archive/GolfDB.csv'):
        df = pd.read_csv(csv_path)
        view_rename = {
            'face-on':       'face_on',
            'down-the-line': 'dtl',
            'other':         'other',
        }
        df['view_normalized'] = df['view'].map(view_rename)
        view_mapping = dict(zip(df['id'].astype(str), df['view_normalized']))

        print(f"\n📋 GolfDB.csv 로드 완료:")
        print(f"   총 영상: {len(df)}개")
        print(f"   - face-on:       {(df['view'] == 'face-on').sum()}개")
        print(f"   - down-the-line: {(df['view'] == 'down-the-line').sum()}개")
        print(f"   - other:         {(df['view'] == 'other').sum()}개")
        return view_mapping

    # ──────────────────────────────────────────────────────
    # Step 1: 정사각형 패딩
    # ──────────────────────────────────────────────────────

    def make_square_padding(self, frame):
        h, w = frame.shape[:2]

        if h > w:
            new_h = self.target_size
            new_w = int(w * (self.target_size / h))
        else:
            new_w = self.target_size
            new_h = int(h * (self.target_size / w))

        resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        square  = np.zeros((self.target_size, self.target_size, 3), dtype=np.uint8)

        y_offset = (self.target_size - new_h) // 2
        x_offset = (self.target_size - new_w) // 2
        square[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = resized

        metadata = {
            'original_size': {'width': int(w), 'height': int(h)},
            'resized_size':  {'width': int(new_w), 'height': int(new_h)},
            'offset':        {'x': int(x_offset), 'y': int(y_offset)},
            'target_size':   self.target_size,
            'is_square':     (h == w),
            'aspect_ratio':  round(w / h if h > 0 else 1.0, 3),
            'padding_added': (h != w),
        }
        return square, metadata

    def process_step1_single(self, video_path, output_dir, view_type='other'):
        step1_view_dir = Path(output_dir) / 'step1_square_padded' / view_type
        step1_view_dir.mkdir(parents=True, exist_ok=True)

        video_name = Path(video_path).stem
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"영상을 열 수 없습니다: {video_path}")

        fps          = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        step1_video_path = step1_view_dir / f"{video_name}_square.mp4"
        fourcc    = cv2.VideoWriter_fourcc(*'mp4v')
        out_video = cv2.VideoWriter(
            str(step1_video_path), fourcc, fps,
            (self.target_size, self.target_size)
        )

        metadata_list = []
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            square_frame, metadata = self.make_square_padding(frame)
            out_video.write(square_frame)
            if frame_idx == 0:
                metadata_list.append(metadata)
            frame_idx += 1

        cap.release()
        out_video.release()

        metadata_json_path = step1_view_dir / f"{video_name}_metadata.json"
        with open(metadata_json_path, 'w') as f:
            json.dump({
                'video':         video_name,
                'video_path':    str(video_path),
                'view_type':     view_type,
                'original_size': {'width': width, 'height': height},
                'target_size':   self.target_size,
                'fps':           fps,
                'total_frames':  total_frames,
                'metadata':      metadata_list[0] if metadata_list else None,
            }, f, indent=2)

        return {
            'video_name':    video_name,
            'view_type':     view_type,
            'step1_video':   str(step1_video_path),
            'step1_metadata': str(metadata_json_path),
            'total_frames':  total_frames,
            'original_size': f"{width}x{height}",
            'is_square':     metadata_list[0]['is_square']    if metadata_list else False,
            'aspect_ratio':  metadata_list[0]['aspect_ratio'] if metadata_list else 1.0,
            'padding_added': metadata_list[0]['padding_added'] if metadata_list else False,
        }

    def process_step1_batch(self, video_list, output_dir, view_mapping):
        results = []

        print(f"\n{'='*60}")
        print(f"📹 Step 1: 정사각형 패딩 ({self.target_size}x{self.target_size})")
        print(f"   총 영상 수: {len(video_list)}")
        print(f"   출력 디렉토리: {output_dir}/step1_square_padded/")
        print(f"{'='*60}")

        for i, video_path in enumerate(video_list):
            video_name = Path(video_path).stem
            view_type  = view_mapping.get(video_name, 'other')
            print(f"\n[{i+1}/{len(video_list)}] {video_name}.mp4 [{view_type}] 처리 중...")
            try:
                result = self.process_step1_single(video_path, output_dir, view_type)
                results.append(result)
                print(f"  ✅ 완료: {result['original_size']} → {self.target_size}x{self.target_size}")
            except Exception as e:
                print(f"  ❌ 오류: {str(e)}")
                results.append({
                    'video_name': video_name,
                    'view_type':  view_type,
                    'video_path': str(video_path),
                    'error':      str(e),
                })

        successful = [r for r in results if 'error' not in r]
        view_stats = {}
        for r in successful:
            v = r['view_type']
            view_stats[v] = view_stats.get(v, 0) + 1

        summary_path = Path(output_dir) / 'step1_summary.json'
        with open(summary_path, 'w') as f:
            json.dump({
                'step':            'step1_square_padded',
                'total_videos':    len(video_list),
                'successful':      len(successful),
                'failed':          len([r for r in results if 'error' in r]),
                'target_size':     self.target_size,
                'view_statistics': view_stats,
                'results':         results,
            }, f, indent=2)

        print(f"\n{'='*60}")
        print(f"✅ Step 1 완료! 성공: {len(successful)}/{len(video_list)}")
        print(f"{'='*60}")
        for view, count in sorted(view_stats.items()):
            print(f"  {view}: {count}개")

        return results

    # ──────────────────────────────────────────────────────
    # Step 2: MediaPipe Pose 추출 (0.10+ Tasks API)
    # ──────────────────────────────────────────────────────

    def _init_mediapipe(self, model_path='pose_landmarker_heavy.task'):
        """
        mediapipe 0.10+ Tasks API 초기화

        RunningMode.VIDEO:
          - 단조증가 타임스탬프 필요
          - global_timestamp_ms로 영상 간 연속성 보장 → 모델 1회만 로드
          - smooth 옵션 없음 → step3 Cubic Spline으로 대체
        """
        from mediapipe.tasks import python as mp_python
        from mediapipe.tasks.python import vision as mp_vision

        if not Path(model_path).exists():
            raise FileNotFoundError(
                f"\n❌ 모델 파일 없음: {model_path}\n"
                f"아래 명령어로 다운로드:\n"
                f"  curl -o {model_path} https://storage.googleapis.com/mediapipe-models/"
                f"pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task\n"
            )

        base_options = mp_python.BaseOptions(model_asset_path=model_path)
        options = mp_vision.PoseLandmarkerOptions(
            base_options=base_options,
            output_segmentation_masks=False,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            running_mode=mp_vision.RunningMode.VIDEO,
        )
        self.mp_pose = mp_vision.PoseLandmarker.create_from_options(options)
        self.global_timestamp_ms = 0  # 초기화 시 리셋
        print(f"  ✅ PoseLandmarker (heavy, VIDEO mode) 초기화 완료")

    def extract_pose(self, frame, fps=30.0):
        """
        [mediapipe 0.10+ Tasks API]
        - global_timestamp_ms: 영상이 바뀌어도 단조증가 보장
          → VIDEO 모드 단일 인스턴스 유지 가능 (모델 1회만 로드)

        x, y: pose_landmarks      (2D 이미지 좌표, 신뢰도 높음)
        z:    pose_world_landmarks (깊이, 미터 단위, 신뢰도 높음)
        wx, wy: pose_world_landmarks (미터 단위, step3 Bone Length 계산용)
        """
        rgb      = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        # 전역 타임스탬프 증가 (영상 간 단조증가 보장)
        self.global_timestamp_ms += int(1000.0 / max(fps, 1.0))
        result = self.mp_pose.detect_for_video(mp_image, self.global_timestamp_ms)

        if (not result.pose_landmarks or
                len(result.pose_landmarks) == 0 or
                not result.pose_world_landmarks or
                len(result.pose_world_landmarks) == 0):
            return None

        img_lms   = result.pose_landmarks[0]
        world_lms = result.pose_world_landmarks[0]

        landmarks = []
        for idx, name in zip(self.coco_indices, self.coco_names):
            img_lm   = img_lms[idx]
            world_lm = world_lms[idx]
            landmarks.append({
                'name':       name,
                'x':          float(img_lm.x),
                'y':          float(img_lm.y),
                'z':          float(world_lm.z),
                'wx':         float(world_lm.x),
                'wy':         float(world_lm.y),
                'visibility': float(getattr(img_lm, 'visibility', 1.0)),
            })

        return landmarks

    def process_step2_single(self, square_video_path, metadata_path, output_dir, view_type='other'):
        step2_view_dir = Path(output_dir) / 'step2_mpp_landmarks' / view_type
        step2_view_dir.mkdir(parents=True, exist_ok=True)

        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        video_name = metadata['video']
        cap = cv2.VideoCapture(square_video_path)
        if not cap.isOpened():
            raise ValueError(f"영상을 열 수 없습니다: {square_video_path}")

        fps          = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        all_frames_data = []
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # frame_idx 제거 (global_timestamp_ms 사용)
            landmarks = self.extract_pose(frame, fps=fps)
            frame_data = {
                'frame':     frame_idx,
                'timestamp': frame_idx / fps if fps > 0 else 0,
                'landmarks': landmarks if landmarks else [],
                'has_pose':  landmarks is not None,
            }
            all_frames_data.append(frame_data)
            frame_idx += 1

        cap.release()

        poses_detected = sum(1 for f in all_frames_data if f['has_pose'])
        detection_rate = (poses_detected / len(all_frames_data) * 100) if all_frames_data else 0

        step2_json_path = step2_view_dir / f"{video_name}_landmarks.json"
        output_data = {
            'video':            video_name,
            'view_type':        view_type,
            'target_size':      self.target_size,
            'original_size':    metadata['original_size'],
            'fps':              fps,
            'total_frames':     total_frames,
            'processed_frames': len(all_frames_data),
            'poses_detected':   poses_detected,
            'detection_rate':   f"{detection_rate:.2f}%",
            'keypoint_count':   len(self.coco_indices),
            'keypoint_names':   self.coco_names,
            'pose_extraction': {
                'api':       'mediapipe.tasks (0.10+)',
                'model':     'pose_landmarker_heavy',
                'mode':      'VIDEO (global_timestamp_ms)',
                'z_source':  'pose_world_landmarks (world 3D, 미터 단위)',
                'xy_source': 'pose_landmarks (이미지 정규화 좌표)',
                'smooth':    'disabled (step3 cubic spline으로 처리)',
            },
            'metadata': metadata['metadata'],
            'frames':   all_frames_data,
        }

        with open(step2_json_path, 'w') as f:
            json.dump(output_data, f, indent=2)

        return {
            'video_name':     video_name,
            'view_type':      view_type,
            'step2_json':     str(step2_json_path),
            'total_frames':   total_frames,
            'poses_detected': poses_detected,
            'detection_rate': detection_rate,
        }

    def process_step2_batch(self, output_dir, model_path='pose_landmarker_heavy.task'):
        print(f"\n{'='*60}")
        print(f"🤖 PoseLandmarker (mediapipe 0.10+, VIDEO mode) 초기화 중...")
        print(f"{'='*60}")

        # 모델 1회만 로드
        self._init_mediapipe(model_path=model_path)

        step1_dir = Path(output_dir) / 'step1_square_padded'
        if not step1_dir.exists():
            raise ValueError(f"Step 1 디렉토리가 없습니다: {step1_dir}")

        square_videos = []
        for view_dir in [d for d in step1_dir.iterdir() if d.is_dir()]:
            view_type = view_dir.name
            for video in view_dir.glob("*_square.mp4"):
                metadata_file = video.parent / f"{video.stem.replace('_square', '_metadata')}.json"
                if metadata_file.exists():
                    square_videos.append({
                        'video':     str(video),
                        'metadata':  str(metadata_file),
                        'view_type': view_type,
                    })

        print(f"\n{'='*60}")
        print(f"🎯 Step 2: MediaPipe Pose 추출")
        print(f"   총 영상 수: {len(square_videos)}")
        print(f"   API: mediapipe.tasks 0.10+ | 모델: pose_landmarker_heavy")
        print(f"   mode: VIDEO (global_timestamp_ms, 모델 1회 로드)")
        print(f"   z_source: pose_world_landmarks (world 3D 미터 단위)")
        print(f"   추출 Keypoints ({len(self.coco_indices)}개): {', '.join(self.coco_names)}")
        print(f"   출력 디렉토리: {output_dir}/step2_mpp_landmarks/")
        print(f"{'='*60}")

        results = []
        for i, video_info in enumerate(square_videos):
            video_name = Path(video_info['video']).stem.replace('_square', '')
            view_type  = video_info['view_type']
            print(f"\n[{i+1}/{len(square_videos)}] {video_name}.mp4 [{view_type}] 처리 중...")
            try:
                result = self.process_step2_single(
                    square_video_path=video_info['video'],
                    metadata_path=video_info['metadata'],
                    output_dir=output_dir,
                    view_type=view_type,
                )
                results.append(result)
                print(f"  ✅ Pose 검출: {result['poses_detected']}/{result['total_frames']} "
                      f"({result['detection_rate']:.1f}%)")
            except Exception as e:
                print(f"  ❌ 오류: {str(e)}")
                results.append({
                    'video_name': video_name,
                    'view_type':  view_type,
                    'error':      str(e),
                })

        # 루프 끝난 후 한 번만 닫기
        if self.mp_pose:
            self.mp_pose.close()

        successful = [r for r in results if 'error' not in r]
        view_stats = {}
        for r in successful:
            v = r['view_type']
            view_stats[v] = view_stats.get(v, 0) + 1

        summary_path = Path(output_dir) / 'step2_summary.json'
        with open(summary_path, 'w') as f:
            json.dump({
                'step':           'step2_mpp_landmarks',
                'total_videos':   len(square_videos),
                'successful':     len(successful),
                'failed':         len([r for r in results if 'error' in r]),
                'keypoint_count': len(self.coco_indices),
                'keypoint_names': self.coco_names,
                'pose_extraction': {
                    'api':    'mediapipe.tasks (0.10+)',
                    'model':  'pose_landmarker_heavy',
                    'mode':   'VIDEO (global_timestamp_ms)',
                    'z_source': 'pose_world_landmarks',
                },
                'view_statistics': view_stats,
                'results': results,
            }, f, indent=2)

        print(f"\n{'='*60}")
        print(f"✅ Step 2 완료! 성공: {len(successful)}/{len(square_videos)}")
        print(f"   요약: {summary_path}")
        print(f"{'='*60}")

        if successful:
            avg_det = sum(r.get('detection_rate', 0) for r in successful) / len(successful)
            print(f"\n📊 평균 Pose 검출률: {avg_det:.1f}%")

        return results


# =============================================================================
if __name__ == "__main__":
    GOLFDB_VIDEO_DIR = "archive/videos_160/videos_160"
    GOLFDB_CSV       = "archive/GolfDB.csv"
    OUTPUT_DIR       = "data/processed"
    MODEL_PATH       = "pose_landmarker_heavy.task"

    preprocessor = GolfSwingPreprocessor(target_size=1024)
    view_mapping  = preprocessor.load_golfdb_csv(GOLFDB_CSV)
    video_files   = sorted(glob.glob(f"{GOLFDB_VIDEO_DIR}/*.mp4"))

    if not video_files:
        print("❌ 영상을 찾을 수 없습니다. 경로를 확인하세요.")
        exit(1)

    print(f"발견된 영상 수: {len(video_files)}")

    # step1_results = preprocessor.process_step1_batch(
    #     video_list=video_files,
    #     output_dir=OUTPUT_DIR,
    #     view_mapping=view_mapping,
    # )

    step2_results = preprocessor.process_step2_batch(
        output_dir=OUTPUT_DIR,
        model_path=MODEL_PATH,
    )

    print(f"\n{'='*60}")
    print(f"🎉 전체 처리 완료!")
    print(f"Step 2: {len([r for r in step2_results if 'error' not in r])}/{len(video_files)} 성공")
    print(f"출력 디렉토리: {OUTPUT_DIR}")