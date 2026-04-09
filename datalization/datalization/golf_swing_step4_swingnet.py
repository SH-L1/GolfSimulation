"""
golf_swing_step4_swingnet.py
Step 4: SwingNet 스윙 이벤트 탐지

논문 파라미터 (McNally et al., CVPR Workshop 2019):
- CNN backbone: tonylins MobileNetV2 (width_mult=1.0)
- LSTM: 1 layer, bidirectional, hidden=256 (attr name: rnn)
- FC: 512 → 9 (attr name: lin)
- Input size: 160×160, Seq len: 64 (sliding window, no overlap)
- Classes: 9 (8 events + No-event)

[변경사항]
1. _sliding_window: 마지막 청크 앞쪽 패딩으로 변경
   - 기존: 마지막 프레임 반복(뒤쪽 패딩) → finish 이벤트 확률 왜곡
   - 수정: 첫 프레임 반복(앞쪽 패딩) → 실제 구간 probs만 집계
2. _select_ordered: confidence 임계값 추가
   - 낮은 신뢰도 이벤트는 None 처리 → rule-based fallback 연계
3. RuleBasedEventDetector: visibility 기반 최적 키포인트 선택
   - 기존: 단순 or 체인 → 구간마다 추적 관절 변경으로 wrist_y 불연속
   - 수정: 매 프레임 visibility 최댓값 기준으로 일관된 관절 선택
"""

import torch
import torch.nn as nn
import torchvision.transforms as transforms
import cv2
import numpy as np
import json
from pathlib import Path
from scipy.signal import savgol_filter

# ─────────────────────────────────────────────
EVENT_IDX = {
    0: "address", 1: "toe_up", 2: "mid_backswing", 3: "top",
    4: "mid_downswing", 5: "impact", 6: "mid_follow_through", 7: "finish",
}
NUM_CLASSES = 9
INPUT_SIZE = 160
SEQ_LEN = 64
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD  = [0.229, 0.224, 0.225]

# SwingNet이 각 이벤트를 올바르게 탐지했다고 신뢰하기 위한 최소 확률
MIN_EVENT_CONFIDENCE = 0.3


