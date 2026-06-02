import json
import numpy as np
from pathlib import Path
import glob


class UnityCoordinateConverter:
    """
    Step 3: MediaPipe 좌표를 Unity 3D 좌표로 변환

    주요 변환 (순서 중요!):
    1. 골반 중간점 기준 정규화: (left_hip + right_hip) / 2 → (0.0, 0.0)
    2. Y축 반전: MediaPipe (위→아래 증가) → Unity (아래→위 증가)
    3. Z축 스케일링: 과장된 깊이값 축소 (z_scale_factor 적용)

    디렉토리 구조:
    output_dir/
    ├── step2_mpp_landmarks/
    │   ├── face_on/
    │   ├── dtl/
    │   └── other/
    └── step3_unity_coords/
        ├── z_scale_0.1/         ← Z 스케일별 별도 저장
        │   ├── face_on/
        │   ├── dtl/
        │   └── other/
        ├── z_scale_0.2/
        ├── z_scale_0.3/
        └── z_scale_0.5/
    """

    # Step 2 coco_names 기준 전체 17개 keypoint
    COCO_KEYPOINTS = [
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
        'right_ankle'
    ]

    # Z축 축소 계수 테스트 후보 (다양한 경우의 수)
    Z_SCALE_CANDIDATES = [0.1, 0.2, 0.3, 0.5]

    def __init__(self, z_scale_factor=0.3):
        """
        Args:
            z_scale_factor: Z축 축소 계수 (기본값 0.3)
                            - 0.1: 깊이감 최소화 (거의 평면)
                            - 0.2: 약한 깊이감
                            - 0.3: 중간 깊이감 (권장)
                            - 0.5: 상대적으로 강한 깊이감
        """
        self.z_scale_factor = z_scale_factor

        # 골반 중간점 계산에 사용할 keypoint
        self.pelvis_keypoints = ['left_hip', 'right_hip']

    def compute_pelvis_midpoint(self, landmarks):
        """
        골반 중간점 계산: (left_hip + right_hip) / 2

        Args:
            landmarks: MediaPipe landmarks 리스트

        Returns:
            pelvis_x: 골반 중간점 x 좌표 (없으면 None)
            pelvis_y: 골반 중간점 y 좌표 (없으면 None)
        """
        if not landmarks:
            return None, None

        hip_coords = {
            lm['name']: {'x': lm['x'], 'y': lm['y']}
            for lm in landmarks
            if lm['name'] in self.pelvis_keypoints
        }

        # 좌우 골반 모두 있어야 중간점 계산 가능
        if 'left_hip' not in hip_coords or 'right_hip' not in hip_coords:
            return None, None

        pelvis_x = (hip_coords['left_hip']['x'] + hip_coords['right_hip']['x']) / 2.0
        pelvis_y = (hip_coords['left_hip']['y'] + hip_coords['right_hip']['y']) / 2.0

        return pelvis_x, pelvis_y

    def normalize_by_pelvis(self, landmarks):
        """
        Step 1: 골반 중간점을 (x=0.0, y=0.0) 기준으로 정규화

        Args:
            landmarks: MediaPipe landmarks 리스트 (원본)

        Returns:
            normalized_landmarks: 골반 중간점 기준 정규화된 landmarks
            pelvis_x: 기준점 원본 x 좌표 (없으면 None)
            pelvis_y: 기준점 원본 y 좌표 (없으면 None)
        """
        if not landmarks:
            return [], None, None

        pelvis_x, pelvis_y = self.compute_pelvis_midpoint(landmarks)

        if pelvis_x is None:
            # 골반을 찾을 수 없으면 원본 반환
            return landmarks, None, None

        # 모든 keypoint에서 골반 중간점 좌표 빼기
        normalized = []
        for lm in landmarks:
            normalized.append({
                'name': lm['name'],
                'x': lm['x'] - pelvis_x,   # 골반 중간점 x를 0.0으로
                'y': lm['y'] - pelvis_y,   # 골반 중간점 y를 0.0으로
                'z': lm['z'],
                'visibility': lm['visibility']
            })

        return normalized, pelvis_x, pelvis_y

    def flip_y_axis(self, landmarks):
        """
        Step 2: Y축 반전 (골반 기준 정규화 이후 적용)

        MediaPipe: Y가 위→아래 방향으로 증가
        Unity:     Y가 아래→위 방향으로 증가 (반전 필요)

        골반이 (0, 0)인 상태에서 반전하므로
        골반은 반전 후에도 (0, 0) 유지됨.

        Args:
            landmarks: 골반 기준으로 정규화된 landmarks

        Returns:
            flipped_landmarks: Y축이 반전된 landmarks
        """
        if not landmarks:
            return []

        flipped = []
        for lm in landmarks:
            flipped.append({
                'name': lm['name'],
                'x': lm['x'],
                'y': -lm['y'],  # Y축 반전 (0 기준이므로 골반은 (0,0) 유지)
                'z': lm['z'],
                'visibility': lm['visibility']
            })

        return flipped

    def scale_z_axis(self, landmarks):
        """
        Step 3: Z축 스케일링 (깊이값 과장 방지)

        MediaPipe Z값은 상대적 깊이 추정값으로
        실제보다 과장되는 경향이 있음.
        z_scale_factor를 곱하여 깊이감을 축소함.

        Args:
            landmarks: Y축 반전된 landmarks

        Returns:
            scaled_landmarks: Z축이 축소된 landmarks
        """
        if not landmarks:
            return []

        scaled = []
        for lm in landmarks:
            scaled.append({
                'name': lm['name'],
                'x': lm['x'],
                'y': lm['y'],
                'z': lm['z'] * self.z_scale_factor,  # Z축 축소
                'visibility': lm['visibility']
            })

        return scaled

    def validate_keypoints(self, landmarks):
        """
        landmarks에 포함된 keypoint 이름이 COCO_KEYPOINTS와 일치하는지 검증

        Args:
            landmarks: landmarks 리스트

        Returns:
            is_valid: bool
            missing: 누락된 keypoint 이름 리스트
            unknown: 알 수 없는 keypoint 이름 리스트
        """
        if not landmarks:
            return False, self.COCO_KEYPOINTS, []

        detected_names = {lm['name'] for lm in landmarks}
        expected_names = set(self.COCO_KEYPOINTS)

        missing = list(expected_names - detected_names)
        unknown = list(detected_names - expected_names)

        is_valid = (len(missing) == 0 and len(unknown) == 0)

        return is_valid, missing, unknown

    def process_single_video(self, landmarks_json_path, output_dir, view_type='face_on'):
        """
        Step 3: 단일 영상 Unity 좌표 변환

        Args:
            landmarks_json_path: Step 2 landmarks JSON 경로
            output_dir: 출력 디렉토리
            view_type: 'face_on', 'dtl', 또는 'other'

        Returns:
            result: 처리 결과 딕셔너리
        """
        # z_scale별 하위 디렉토리로 저장
        scale_dir = f"z_scale_{self.z_scale_factor}"
        step3_view_dir = Path(output_dir) / 'step3_unity_coords' / scale_dir / view_type
        step3_view_dir.mkdir(parents=True, exist_ok=True)

        # Step 2 데이터 로드
        with open(landmarks_json_path, 'r') as f:
            step2_data = json.load(f)

        video_name = step2_data['video']

        # keypoint 이름 검증 (첫 번째 포즈 있는 프레임으로 확인)
        first_pose_frame = next(
            (f for f in step2_data['frames'] if f['has_pose'] and f['landmarks']),
            None
        )
        if first_pose_frame:
            is_valid, missing, unknown = self.validate_keypoints(first_pose_frame['landmarks'])
            if not is_valid:
                if missing:
                    print(f"   ⚠️  누락된 keypoints: {missing}")
                if unknown:
                    print(f"   ⚠️  알 수 없는 keypoints: {unknown}")

        # 모든 프레임 변환
        unity_frames = []
        frames_with_pose = 0
        pelvis_missing_count = 0

        for frame_data in step2_data['frames']:

            # 1. 골반 중간점 기준 정규화 (먼저!)
            normalized, pelvis_x, pelvis_y = self.normalize_by_pelvis(frame_data['landmarks'])

            # 골반 못 찾은 프레임 카운트
            if frame_data['has_pose'] and pelvis_x is None:
                pelvis_missing_count += 1

            # 2. Y축 반전
            flipped = self.flip_y_axis(normalized)

            # 3. Z축 스케일링 (마지막!)
            scaled = self.scale_z_axis(flipped)

            unity_frame = {
                'frame': frame_data['frame'],
                'timestamp': frame_data['timestamp'],
                'has_pose': frame_data['has_pose'],
                'pelvis_found': pelvis_x is not None,
                'landmarks': scaled,
                'pelvis_midpoint_offset': {
                    'x': float(pelvis_x) if pelvis_x is not None else None,
                    'y': float(pelvis_y) if pelvis_y is not None else None
                }
            }

            unity_frames.append(unity_frame)

            if frame_data['has_pose']:
                frames_with_pose += 1

        # Unity 좌표 JSON 저장
        step3_json_path = step3_view_dir / f"{video_name}_unity.json"

        output_data = {
            'video': video_name,
            'view_type': view_type,
            'original_size': step2_data['original_size'],
            'fps': step2_data['fps'],
            'total_frames': step2_data['total_frames'],
            'frames_with_pose': frames_with_pose,
            'pelvis_missing_frames': pelvis_missing_count,
            'keypoint_count': len(self.COCO_KEYPOINTS),
            'keypoint_names': self.COCO_KEYPOINTS,
            'conversion': {
                'step1': 'normalize by pelvis_midpoint (left_hip + right_hip) / 2 → (0.0, 0.0)',
                'step2': 'flip y_axis → Unity coordinate (y = -y)',
                'step3': f'scale z_axis → z = z * {self.z_scale_factor}',
                'anchor': 'pelvis_midpoint',
                'z_scale_factor': self.z_scale_factor
            },
            'frames': unity_frames
        }

        with open(step3_json_path, 'w') as f:
            json.dump(output_data, f, indent=2)

        result = {
            'video_name': video_name,
            'view_type': view_type,
            'step3_json': str(step3_json_path),
            'total_frames': step2_data['total_frames'],
            'frames_with_pose': frames_with_pose,
            'pelvis_missing_frames': pelvis_missing_count
        }

        return result

    def process_batch(self, input_dir):
        """
        Step 3: 전체 영상 일괄 Unity 좌표 변환
        Step 2 결과물을 자동으로 읽어서 처리

        Args:
            input_dir: Step 2 출력 디렉토리 (동일)

        Returns:
            results: 처리 결과 리스트
        """
        step2_dir = Path(input_dir) / 'step2_mpp_landmarks'

        if not step2_dir.exists():
            raise ValueError(f"Step 2 디렉토리가 없습니다: {step2_dir}")

        # 모든 view_type 디렉토리 찾기
        view_dirs = [d for d in step2_dir.iterdir() if d.is_dir()]

        # 모든 landmarks JSON 찾기
        landmarks_files = []
        for view_dir in view_dirs:
            view_type = view_dir.name
            jsons = list(view_dir.glob("*_landmarks.json"))
            for json_file in jsons:
                landmarks_files.append({
                    'json': str(json_file),
                    'view_type': view_type
                })

        scale_dir = f"z_scale_{self.z_scale_factor}"

        print(f"\n{'='*60}")
        print(f"🎯 Step 3: Unity 좌표 변환")
        print(f"총 영상 수: {len(landmarks_files)}")
        print(f"기준점: pelvis_midpoint (left_hip + right_hip) / 2")
        print(f"Z축 축소 계수: {self.z_scale_factor}")
        print(f"출력 디렉토리: {input_dir}/step3_unity_coords/{scale_dir}/")
        print(f"{'='*60}")

        results = []

        for i, file_info in enumerate(landmarks_files):
            video_name = Path(file_info['json']).stem.replace('_landmarks', '')
            view_type = file_info['view_type']

            print(f"\n[{i+1}/{len(landmarks_files)}] {video_name}.mp4 [{view_type}] 처리 중...")

            try:
                result = self.process_single_video(
                    landmarks_json_path=file_info['json'],
                    output_dir=input_dir,
                    view_type=view_type
                )
                results.append(result)

                pelvis_warn = (
                    f" ⚠️ 골반 누락: {result['pelvis_missing_frames']}프레임"
                    if result['pelvis_missing_frames'] > 0 else ""
                )
                print(f"   ✅ 변환 완료: {result['frames_with_pose']}/{result['total_frames']} 프레임{pelvis_warn}")

            except Exception as e:
                print(f"   ❌ 오류: {str(e)}")
                results.append({
                    'video_name': video_name,
                    'view_type': view_type,
                    'error': str(e)
                })

        # View별 통계
        view_stats = {}
        for result in results:
            if 'error' not in result:
                view = result['view_type']
                if view not in view_stats:
                    view_stats[view] = 0
                view_stats[view] += 1

        # Step 3 요약 저장
        summary_path = Path(input_dir) / f'step3_summary_{scale_dir}.json'
        with open(summary_path, 'w') as f:
            json.dump({
                'step': 'step3_unity_coords',
                'z_scale_factor': self.z_scale_factor,
                'total_videos': len(landmarks_files),
                'successful': len([r for r in results if 'error' not in r]),
                'failed': len([r for r in results if 'error' in r]),
                'view_statistics': view_stats,
                'conversion_info': {
                    'step1': 'normalize by pelvis_midpoint (left_hip + right_hip) / 2 → (0.0, 0.0)',
                    'step2': 'flip y_axis → Unity coordinate (y = -y)',
                    'step3': f'scale z_axis → z = z * {self.z_scale_factor}',
                    'anchor': 'pelvis_midpoint',
                    'z_scale_factor': self.z_scale_factor
                },
                'results': results
            }, f, indent=2)

        print(f"\n{'='*60}")
        print(f"✅ Step 3 완료! [z_scale={self.z_scale_factor}]")
        print(f"성공: {len([r for r in results if 'error' not in r])}/{len(landmarks_files)}")
        print(f"실패: {len([r for r in results if 'error' in r])}/{len(landmarks_files)}")
        print(f"요약: {summary_path}")
        print(f"{'='*60}")

        print(f"\n📊 View별 통계:")
        for view, count in sorted(view_stats.items()):
            print(f"   {view}: {count}개")

        return results


