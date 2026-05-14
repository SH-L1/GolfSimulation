"""
fix_swingnet_events.py
───────────────────────────────────────────────────────────────────────────────
step1_square_padded MP4 영상에 SwingNet을 실행하여
data/new pose/**/*_unity.json 의 이벤트를 fallback → swingnet으로 수정한다.

[배경]
  기존 파이프라인 실행 시 SwingNet 모델 파일이 없어 전체 281개가 fallback
  (wrist Y 규칙 기반)으로 처리됨. 이 스크립트가 swingnet_1800.pth를 이용해
  이벤트를 재감지하고 JSON을 덮어쓴다.

[사용법 — Google Colab]
  from google.colab import drive
  drive.mount('/content/drive')

  !python fix_swingnet_events.py \
    --video_dir  /content/drive/MyDrive/GolfSwing/step1_square_padded/dtl \
    --json_dir   /content/drive/MyDrive/GolfSimulation/data/new_pose/dtl \
    --model_dir  /content/drive/MyDrive/GolfSwing/swingnet_models \
    [--output_dir /content/drive/MyDrive/GolfSimulation/data/new_pose_fixed/dtl] \
    [--device auto] \
    [--skip_done]

  뷰 타입 3개 모두 처리할 경우 --view dtl / face_on / other 를 바꿔가며 3번 실행.
  또는 --all_views 와 함께 상위 폴더를 지정 (아래 ALL_VIEWS 모드 참고).

[ALL_VIEWS 모드]
  !python fix_swingnet_events.py \
    --all_views \
    --video_dir  /content/drive/MyDrive/GolfSwing/step1_square_padded \
    --json_dir   /content/drive/MyDrive/GolfSimulation/data/new_pose \
    --model_dir  /content/drive/MyDrive/GolfSwing/swingnet_models

  → video_dir/{dtl,face_on,other}/ 와 json_dir/{dtl,face_on,other}/ 를 자동 탐색.

[model_dir 에 필요한 파일]
  model.py            (EventDetector 클래스)
  MobileNetV2.py      (CNN 백본)
  swingnet_1800.pth   (학습된 가중치)

[알고리즘]
  1. VideoCapture로 프레임 읽기 (160×160 resize, uint8 BGR)
  2. float32 / 255.0 변환
  3. SEQ_LEN=64 슬라이딩 윈도우 (stride=4) → softmax probs 누적
  4. probs /= counts (카운트 기반 평균)
  5. 각 이벤트 클래스(0~7) argmax → 프레임 인덱스
  6. 이벤트 순서 보정: 충돌(동일/역전 프레임) → +1 강제
  7. JSON events 덮어쓰기 + extraction.event_model = 'swingnet_1800'
"""

import os
import sys
import json
import argparse
import glob
import time
import numpy as np
import cv2
import torch


EVENT_NAMES = [
    'address', 'toe_up', 'mid_backswing', 'top',
    'mid_downswing', 'impact', 'mid_follow_through', 'finish',
]

SEQ_LEN = 64
STRIDE  = 4


def load_swingnet(model_dir: str, device: torch.device):
    """
    model.py / MobileNetV2.py 를 model_dir 에서 import 하고
    swingnet_1800.pth 가중치를 로드하여 eval 모드로 반환.
    """
    sys.path.insert(0, model_dir)
    try:
        from model import EventDetector
    except ImportError as e:
        raise ImportError(
            f"model.py 를 찾을 수 없습니다 (model_dir={model_dir}): {e}"
        )

    model = EventDetector(
        pretrain=False,
        width_mult=1.0,
        lstm_layers=1,
        lstm_hidden=256,
        bidirectional=True,
        dropout=False,
    )

    weights_path = os.path.join(model_dir, 'swingnet_1800.pth')
    if not os.path.exists(weights_path):
        weights_path = os.path.join(model_dir, 'swingnet_1800.pth.tar')
    if not os.path.exists(weights_path):
        raise FileNotFoundError(
            f"swingnet_1800.pth 를 찾을 수 없습니다 (model_dir={model_dir})"
        )

    ckpt = torch.load(weights_path, map_location='cpu', weights_only=False)

    if isinstance(ckpt, dict):
        if 'model_state_dict' in ckpt:
            state_dict = ckpt['model_state_dict']
        elif 'state_dict' in ckpt:
            state_dict = ckpt['state_dict']
        else:
            first_key = next(iter(ckpt.keys()), '')
            if first_key.startswith('module.'):
                state_dict = {k[7:]: v for k, v in ckpt.items()}
            else:
                state_dict = ckpt
    else:
        state_dict = ckpt

    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    print(f"[SwingNet] 로드 완료 ({os.path.basename(weights_path)}) — device={device}")
    return model


