"""
golf_swing_step3_unity.py
Step 3: Step 4 (SwingNet) 결과를 Unity 3D 좌표로 변환

[변경사항 vs 이전 버전]
1. Zero-Order Hold 제거 → 전체 프레임 Cubic Spline 보간으로 교체
   - 저신뢰도 구간을 NaN 처리 후 양방향 3차 스플라인으로 채움
   - 루프 전에 전체 데이터 일괄 처리 (서버 배치 처리 특성 활용)
2. Bone Length 정규화 추가
   - Address 프레임 기준 뼈 길이 측정
   - 각 프레임마다 15% 이상 벗어나면 재조정
3. Grip Constraint 추가
   - Address 기준 양 손목 2D 거리 고정
   - Z값 제외 (신뢰 불가) → 2D 거리 기준으로만 계산
   - 신뢰도 높은 손목을 anchor로 반대쪽 좌표 교정

변환 순서:
  ① Cubic Spline 보간 (전체 프레임)
  ② Bone Length 정규화
  ③ Grip Constraint
  ④ Address 프레임 골반 anchor 정규화
  ⑤ Y축 반전 (MediaPipe → Unity)
  ⑥ Z축 스케일링
"""

import json
import math
import numpy as np
import pandas as pd
from pathlib import Path


class UnityCoordinateConverter:

    COCO_KEYPOINTS = [
        'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
        'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
        'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
    ]

    # Cubic Spline 보간 대상: 가려지기 쉬운 관절
    OCCLUSION_PRONE = {
        'left_wrist', 'right_wrist',
        'left_elbow', 'right_elbow',
        'left_ankle', 'right_ankle',
        'left_knee', 'right_knee',
    }

    # Bone Length 정규화 대상 쌍 (2D x, y 기준)
    BONE_PAIRS = [
        ('left_shoulder',  'left_elbow'),
        ('left_elbow',     'left_wrist'),
        ('right_shoulder', 'right_elbow'),
        ('right_elbow',    'right_wrist'),
        ('left_hip',       'left_knee'),
        ('left_knee',      'left_ankle'),
        ('right_hip',      'right_knee'),
        ('right_knee',     'right_ankle'),
        ('left_shoulder',  'right_shoulder'),
        ('left_hip',       'right_hip'),
    ]

    # Bone Length 보정 허용 오차 (이 이상 벗어나면 재조정)
    BONE_TOLERANCE = 0.15  # 15%

    # Grip Constraint 허용 오차
    GRIP_TOLERANCE = 0.03  # 3%

    def __init__(self, z_scale_factor=0.3, visibility_threshold=0.5):
        self.z_scale_factor = z_scale_factor
        self.visibility_threshold = visibility_threshold

    # ──────────────────────────────────────────────────────
    # ① Cubic Spline 보간
    # ──────────────────────────────────────────────────────

    def _cubic_spline_interpolate(self, frames):
        """
        OCCLUSION_PRONE 관절의 저신뢰도 구간을 NaN으로 마킹 후
        전체 프레임 기준 양방향 Cubic Spline 보간.

        Zero-Order Hold(이전 프레임 복사)와 달리, 앞뒤 정상 좌표를
        모두 참조하므로 빠른 동작 구간에서도 궤적이 자연스럽게 이어짐.
        """
        records = []
        for f in frames:
            row = {}
            if f.get('has_pose') and f.get('landmarks'):
                for lm in f['landmarks']:
                    name = lm['name']
                    vis = lm.get('visibility', 1.0)
                    if name in self.OCCLUSION_PRONE and vis < self.visibility_threshold:
                        row[f'{name}_x'] = np.nan
                        row[f'{name}_y'] = np.nan
                        row[f'{name}_z'] = np.nan
                    else:
                        row[f'{name}_x'] = lm['x']
                        row[f'{name}_y'] = lm['y']
                        row[f'{name}_z'] = lm['z']
            else:
                for name in self.COCO_KEYPOINTS:
                    row[f'{name}_x'] = np.nan
                    row[f'{name}_y'] = np.nan
                    row[f'{name}_z'] = np.nan
            records.append(row)

        df = pd.DataFrame(records)
        coord_cols = [c for c in df.columns if c.endswith(('_x', '_y', '_z'))]

        # 양방향 Cubic Spline 보간 후 경계 처리
        df[coord_cols] = df[coord_cols].interpolate(
            method='cubic', limit_direction='both'
        )
        df[coord_cols] = df[coord_cols].bfill().ffill()

        # frames에 반영
        for i, f in enumerate(frames):
            if not f.get('has_pose') or not f.get('landmarks'):
                continue
            for lm in f['landmarks']:
                name = lm['name']
                x_val = df.at[i, f'{name}_x']
                y_val = df.at[i, f'{name}_y']
                z_val = df.at[i, f'{name}_z']
                if not np.isnan(x_val):
                    lm['x'] = float(x_val)
                if not np.isnan(y_val):
                    lm['y'] = float(y_val)
                if not np.isnan(z_val):
                    lm['z'] = float(z_val)

        return frames

    # ──────────────────────────────────────────────────────
    # ② Bone Length 정규화
    # ──────────────────────────────────────────────────────

    def _compute_bone_lengths(self, landmarks):
        """Address 프레임 기준 뼈 길이 측정 (2D)"""
        lm_dict = {lm['name']: lm for lm in landmarks}
        lengths = {}
        for (p1, p2) in self.BONE_PAIRS:
            if p1 in lm_dict and p2 in lm_dict:
                a, b = lm_dict[p1], lm_dict[p2]
                dist = math.sqrt((a['x'] - b['x'])**2 + (a['y'] - b['y'])**2)
                if dist > 1e-6:
                    lengths[(p1, p2)] = dist
        return lengths

    def _enforce_bone_length(self, frames, ref_lengths):
        """
        각 프레임에서 뼈 길이가 ref_lengths 기준 BONE_TOLERANCE 이상 벗어나면
        endpoint(b)를 anchor(a) 기준으로 재조정.
        2D(x, y) 기준으로만 처리 (z는 world 좌표이므로 스케일 혼용 방지).
        """
        for f in frames:
            if not f.get('has_pose') or not f.get('landmarks'):
                continue
            lm_dict = {lm['name']: lm for lm in f['landmarks']}
            for (p1, p2), ref_len in ref_lengths.items():
                if p1 not in lm_dict or p2 not in lm_dict:
                    continue
                a, b = lm_dict[p1], lm_dict[p2]
                dx = b['x'] - a['x']
                dy = b['y'] - a['y']
                cur_len = math.sqrt(dx**2 + dy**2)
                if cur_len < 1e-6:
                    continue
                ratio = abs(cur_len - ref_len) / ref_len
                if ratio > self.BONE_TOLERANCE:
                    scale = ref_len / cur_len
                    b['x'] = a['x'] + dx * scale
                    b['y'] = a['y'] + dy * scale
        return frames

    # ──────────────────────────────────────────────────────
    # ③ Grip Constraint
    # ──────────────────────────────────────────────────────

    def _enforce_grip_constraint(self, frames, address_frame_idx):
        """
        Address 프레임 기준 양 손목 2D 거리를 고정.

        Z값 제외 이유:
          - x, y: 이미지 정규화 좌표 (동일 스케일)
          - z: world 미터 단위 → 스케일이 달라 3D 거리 계산 시 오차 발생

        신뢰도 높은 손목을 anchor로 반대쪽 좌표를 교정.
        """
        frame_dict = {f['frame']: f for f in frames}
        addr_frame = frame_dict.get(address_frame_idx)

        if not addr_frame or not addr_frame.get('has_pose'):
            return frames

        addr_lm = {lm['name']: lm for lm in addr_frame['landmarks']}
        if 'left_wrist' not in addr_lm or 'right_wrist' not in addr_lm:
            return frames

        lw0 = addr_lm['left_wrist']
        rw0 = addr_lm['right_wrist']
        base_dist = math.sqrt((lw0['x'] - rw0['x'])**2 + (lw0['y'] - rw0['y'])**2)

        if base_dist < 1e-6:
            return frames

        for f in frames:
            if not f.get('has_pose') or not f.get('landmarks'):
                continue
            lm_dict = {lm['name']: lm for lm in f['landmarks']}
            if 'left_wrist' not in lm_dict or 'right_wrist' not in lm_dict:
                continue

            lw = lm_dict['left_wrist']
            rw = lm_dict['right_wrist']
            dx = rw['x'] - lw['x']
            dy = rw['y'] - lw['y']
            cur_dist = math.sqrt(dx**2 + dy**2)

            if cur_dist < 1e-6:
                continue
            if abs(cur_dist - base_dist) / base_dist <= self.GRIP_TOLERANCE:
                continue

            # 신뢰도 높은 쪽을 anchor
            if lw.get('visibility', 0) >= rw.get('visibility', 0):
                anchor, target = lw, rw
            else:
                anchor, target = rw, lw

            dx = target['x'] - anchor['x']
            dy = target['y'] - anchor['y']
            scale = base_dist / cur_dist
            target['x'] = anchor['x'] + dx * scale
            target['y'] = anchor['y'] + dy * scale

        return frames

    # ──────────────────────────────────────────────────────
    # ④ Address anchor 고정
    # ──────────────────────────────────────────────────────

    def _get_address_anchor(self, frames, address_frame_idx):
        search_order = []
        if address_frame_idx is not None:
            search_order.append(address_frame_idx)
        for f in frames:
            fidx = f.get('frame', -1)
            if fidx not in search_order:
                search_order.append(fidx)

        frame_dict = {f['frame']: f for f in frames}

        for fidx in search_order:
            frame_data = frame_dict.get(fidx)
            if not frame_data or not frame_data.get('has_pose'):
                continue
            hip_coords = {
                lm['name']: lm for lm in frame_data.get('landmarks', [])
                if lm['name'] in ('left_hip', 'right_hip')
            }
            if 'left_hip' in hip_coords and 'right_hip' in hip_coords:
                ax = (hip_coords['left_hip']['x'] + hip_coords['right_hip']['x']) / 2.0
                ay = (hip_coords['left_hip']['y'] + hip_coords['right_hip']['y']) / 2.0
                return ax, ay, fidx

        return None, None, None

    # ──────────────────────────────────────────────────────
    # ⑤⑥ 좌표 변환 헬퍼
    # ──────────────────────────────────────────────────────

    def _normalize(self, landmarks, anchor_x, anchor_y):
        return [{**lm, 'x': lm['x'] - anchor_x, 'y': lm['y'] - anchor_y}
                for lm in landmarks]

    def _flip_y(self, landmarks):
        return [{**lm, 'y': -lm['y']} for lm in landmarks]

    def _scale_z(self, landmarks):
        return [{**lm, 'z': lm['z'] * self.z_scale_factor} for lm in landmarks]

    # ──────────────────────────────────────────────────────
    # 메인 처리
    # ──────────────────────────────────────────────────────

    def process_single_video(self, step4_json_path, output_dir, view_type='face_on'):
        scale_dir = f"z_scale_{self.z_scale_factor}"
        out_dir = Path(output_dir) / 'step3_unity_coords' / scale_dir / view_type
        out_dir.mkdir(parents=True, exist_ok=True)

        with open(step4_json_path, 'r') as f:
            step4_data = json.load(f)

        video_name = step4_data['video']
        frames = step4_data['frames']

        events = step4_data.get('events', {})
        address_info = events.get('address', {})
        address_frame_idx = (
            address_info.get('frame') if isinstance(address_info, dict)
            else address_info
        )

        # ─── 전처리 파이프라인 (루프 전 일괄 처리) ───

        # ① Cubic Spline 보간
        frames = self._cubic_spline_interpolate(frames)

        # Address 기준 뼈 길이 측정 (② 전에 필요)
        ref_lengths = {}
        if address_frame_idx is not None:
            frame_dict = {f['frame']: f for f in frames}
            addr_frame = frame_dict.get(address_frame_idx)
            if addr_frame and addr_frame.get('has_pose') and addr_frame.get('landmarks'):
                ref_lengths = self._compute_bone_lengths(addr_frame['landmarks'])

        # ② Bone Length 정규화
        if ref_lengths:
            frames = self._enforce_bone_length(frames, ref_lengths)

        # ③ Grip Constraint
        if address_frame_idx is not None:
            frames = self._enforce_grip_constraint(frames, address_frame_idx)

        # ④ Address anchor 고정
        anchor_x, anchor_y, anchor_used_frame = self._get_address_anchor(
            frames, address_frame_idx
        )
        anchor_found = anchor_x is not None

        if not anchor_found:
            print(f"  ⚠️  [{video_name}] anchor 없음 — 정규화 스킵")
        elif anchor_used_frame != address_frame_idx:
            print(f"  ⚠️  [{video_name}] Address 프레임 골반 없음 → frame {anchor_used_frame} fallback")

        # ─── 프레임별 좌표 변환 ───
        unity_frames = []
        frames_with_pose = 0

        for frame_data in frames:
            landmarks = frame_data.get('landmarks', [])
            has_pose = frame_data.get('has_pose', False)

            if has_pose and landmarks:
                # ④ anchor 정규화
                processed = self._normalize(landmarks, anchor_x, anchor_y) if anchor_found else landmarks
                # ⑤ Y축 반전
                processed = self._flip_y(processed)
                # ⑥ Z축 스케일
                processed = self._scale_z(processed)
                frames_with_pose += 1
            else:
                processed = []

            unity_frames.append({
                'frame': frame_data['frame'],
                'timestamp': frame_data['timestamp'],
                'has_pose': has_pose,
                'landmarks': processed,
            })

        # 저장
        out_path = out_dir / f"{video_name}_unity.json"
        output_data = {
            'video': video_name,
            'view_type': view_type,
            'original_size': step4_data.get('original_size'),
            'fps': step4_data.get('fps'),
            'total_frames': step4_data.get('total_frames'),
            'frames_with_pose': frames_with_pose,
            'keypoint_count': len(self.COCO_KEYPOINTS),
            'keypoint_names': self.COCO_KEYPOINTS,
            'events': events,
            'preprocessing': {
                'step1': 'cubic_spline_interpolation (양방향, 저신뢰도 관절)',
                'step2': f'bone_length_normalization (tolerance={self.BONE_TOLERANCE*100:.0f}%, ref=address_frame)',
                'step3': f'grip_constraint (tolerance={self.GRIP_TOLERANCE*100:.0f}%, 2D 기준)',
                'occlusion_prone': list(self.OCCLUSION_PRONE),
                'visibility_threshold': self.visibility_threshold,
            },
            'conversion': {
                'step4': f'anchor = Address frame(#{address_frame_idx}) pelvis midpoint',
                'step5': 'flip y_axis (y = -y)',
                'step6': f'scale z_axis (z = z * {self.z_scale_factor})',
                'anchor_frame_used': anchor_used_frame,
                'anchor_value': {'x': anchor_x, 'y': anchor_y} if anchor_found else None,
            },
            'frames': unity_frames,
        }

        with open(out_path, 'w') as f:
            json.dump(output_data, f, indent=2)

        return {
            'video_name': video_name,
            'view_type': view_type,
            'step3_json': str(out_path),
            'total_frames': step4_data.get('total_frames'),
            'frames_with_pose': frames_with_pose,
            'anchor_frame': anchor_used_frame,
        }

    def process_batch(self, input_dir):
        step4_dir = Path(input_dir) / 'step4_swingnet'
        if not step4_dir.exists():
            raise ValueError(f"Step 4 디렉토리가 없습니다: {step4_dir}")

        event_files = []
        for view_dir in [d for d in step4_dir.iterdir() if d.is_dir()]:
            for json_file in view_dir.glob("*_events.json"):
                event_files.append({
                    'json': str(json_file),
                    'view_type': view_dir.name,
                })

        scale_dir = f"z_scale_{self.z_scale_factor}"
        print(f"\n{'='*60}")
        print(f"Step 3: Unity 좌표 변환 (Step 4 기반)")
        print(f"  총 영상: {len(event_files)}개")
        print(f"  Z scale: {self.z_scale_factor} | Visibility threshold: {self.visibility_threshold}")
        print(f"  전처리: Cubic Spline → Bone Length → Grip Constraint")
        print(f"  출력: {input_dir}/step3_unity_coords/{scale_dir}/")
        print(f"{'='*60}")

        results = []
        for i, file_info in enumerate(event_files):
            video_name = Path(file_info['json']).stem.replace('_events', '')
            view_type = file_info['view_type']
            print(f"[{i+1}/{len(event_files)}] {video_name} [{view_type}]", end=' ')
            try:
                result = self.process_single_video(
                    step4_json_path=file_info['json'],
                    output_dir=input_dir,
                    view_type=view_type,
                )
                results.append(result)
                print(f"✅ | anchor: frame#{result['anchor_frame']}")
            except Exception as e:
                print(f"❌ {e}")
                results.append({
                    'video_name': video_name,
                    'view_type': view_type,
                    'error': str(e),
                })

        summary_path = Path(input_dir) / f'step3_summary_{scale_dir}.json'
        with open(summary_path, 'w') as f:
            json.dump({
                'step': 'step3_unity_coords',
                'source': 'step4_swingnet',
                'z_scale_factor': self.z_scale_factor,
                'visibility_threshold': self.visibility_threshold,
                'preprocessing': ['cubic_spline', 'bone_length', 'grip_constraint'],
                'total_videos': len(event_files),
                'successful': len([r for r in results if 'error' not in r]),
                'failed': len([r for r in results if 'error' in r]),
                'results': results,
            }, f, indent=2)

        print(f"\n✅ Step 3 완료! 성공: {len([r for r in results if 'error' not in r])}/{len(event_files)}")
        print(f"요약: {summary_path}")
        return results


# =============================================================================
if __name__ == "__main__":
    OUTPUT_DIR = "data/processed"
    converter = UnityCoordinateConverter(z_scale_factor=0.3, visibility_threshold=0.5)
    results = converter.process_batch(OUTPUT_DIR)