# =============================================================================
# 사용 예시
# =============================================================================

if __name__ == "__main__":

    OUTPUT_DIR = "data/processed"

    print(f"\n{'='*60}")
    print(f"Step 3: Unity 좌표 변환 시작")
    print(f"입력: {OUTPUT_DIR}/step2_mpp_landmarks/")
    print(f"출력: {OUTPUT_DIR}/step3_unity_coords/")
    print(f"{'='*60}")

    print(f"\n🔄 변환 순서:")
    print(f"   1단계: 골반 중간점 기준 정규화")
    print(f"      - (left_hip + right_hip) / 2 계산")
    print(f"      - 모든 keypoint에서 골반 중간점 좌표 빼기")
    print(f"      - 결과: 골반 중간점이 (0.0, 0.0)에 위치")
    print(f"   2단계: Y축 반전")
    print(f"      - y_unity = -y_normalized")
    print(f"      - 골반 중간점은 (0, 0) 유지됨")
    print(f"   3단계: Z축 스케일링")
    print(f"      - z_unity = z * scale_factor")
    print(f"      - 과장된 깊이감 축소")

    # =========================================================
    # Z축 축소 계수별 테스트 실행
    # 원하는 scale_factor 하나만 골라서 사용해도 됨
    # =========================================================
    for z_scale in UnityCoordinateConverter.Z_SCALE_CANDIDATES:
        print(f"\n{'='*60}")
        print(f"🧪 Z Scale Factor = {z_scale} 테스트 실행")
        print(f"{'='*60}")

        converter = UnityCoordinateConverter(z_scale_factor=z_scale)
        step3_results = converter.process_batch(OUTPUT_DIR)

        print(f"\n🎉 z_scale={z_scale} 완료!")
        print(f"성공: {len([r for r in step3_results if 'error' not in r])} 영상")
        print(f"실패: {len([r for r in step3_results if 'error' in r])} 영상")
        print(f"저장 위치: {OUTPUT_DIR}/step3_unity_coords/z_scale_{z_scale}/")

    print(f"\n{'='*60}")
    print(f"✅ 전체 Z Scale 테스트 완료!")
    print(f"결과물 위치:")
    for z_scale in UnityCoordinateConverter.Z_SCALE_CANDIDATES:
        print(f"   z_scale_{z_scale}/  ← Unity에서 직접 비교 테스트")
    print(f"{'='*60}")