def read_video_frames(video_path: str):
    """
    MP4 → 160×160 uint8 BGR 프레임 리스트 반환.
    반환: (frames: list[ndarray], fps: float)
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return [], 29.97
    fps = cap.get(cv2.CAP_PROP_FPS) or 29.97
    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(cv2.resize(frame, (160, 160)))
    cap.release()
    return frames, fps


def run_swingnet_on_frames(model, frames: list, fps: float, device: torch.device):
    """
    SwingNet 슬라이딩 윈도우 추론.

    반환:
      dict  — 8개 이벤트 (frame, confidence, method, timestamp)
      None  — 프레임 수 < SEQ_LEN (fallback 필요)
    """
    n = len(frames)
    if n < SEQ_LEN:
        return None

    arr    = np.array(frames, dtype=np.float32) / 255.0     # [n, 160, 160, 3]
    tensor = torch.from_numpy(arr).permute(0, 3, 1, 2)      # [n, 3, 160, 160]

    probs  = np.zeros((n, 9), dtype=np.float64)
    counts = np.zeros(n,      dtype=np.float64)

    with torch.no_grad():
        for start in range(0, n - SEQ_LEN + 1, STRIDE):
            clip = tensor[start:start + SEQ_LEN].unsqueeze(0).to(device)
            out  = model(clip)
            soft = torch.softmax(out, dim=1).cpu().numpy()
            probs[start:start + SEQ_LEN]  += soft
            counts[start:start + SEQ_LEN] += 1

    probs /= np.maximum(counts[:, None], 1)

    event_frames = [int(np.argmax(probs[:, i])) for i in range(len(EVENT_NAMES))]

    for i in range(1, len(EVENT_NAMES)):
        while event_frames[i] <= event_frames[i - 1]:
            event_frames[i] += 1

    events = {}
    for i, name in enumerate(EVENT_NAMES):
        f    = event_frames[i]
        conf = float(probs[min(f, n - 1), i])
        events[name] = {
            'frame':      f,
            'confidence': round(conf, 4),
            'method':     'swingnet',
            'timestamp':  round(f / fps, 4),
        }
    return events


def find_video_path(video_dir: str, video_id: str):
    """
    video_id = '0_square'  →  video_dir/0_square.mp4 탐색.
    없으면 None 반환.
    """
    for ext in ('.mp4', '.MP4', '.avi', '.AVI'):
        p = os.path.join(video_dir, video_id + ext)
        if os.path.exists(p):
            return p
    return None


def process_file(json_path: str, video_dir: str, output_path: str,
                 model, device: torch.device, dry_run: bool = False):
    """
    단일 JSON + 매칭 비디오 처리.
    반환: 'swingnet' | 'fallback' | 'skip' | 'no_video'
    """
    with open(json_path, encoding='utf-8') as f:
        data = json.load(f)

    basename = os.path.basename(json_path)
    video_id = basename.replace('_unity.json', '')

    video_path = find_video_path(video_dir, video_id)
    if video_path is None:
        print(f"  [NO_VIDEO] {video_id}.mp4 없음")
        return 'no_video'

    frames, vid_fps = read_video_frames(video_path)
    if not frames:
        print(f"  [SKIP] 프레임 읽기 실패: {video_path}")
        return 'skip'

    events = run_swingnet_on_frames(model, frames, vid_fps, device)

    if events is None:
        print(f"  [FALLBACK] 프레임 부족 ({len(frames)} < {SEQ_LEN}): {basename}")
        return 'fallback'

    data['events'] = events
    data['extraction']['event_model'] = 'swingnet_1800'
    data['fps'] = round(vid_fps, 4)

    if not dry_run:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    top_f    = events['top']['frame']
    impact_f = events['impact']['frame']
    gap      = impact_f - top_f
    warn     = '  ⚠ top→impact 단거리' if gap <= 3 else ''
    dry_tag  = ' (dry-run)' if dry_run else ''
    print(f"  [OK{dry_tag}] {basename}  "
          f"top={top_f}  impact={impact_f}  gap={gap}프레임{warn}")
    return 'swingnet'


def process_view(video_dir: str, json_dir: str, output_dir: str,
                 model, device: torch.device,
                 skip_done: bool = False, dry_run: bool = False):
    """
    단일 뷰 폴더 처리.
    반환: dict {swingnet, fallback, no_video, skip, already_done}
    """
    json_files = sorted(glob.glob(os.path.join(json_dir, '*_unity.json')))
    counts = {'swingnet': 0, 'fallback': 0, 'no_video': 0, 'skip': 0, 'already_done': 0}

    for json_path in json_files:
        basename = os.path.basename(json_path)

        if skip_done:
            with open(json_path, encoding='utf-8') as f:
                d = json.load(f)
            if d.get('extraction', {}).get('event_model') == 'swingnet_1800':
                print(f"  [DONE] {basename} (건너뜀)")
                counts['already_done'] += 1
                continue

        out_path = os.path.join(output_dir, basename) if output_dir else json_path
        result   = process_file(json_path, video_dir, out_path, model, device, dry_run)
        counts[result] += 1

    return counts


def main():
    parser = argparse.ArgumentParser(
        description='SwingNet 이벤트 재감지 — *_unity.json 이벤트 수정',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--video_dir',  required=True,
                        help='step1_square_padded/{view} 폴더 (MP4 위치). '
                             '--all_views 시 상위 폴더.')
    parser.add_argument('--json_dir',   required=True,
                        help='*_unity.json 폴더. --all_views 시 상위 폴더.')
    parser.add_argument('--model_dir',  required=True,
                        help='model.py + swingnet_1800.pth 위치')
    parser.add_argument('--output_dir', default=None,
                        help='결과 저장 폴더 (없으면 json_dir 덮어쓰기)')
    parser.add_argument('--all_views',  action='store_true',
                        help='dtl/face_on/other 서브폴더를 일괄 처리')
    parser.add_argument('--device',     default='auto',
                        choices=['auto', 'cpu', 'cuda'],
                        help='추론 장치 (기본: auto)')
    parser.add_argument('--skip_done',  action='store_true',
                        help='이미 swingnet 처리된 파일 건너뛰기')
    parser.add_argument('--dry_run',    action='store_true',
                        help='파일 저장 없이 테스트 실행')
    args = parser.parse_args()

    if args.device == 'auto':
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    else:
        device = torch.device(args.device)

    model = load_swingnet(args.model_dir, device)

    views       = ['dtl', 'face_on', 'other'] if args.all_views else [None]
    total_stats = {'swingnet': 0, 'fallback': 0, 'no_video': 0, 'skip': 0, 'already_done': 0}
    t0          = time.time()

    for view in views:
        if view:
            video_dir  = os.path.join(args.video_dir, view)
            json_dir   = os.path.join(args.json_dir,  view)
            output_dir = os.path.join(args.output_dir, view) if args.output_dir else None
        else:
            video_dir  = args.video_dir
            json_dir   = args.json_dir
            output_dir = args.output_dir

        n_json = len(glob.glob(os.path.join(json_dir, '*_unity.json')))
        print(f'\n{"="*60}')
        print(f'[뷰] {view or "단일"} — {n_json}개 JSON in {json_dir}')
        print(f'{"="*60}')

        stats = process_view(
            video_dir, json_dir, output_dir, model, device,
            skip_done=args.skip_done, dry_run=args.dry_run,
        )

        for k, v in stats.items():
            total_stats[k] += v

        total_view = sum(stats.values())
        print(f'\n  [뷰 소계] '
              f'OK={stats["swingnet"]}  fallback={stats["fallback"]}  '
              f'no_video={stats["no_video"]}  skip={stats["skip"]}  '
              f'already_done={stats["already_done"]}  합계={total_view}')

    elapsed = time.time() - t0
    total   = sum(total_stats.values())
    print(f'\n{"="*60}')
    print(f'[최종 결과]  소요={elapsed:.1f}초  총={total}개')
    print(f'  SwingNet 성공 : {total_stats["swingnet"]}')
    print(f'  Fallback 유지 : {total_stats["fallback"]}')
    print(f'  비디오 없음   : {total_stats["no_video"]}')
    print(f'  건너뜀        : {total_stats["skip"]}')
    print(f'  이미 처리됨   : {total_stats["already_done"]}')
    print(f'{"="*60}')

    if args.dry_run:
        print('\n※ dry_run 모드: 파일이 저장되지 않았습니다.')


if __name__ == '__main__':
    main()