# ─────────────────────────────────────────────
# tonylins-style MobileNetV2
# ─────────────────────────────────────────────
def _make_divisible(v, divisor, min_value=None):
    if min_value is None:
        min_value = divisor
    new_v = max(min_value, int(v + divisor / 2) // divisor * divisor)
    if new_v < 0.9 * v:
        new_v += divisor
    return new_v


class InvertedResidual(nn.Module):
    def __init__(self, inp, oup, stride, expand_ratio):
        super().__init__()
        self.stride = stride
        self.use_res_connect = stride == 1 and inp == oup

        if expand_ratio == 1:
            self.conv = nn.Sequential(
                nn.Conv2d(inp, inp, 3, stride, 1, groups=inp, bias=False),
                nn.BatchNorm2d(inp),
                nn.ReLU6(inplace=True),
                nn.Conv2d(inp, oup, 1, 1, 0, bias=False),
                nn.BatchNorm2d(oup),
            )
        else:
            self.conv = nn.Sequential(
                nn.Conv2d(inp, inp * expand_ratio, 1, 1, 0, bias=False),
                nn.BatchNorm2d(inp * expand_ratio),
                nn.ReLU6(inplace=True),
                nn.Conv2d(inp * expand_ratio, inp * expand_ratio, 3, stride, 1,
                          groups=inp * expand_ratio, bias=False),
                nn.BatchNorm2d(inp * expand_ratio),
                nn.ReLU6(inplace=True),
                nn.Conv2d(inp * expand_ratio, oup, 1, 1, 0, bias=False),
                nn.BatchNorm2d(oup),
            )

    def forward(self, x):
        if self.use_res_connect:
            return x + self.conv(x)
        return self.conv(x)


class MobileNetV2Features(nn.Module):
    def __init__(self, width_mult=1.0):
        super().__init__()
        input_channel = 32
        last_channel = 1280
        interverted_residual_setting = [
            [1, 16, 1, 1],
            [6, 24, 2, 2],
            [6, 32, 3, 2],
            [6, 64, 4, 2],
            [6, 96, 3, 1],
            [6, 160, 3, 2],
            [6, 320, 1, 1],
        ]

        input_channel = _make_divisible(input_channel * width_mult, 8)
        self.last_channel = _make_divisible(last_channel * max(1.0, width_mult), 8)

        features = [
            nn.Sequential(
                nn.Conv2d(3, input_channel, 3, 2, 1, bias=False),
                nn.BatchNorm2d(input_channel),
                nn.ReLU6(inplace=True),
            )
        ]

        for t, c, n, s in interverted_residual_setting:
            output_channel = _make_divisible(int(c * width_mult), 8)
            for i in range(n):
                stride = s if i == 0 else 1
                features.append(InvertedResidual(input_channel, output_channel, stride, t))
                input_channel = output_channel

        features.append(
            nn.Sequential(
                nn.Conv2d(input_channel, self.last_channel, 1, 1, 0, bias=False),
                nn.BatchNorm2d(self.last_channel),
                nn.ReLU6(inplace=True),
            )
        )
        self.features = nn.Sequential(*features)

    def forward(self, x):
        return self.features(x)


# ─────────────────────────────────────────────
# SwingNet
# ─────────────────────────────────────────────
class SwingNet(nn.Module):
    def __init__(self, width_mult=1.0, lstm_hidden=256,
                 lstm_layers=1, bidirectional=True):
        super().__init__()
        mobilenet = MobileNetV2Features(width_mult=width_mult)
        self.cnn = mobilenet.features
        self.pool = nn.AdaptiveAvgPool2d(1)

        feat_dim = mobilenet.last_channel
        self.rnn = nn.LSTM(
            feat_dim, lstm_hidden, lstm_layers,
            batch_first=True, bidirectional=bidirectional,
        )
        out_dim = lstm_hidden * 2 if bidirectional else lstm_hidden
        self.lin = nn.Linear(out_dim, 9)

    def extract_features(self, frames: torch.Tensor) -> torch.Tensor:
        with torch.no_grad():
            f = self.cnn(frames)
            f = self.pool(f).squeeze(-1).squeeze(-1)
        return f

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        out, _ = self.rnn(features)
        out = self.lin(out)
        return torch.softmax(out, dim=-1)


# ─────────────────────────────────────────────
# Rule-Based Fallback
# ─────────────────────────────────────────────
class RuleBasedEventDetector:

    # 추적 우선순위: wrist → elbow → shoulder
    TRACK_CANDIDATES = [
        'left_wrist', 'right_wrist',
        'left_elbow', 'right_elbow',
        'left_shoulder', 'right_shoulder',
    ]

    def detect(self, landmarks_json: dict) -> dict:
        frames = landmarks_json.get("frames", [])
        pose_frames = [f for f in frames if f.get("has_pose")]
        if len(pose_frames) < 4:
            return self._empty()

        wrist_y, wrist_x, frame_ids = [], [], []

        for f in pose_frames:
            lms = {lm["name"]: lm for lm in f.get("landmarks", [])}

            # [변경] 단순 or 체인 → visibility 기반 최적 관절 선택
            # 매 프레임에서 후보 관절 중 visibility가 가장 높은 것을 일관되게 선택
            # → 구간마다 추적 관절이 바뀌어 wrist_y 배열이 불연속해지는 현상 방지
            best_kp = max(
                [lms[k] for k in self.TRACK_CANDIDATES if k in lms],
                key=lambda lm: lm.get("visibility", 0),
                default=None,
            )
            if best_kp:
                wrist_y.append(best_kp["y"])
                wrist_x.append(best_kp["x"])
                frame_ids.append(f["frame"])

        if len(wrist_y) < 4:
            return self._empty()

        wy = np.array(wrist_y)
        wx = np.array(wrist_x)
        wlen = min(11, len(wy))
        wlen = wlen if wlen % 2 == 1 else wlen - 1
        wy_s = savgol_filter(wy, max(wlen, 5), 3) if wlen >= 5 else wy

        n = len(frame_ids)
        addr_idx = n // 20
        top_idx = int(np.argmin(wy_s))
        dx = np.abs(np.diff(wx))
        impact_idx = (
            int(np.argmax(dx[top_idx:])) + top_idx + 1
            if top_idx < n - 1 else min(top_idx + 5, n - 1)
        )
        finish_idx = n - max(n // 10, 1) - 1

        def mid(a, b): return a + (b - a) // 2
        def fr(i): return frame_ids[max(0, min(i, n - 1))]

        return {
            "address":           fr(addr_idx),
            "toe_up":            fr(mid(addr_idx, top_idx)),
            "mid_backswing":     fr(addr_idx + 2 * (top_idx - addr_idx) // 3),
            "top":               fr(top_idx),
            "mid_downswing":     fr(mid(top_idx, impact_idx)),
            "impact":            fr(impact_idx),
            "mid_follow_through": fr(mid(impact_idx, finish_idx)),
            "finish":            fr(finish_idx),
        }

    @staticmethod
    def _empty():
        return {k: None for k in [
            "address", "toe_up", "mid_backswing", "top",
            "mid_downswing", "impact", "mid_follow_through", "finish",
        ]}


# ─────────────────────────────────────────────
# SwingNet 탐지기
# ─────────────────────────────────────────────
class SwingNetEventDetector:
    TRANSFORM = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])

    def __init__(self, weights_path=None, device=None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = SwingNet().to(self.device)
        self.model.eval()
        self.weights_loaded = False
        self.fallback = RuleBasedEventDetector()

        if weights_path and Path(weights_path).exists():
            try:
                ckpt = torch.load(weights_path, map_location=self.device)
                state = ckpt.get("model_state_dict", ckpt.get("state_dict", ckpt))
                self.model.load_state_dict(state)
                self.weights_loaded = True
                print(f"  ✓ SwingNet 가중치 로드: {weights_path}")
            except Exception as e:
                print(f"  ✗ 가중치 로드 실패: {e} → Rule-Based Fallback 사용")
        else:
            print("  ⚠ SwingNet 가중치 없음 → Rule-Based Fallback 사용")

    def _load_frames(self, video_path):
        cap = cv2.VideoCapture(video_path)
        frames = []
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            resized = cv2.resize(rgb, (INPUT_SIZE, INPUT_SIZE),
                                 interpolation=cv2.INTER_LINEAR)
            frames.append(self.TRANSFORM(resized))
        cap.release()
        return frames

    def _sliding_window(self, frames):
        """
        [변경] 마지막 청크 패딩 방식 수정
        - 기존: chunk[-1] 반복 (뒤쪽 패딩)
          → LSTM이 동일 프레임을 연속으로 보게 되어 finish 확률 왜곡
        - 수정: chunk[0] 반복 (앞쪽 패딩)
          → 패딩 구간의 probs를 집계에서 제외하고 실제 프레임 probs만 사용
        """
        T = len(frames)
        all_probs = np.zeros((T, NUM_CLASSES), dtype=np.float32)
        count = np.zeros(T, dtype=np.float32)

        for start in range(0, T, SEQ_LEN):
            end = min(start + SEQ_LEN, T)
            chunk = frames[start:end]
            actual = len(chunk)

            if actual < SEQ_LEN:
                pad_count = SEQ_LEN - actual
                padded_chunk = [chunk[0]] * pad_count + chunk  # 앞쪽 패딩

                batch = torch.stack(padded_chunk).to(self.device)
                feats = self.model.extract_features(batch).unsqueeze(0)
                with torch.no_grad():
                    probs = self.model(feats).squeeze(0).cpu().numpy()  # [SEQ_LEN, 9]

                # 패딩 구간 제외, 실제 프레임만 집계
                all_probs[start:end] += probs[pad_count:]
            else:
                batch = torch.stack(chunk).to(self.device)
                feats = self.model.extract_features(batch).unsqueeze(0)
                with torch.no_grad():
                    probs = self.model(feats).squeeze(0).cpu().numpy()
                all_probs[start:end] += probs[:actual]

            count[start:end] += 1

        all_probs /= np.where(count == 0, 1, count)[:, None]
        return all_probs

    def _select_ordered(self, probs):
        """
        [변경] confidence 임계값 추가
        - 이벤트 확률이 MIN_EVENT_CONFIDENCE 미만이면 None 처리
          → 탐지 실패로 간주, 이후 rule-based fallback으로 보완 가능
        - 순서 보정은 None이 아닌 이벤트에만 적용
        """
        T = probs.shape[0]
        order = list(EVENT_IDX.values())
        events = {}

        for idx, name in EVENT_IDX.items():
            max_conf = float(np.max(probs[:, idx]))
            if max_conf < MIN_EVENT_CONFIDENCE:
                events[name] = None  # 신뢰도 부족 → fallback에서 처리
            else:
                events[name] = int(np.argmax(probs[:, idx]))

        # 순서 보정: None이 아닌 이벤트끼리만
        for i in range(1, len(order)):
            prev_name = order[i - 1]
            curr_name = order[i]
            if events[prev_name] is None or events[curr_name] is None:
                continue
            if events[curr_name] <= events[prev_name]:
                s = events[prev_name] + 1
                if s < T:
                    local = int(np.argmax(probs[s:T, list(EVENT_IDX.keys())[i]]))
                    events[curr_name] = s + local
                else:
                    events[curr_name] = min(events[prev_name] + 1, T - 1)

        # None 이벤트는 rule-based 결과로 보완 (외부에서 처리하거나 여기서 fallback)
        return events

    def detect(self, video_path, landmarks_json):
        if not self.weights_loaded:
            return self.fallback.detect(landmarks_json)
        try:
            frames = self._load_frames(video_path)
            if len(frames) < SEQ_LEN // 4:
                return self.fallback.detect(landmarks_json)

            probs = self._sliding_window(frames)
            events = self._select_ordered(probs)

            # None 이벤트가 있으면 rule-based 결과로 보완
            none_events = [k for k, v in events.items() if v is None]
            if none_events:
                fallback_events = self.fallback.detect(landmarks_json)
                for k in none_events:
                    events[k] = fallback_events.get(k)
                print(f"  ⚠ 낮은 신뢰도 이벤트 fallback 보완: {none_events}")

            return events

        except Exception as e:
            print(f"  ✗ 추론 오류: {e} → Fallback")
            return self.fallback.detect(landmarks_json)


# ─────────────────────────────────────────────
# Step 4 프로세서
# ─────────────────────────────────────────────
class SwingEventProcessor:
    def __init__(self, weights_path=None):
        self.detector = SwingNetEventDetector(weights_path=weights_path)

    def process_single(self, square_video_path, landmarks_json_path,
                       output_dir, view_type="face_on"):
        step4_dir = Path(output_dir) / "step4_swingnet" / view_type
        step4_dir.mkdir(parents=True, exist_ok=True)
        video_name = Path(square_video_path).stem.replace("_square", "")

        with open(landmarks_json_path, "r") as f:
            landmarks_data = json.load(f)

        fps = landmarks_data.get("fps", 30)
        events = self.detector.detect(square_video_path, landmarks_data)

        events_with_ts = {
            name: {
                "frame": fr,
                "timestamp": round(fr / fps, 4) if fr is not None else None,
            }
            for name, fr in events.items()
        }

        output_data = {
            **landmarks_data,
            "events": events_with_ts,
            "event_detection": {
                "method": "swingnet" if self.detector.weights_loaded else "rule_based_fallback",
                "model": "SwingNet (MobileNetV2 + BiLSTM, McNally et al. 2019)",
                "input_size": INPUT_SIZE,
                "seq_len": SEQ_LEN,
                "min_event_confidence": MIN_EVENT_CONFIDENCE,
            },
        }

        out_path = step4_dir / f"{video_name}_events.json"
        with open(out_path, "w") as f:
            json.dump(output_data, f, indent=2)

        return {
            "video_name": video_name,
            "view_type": view_type,
            "step4_json": str(out_path),
            "events": events,
            "detection_method": output_data["event_detection"]["method"],
        }

    def process_batch(self, output_dir):
        step1_dir = Path(output_dir) / "step1_square_padded"
        step2_dir = Path(output_dir) / "step2_mpp_landmarks"

        if not step1_dir.exists():
            raise FileNotFoundError(f"Step 1 결과 없음: {step1_dir}")
        if not step2_dir.exists():
            raise FileNotFoundError(f"Step 2 결과 없음: {step2_dir}")

        pairs = []
        for viewdir in step1_dir.iterdir():
            if not viewdir.is_dir():
                continue
            view_type = viewdir.name
            for vp in viewdir.glob("*_square.mp4"):
                name = vp.stem.replace("_square", "")
                lm = step2_dir / view_type / f"{name}_landmarks.json"
                if lm.exists():
                    pairs.append({
                        "video": str(vp),
                        "landmarks": str(lm),
                        "view_type": view_type,
                    })

        method = "SwingNet" if self.detector.weights_loaded else "Rule-Based Fallback"
        print("=" * 60)
        print(f"Step 4 — SwingNet 이벤트 탐지")
        print(f"  처리 대상: {len(pairs)}개 | 방법: {method}")
        print(f"  Min confidence: {MIN_EVENT_CONFIDENCE}")
        print(f"  출력 경로: {output_dir}/step4_swingnet")
        print("=" * 60)

        results = []
        for i, pair in enumerate(pairs):
            name = Path(pair["video"]).stem.replace("_square", "")
            print(f"  [{i+1}/{len(pairs)}] {name}.mp4 ({pair['view_type']})", end=" ... ")
            try:
                r = self.process_single(
                    pair["video"], pair["landmarks"],
                    output_dir, pair["view_type"],
                )
                results.append(r)
                ev = r["events"]
                print(f"✓ address={ev.get('address')} "
                      f"top={ev.get('top')} impact={ev.get('impact')}")
            except Exception as e:
                print(f"✗ {e}")
                results.append({"video_name": name, "error": str(e)})

        summary_path = Path(output_dir) / "step4_summary.json"
        with open(summary_path, "w") as f:
            json.dump({
                "step": "step4_swingnet",
                "total": len(pairs),
                "successful": len([r for r in results if "error" not in r]),
                "failed": len([r for r in results if "error" in r]),
                "detection_method": method,
                "results": results,
            }, f, indent=2)

        print("=" * 60)
        print(f"Step 4 완료! 성공: {len([r for r in results if 'error' not in r])}/{len(pairs)}")
        print(f"요약: {summary_path}")
        print("=" * 60)
        return results


# ─────────────────────────────────────────────
if __name__ == "__main__":
    OUTPUT_DIR = "data/processed"
    WEIGHTS_PATH = "models/swingnet_1800.pth.tar"

    processor = SwingEventProcessor(weights_path=WEIGHTS_PATH)
    results = processor.process_batch(output_dir=OUTPUT_DIR)