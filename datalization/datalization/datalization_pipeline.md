# 데이터 추출 파이프라인 설계 문서
## GolfDB 전처리 — RTMPose + DSTformer 3D 리프팅

> **버전:** v3.1
> **작성일:** 2026-03-31
> **담당:** GolfDB 오프라인 전처리 파이프라인
> **변경사항 (v3.0 → v3.1):** Step별 실행 체크리스트 추가

---

## 목차

1. [개요](#1-개요)
2. [전체 파이프라인 흐름](#2-전체-파이프라인-흐름)
3. [실행 순서 및 작업 체크리스트](#3-실행-순서-및-작업-체크리스트)
4. [Step 1 — 영상 전처리](#4-step-1--영상-전처리)
5. [Step 2 — RTMPose 2D 랜드마크 추출](#5-step-2--rtmpose-2d-랜드마크-추출)
6. [Step 3 — SwingNet 이벤트 탐지](#6-step-3--swingnet-이벤트-탐지)
7. [Step 4 — HALPE-26 → H36M 매핑 및 보간](#7-step-4--halpe-26--h36m-매핑-및-보간)
8. [Step 5 — DSTformer 3D 리프팅](#8-step-5--dstformer-3d-리프팅)
9. [Step 6 — 발 joint 후처리 (HALPE-26 완성)](#9-step-6--발-joint-후처리-halpe-26-완성)
10. [Step 7 — 정규화 및 flip 보정](#10-step-7--정규화-및-flip-보정)
11. [랜드마크 종류별 처리 방식 총정리](#11-랜드마크-종류별-처리-방식-총정리)
12. [출력 JSON 스키마](#12-출력-json-스키마)
13. [디렉토리 구조](#13-디렉토리-구조)
14. [Fallback Plan](#14-fallback-plan)
15. [용어 정의](#15-용어-정의)

---

## 1. 개요

GolfDB 영상에서 3D 골프 스윙 랜드마크를 추출하는 오프라인 전처리 파이프라인이다.
RTMPose로 추출한 HALPE-26 2D 좌표를 DSTformer(MotionBERT)를 통해 3D로 리프팅하고,
최종적으로 26개 joint 전부의 3D 좌표를 확보하여 Module 1 지표 계산 및 Module 3 3D 시각화에 제공한다.

### 1.1 기술 스택 변경 이유

| 항목 | v2.1 (구버전) | v3.x (현재) | 변경 이유 |
|------|-------------|------------|---------|
| 2D 추출기 | MediaPipe (17 joints) | **RTMPose (HALPE-26, 26 joints)** | 발 joints 포함, 정확도 향상 |
| 3D 좌표 | MediaPipe pseudo-3D (z 부정확) | **DSTformer 3D 리프팅 (H36M 기반)** | 실제 3D 깊이 추정 가능 |
| 발 joints | 미지원 | **big_toe / small_toe / heel (양쪽)** | 체중이동 분석을 위해 필수 |

### 1.2 입출력 요약

| 항목 | 내용 |
|------|------|
| 입력 | GolfDB 영상 (.mp4), 1024×1024 정사각형 패딩 완료 |
| 중간 산출물 | `*_landmarks.json` — RTMPose 2D 결과 (HALPE-26, x/y/score) |
| 최종 출력 | `*_3d_landmarks.json` — 3D 리프팅 완료 (26 joints, x/y/z) |

### 1.3 현재 진행 상태

| Step | 상태 | 저장 위치 |
|------|------|---------|
| Step 1 — 영상 전처리 | ✅ 완료 | `step1_videos/` |
| Step 2 — RTMPose 2D 추출 | ✅ 완료 | `step2_rtmpose_halpe26/` |
| Step 3 — SwingNet 이벤트 탐지 | ✅ 완료 | `step4_swingnet_enhanced/` |
| Step 4~7 — 3D 리프팅 + 후처리 | 🔨 진행 중 | `step25_lifted/` |

---

## 2. 전체 파이프라인 흐름
GolfDB 영상 (1,400개)
│
▼
[Step 1] 영상 전처리 ✅ 완료
- 사이드뷰 필터링 (~820개)
- 1024×1024 정사각형 패딩 (비율 유지)
│
▼
[Step 2] RTMPose 2D 랜드마크 추출 ✅ 완료
- 모델: RTMPose BodyWithFeet balanced
- 출력: HALPE-26 keypoints (x, y, score) per frame
- 저장: step2_rtmpose_halpe26/{view}/{video}_landmarks.json
│
▼
[Step 3] SwingNet 이벤트 탐지 ✅ 완료
- 8개 이벤트 프레임 식별
- 저장: step4_swingnet_enhanced/{view}/{video}_events.json
│
▼
[Step 4] HALPE-26 → H36M 매핑 및 보간 🔨 진행 중
- H36M_TO_HALPE 매핑 (16개 직접 대응)
- Spine 보간: (Hip + Thorax) / 2

- 입력 shape: [T, 26, 2] → [T, 17, 2]
│
▼
[Step 5] DSTformer 3D 리프팅 🔨 진행 중
- 모델: MotionBERT (dim_feat=256, dim_rep=512, depth=5)
- 입력: [T, 17, 2] → 출력: [T, 17, 3]
│
▼
[Step 6] 발 joint 후처리 🔨 진행 중
- 대상: big_toe, small_toe, heel × 양쪽 = 6개
- ankle 기준 2D 오프셋 적용
- 결과: [T, 26, 3]
│
▼
[Step 7] 정규화 및 flip 보정 🔨 진행 중
- 어깨 너비 기준 body-scale 정규화
- 오른손 골퍼 기준 좌우 flip 보정
- score < 0.3 프레임 선형 보간
│
▼
출력: step25_lifted/{view}/{video}_3d_landmarks.json
shape: [T, 26, 3]

text

---

## 3. 실행 순서 및 작업 체크리스트

### 3.1 전체 실행 순서
[환경 설정]
→ [모델 로드 확인]
→ [입력 파일 목록 수집]
→ [배치 루프 실행]
→ Step 4: 매핑
→ Step 5: 리프팅
→ Step 6: 발 후처리
→ Step 7: 정규화
→ 저장
→ [완료 검증]

text

### 3.2 실행 전 체크리스트

#### 환경 설정
- [ ] Google Colab GPU 런타임 확인 (T4 이상 권장)
- [ ] Google Drive 마운트 확인
- [ ] MotionBERT 레포 클론 및 `sys.path` 등록 확인
- [ ] DSTformer 체크포인트 경로 확인 (`checkpoint['model_pos']` 키 존재)

#### 입력 데이터 확인
- [ ] `step2_rtmpose_halpe26/{dtl, face_on, other}/` 파일 존재 확인
- [ ] JSON 파일 포맷 확인 (`keypoint_format: halpe26`, 26개 landmarks)
- [ ] `step4_swingnet_enhanced/` 이벤트 파일 존재 확인 (선택)

#### 출력 디렉토리 확인
- [ ] `step25_lifted/{dtl, face_on, other}/` 디렉토리 생성 확인

### 3.3 Step별 체크리스트

#### Step 4 — HALPE-26 → H36M 매핑
- [ ] `H36M_TO_HALPE` 매핑 딕셔너리 정의 확인
- [ ] Spine[7] 보간 함수 정의 확인
- [ ] 입력 배열 shape `[T, 17, 2]` 변환 확인
- [ ] Neck[9] / Thorax[8] 동일 소스(HALPE 18) 매핑 확인

#### Step 5 — DSTformer 3D 리프팅
- [ ] 모델 `eval()` 모드 설정 확인
- [ ] `torch.no_grad()` 컨텍스트 적용 확인
- [ ] 프레임 수 ≤ 243: 패딩 처리 확인
- [ ] 프레임 수 > 243: 슬라이딩 윈도우 처리 확인
- [ ] 출력 shape `[T, 17, 3]` 확인

#### Step 6 — 발 joint 후처리
- [ ] `HALPE_TO_H36M_ANKLE` 매핑 딕셔너리 정의 확인
- [ ] 얼굴 5개 joint (idx 0~4) 제외 처리 확인
- [ ] 출력 shape `[T, 26, 3]` 확인
- [ ] 발 joint score < 0.3 프레임 오프셋 0 처리 확인

#### Step 7 — 정규화 및 flip 보정
- [ ] 어깨 너비 정규화 적용 확인 (분모 0 방지: `max(..., 1e-6)`)
- [ ] hip root(idx 19) 원점 이동 확인
- [ ] 왼손 골퍼 flip 보정 확인 (x축 반전)
- [ ] 전체 프레임 score < 0.3 보간 처리 확인

#### 저장 및 검증
- [ ] 출력 JSON `keypoint_format: halpe26_3d` 명시 확인
- [ ] 프레임 수 일치 확인 (입력 total_frames == 출력 총 프레임)
- [ ] 좌표 범위 이상치 확인 (±3σ 초과 비율 < 5%)
- [ ] 이미 처리된 파일 skip 로직 확인 (재실행 안전성)

### 3.4 배치 실행 체크리스트

- [ ] `BATCH_SIZE = 50` 기준 배치 분할 확인
- [ ] 각 배치 완료 후 Drive 저장 확인
- [ ] tqdm 진행바 출력 확인
- [ ] 에러 발생 시 해당 파일 skip + 로그 기록 확인
- [ ] 세션 종료 후 재실행 시 기처리 파일 자동 skip 확인

### 3.5 최종 완료 체크리스트

- [ ] `step25_lifted/` 파일 수 == 입력 파일 수 확인
- [ ] dtl / face_on / other 별 파일 수 집계
- [ ] 랜덤 샘플 5개 3D 좌표 시각화로 육안 검증
- [ ] 이상치 파일 목록 (`error_log.txt`) 확인 및 재처리

---

## 4. Step 1 — 영상 전처리

### 4.1 사이드뷰 필터링

GolfDB 1,400개 영상 중 사이드뷰(DTL 포함)만 선별한다.
정면뷰(Face-On)는 별도 파이프라인으로 처리한다 (v2 확장 예정).
전체 영상: 1,400개
dtl 필터링 후: ~820개
face_on 필터링 후: ~580개

text

### 4.2 정사각형 패딩

RTMPose 입력 해상도 통일 및 좌표 정규화를 위해 원본 비율을 유지한 채 1024×1024 패딩 처리한다.

```python
def make_square_frame(frame, target_size=1024):
    h, w = frame.shape[:2]
    max_dim = max(h, w)
    pad_h = (max_dim - h) // 2
    pad_w = (max_dim - w) // 2
    padded = cv2.copyMakeBorder(frame, pad_h, pad_h, pad_w, pad_w,
                                 cv2.BORDER_CONSTANT, value=0)
    return cv2.resize(padded, (target_size, target_size))
```

---

## 5. Step 2 — RTMPose 2D 랜드마크 추출

### 5.1 모델 정보

| 항목 | 내용 |
|------|------|
| 모델 | RTMPose BodyWithFeet balanced |
| 출력 포맷 | HALPE-26 (halpe26) |
| 좌표계 | 정규화 좌표 (0~1), 원점 좌상단 |
| 신뢰도 | score (0~1), 0.3 이하는 보간 처리 |
| 디바이스 | CUDA |

### 5.2 HALPE-26 keypoint 목록

| idx | 이름 | idx | 이름 |
|-----|------|-----|------|
| 0 | nose | 13 | left_knee |
| 1 | left_eye | 14 | right_knee |
| 2 | right_eye | 15 | left_ankle |
| 3 | left_ear | 16 | right_ankle |
| 4 | right_ear | 17 | head |
| 5 | left_shoulder | 18 | neck |
| 6 | right_shoulder | 19 | hip (root) |
| 7 | left_elbow | 20 | left_big_toe |
| 8 | right_elbow | 21 | right_big_toe |
| 9 | left_wrist | 22 | left_small_toe |
| 10 | right_wrist | 23 | right_small_toe |
| 11 | left_hip | 24 | left_heel |
| 12 | right_hip | 25 | right_heel |

### 5.3 출력 JSON 포맷 (landmarks.json)

```json
{
  "video": "1003_square",
  "view_type": "face_on",
  "fps": 29.97,
  "total_frames": 298,
  "keypoint_format": "halpe26",
  "keypoint_names": ["nose", "left_eye", "..."],
  "extraction": {
    "model": "RTMPose BodyWithFeet balanced",
    "device": "cuda"
  },
  "frames": [
    {
      "frame": 0,
      "timestamp": 0.0,
      "has_pose": true,
      "landmarks": [
        { "idx": 0, "name": "nose", "x": 0.452, "y": 0.347, "score": 0.717 }
      ]
    }
  ]
}
```

---

## 6. Step 3 — SwingNet 이벤트 탐지

### 6.1 탐지 이벤트

| 이벤트 | 설명 |
|--------|------|
| address | 어드레스 자세 |
| toe_up | 백스윙 초기 |
| mid_backswing | 백스윙 중간 |
| top | 백스윙 정점 |
| mid_downswing | 다운스윙 중간 |
| impact | 임팩트 순간 |
| mid_follow_through | 팔로우스루 중간 |
| finish | 피니시 자세 |

### 6.2 이벤트 탐지 Fallback

| Fallback 규칙 | 대상 이벤트 |
|-------------|------------|
| left_wrist Y좌표 극솟값 프레임 | top |
| left_wrist X속도 최댓값 프레임 | impact |
| 첫 번째 유효 프레임 | address |
| 마지막 유효 프레임 | finish |

---

## 7. Step 4 — HALPE-26 → H36M 매핑 및 보간

DSTformer는 H36M 17 joint 체계를 입력으로 받는다.
HALPE-26에서 H36M으로 매핑하고, 직접 대응이 없는 joint는 보간한다.

### 7.1 H36M_TO_HALPE 매핑 테이블

| H36M idx | H36M 이름 | HALPE idx | HALPE 이름 | 처리 방식 |
|---------|----------|----------|-----------|---------|
| 0 | Hip (root) | 19 | hip | ✅ 직접 매핑 |
| 1 | RHip | 12 | right_hip | ✅ 직접 매핑 |
| 2 | RKnee | 14 | right_knee | ✅ 직접 매핑 |
| 3 | RAnkle | 16 | right_ankle | ✅ 직접 매핑 |
| 4 | LHip | 11 | left_hip | ✅ 직접 매핑 |
| 5 | LKnee | 13 | left_knee | ✅ 직접 매핑 |
| 6 | LAnkle | 15 | left_ankle | ✅ 직접 매핑 |
| **7** | **Spine** | **—** | **(없음)** | **⚠️ 보간 필요** |
| 8 | Thorax | 18 | neck | ✅ 직접 매핑 |
| 9 | Neck | 18 | neck | ✅ 직접 매핑 (동일) |
| 10 | Head | 17 | head | ✅ 직접 매핑 |
| 11 | LShoulder | 5 | left_shoulder | ✅ 직접 매핑 |
| 12 | LElbow | 7 | left_elbow | ✅ 직접 매핑 |
| 13 | LWrist | 9 | left_wrist | ✅ 직접 매핑 |
| 14 | RShoulder | 6 | right_shoulder | ✅ 직접 매핑 |
| 15 | RElbow | 8 | right_elbow | ✅ 직접 매핑 |
| 16 | RWrist | 10 | right_wrist | ✅ 직접 매핑 |

> **Neck[9] / Thorax[8] 중복 문제:**
> HALPE neck[18]은 어깨 사이 중간점으로, H36M의 Neck[9]과 Thorax[8] 두 곳에 근사 매핑한다.
> 두 joint의 미세한 위치 차이는 DSTformer 내부 어텐션 메커니즘에서 보정된다.

### 7.2 Spine[7] 보간

```python
def add_spine_joint(pose_2d: np.ndarray) -> np.ndarray:
    """
    pose_2d: [T, 17, 2] — H36M 순서 2D 입력
    Spine = (Hip + Thorax) / 2[2][1]
    """
    hip    = pose_2d[:, 0, :]
    thorax = pose_2d[:, 8, :]
    pose_2d[:, 7, :] = (hip + thorax) / 2.0
    return pose_2d
```

---

## 8. Step 5 — DSTformer 3D 리프팅

### 8.1 모델 설정

체크포인트에서 역추출한 실제 config:

```python
model = DSTformer(
    dim_in=3,
    dim_out=3,
    dim_feat=256,
    dim_rep=512,
    depth=5,
    num_heads=8,
    mlp_ratio=4,
    norm_layer=torch.nn.LayerNorm,
    maxlen=CLIP_LEN,    # 243
    num_joints=17,
)
```

### 8.2 체크포인트 로드

```python
checkpoint = torch.load(WEIGHT_PATH, map_location=device)
# 체크포인트 최상위 키: ['model_pos']
state_dict = checkpoint['model_pos']
state_dict = {k.replace('module.', ''): v for k, v in state_dict.items()}
model.load_state_dict(state_dict, strict=True)
model.eval().to(device)
```

### 8.3 입출력 shape

| 항목 | Shape | 설명 |
|------|-------|------|
| 입력 | `[B, T, 17, 2]` | H36M 순서 2D 좌표 (정규화) |
| 출력 | `[B, T, 17, 3]` | H36M 순서 3D 좌표 |

### 8.4 슬라이딩 윈도우 처리

```python
def sliding_inference(model, pose_2d, clip_len=243):
    """
    pose_2d: [T, 17, 2]
    반환: [T, 17, 3]
    """
    T = pose_2d.shape
    if T <= clip_len:
        padded = np.zeros((clip_len, 17, 2))
        padded[:T] = pose_2d
        inp = torch.tensor(padded).unsqueeze(0).float().to(device)
        with torch.no_grad():
            out = model(inp)
        return out[0, :T].cpu().numpy()
    else:
        stride = clip_len // 2
        results = np.zeros((T, 17, 3))
        counts  = np.zeros((T, 1, 1))
        for start in range(0, T - clip_len + 1, stride):
            end = start + clip_len
            inp = torch.tensor(pose_2d[start:end]).unsqueeze(0).float().to(device)
            with torch.no_grad():
                out = model(inp).cpu().numpy()
            results[start:end] += out
            counts[start:end]  += 1
        return results / np.maximum(counts, 1)
```

---

## 9. Step 6 — 발 joint 후처리 (HALPE-26 완성)

DSTformer 출력은 H36M 17 joint만 포함한다.
HALPE-26 완성을 위해 발 6개 joint를 3D ankle 기준으로 후처리한다.
얼굴 5개 joint (nose, left_eye, right_eye, left_ear, right_ear)는 골프 스윙 분석에서 불필요하여 제외한다.

### 9.1 후처리 대상 joint

| HALPE idx | 이름 | 기준 anchor | 활용 |
|----------|------|------------|------|
| 20 | left_big_toe | H36M LAnkle[6] | 체중이동 분석 |
| 21 | right_big_toe | H36M RAnkle[3] | 체중이동 분석 |
| 22 | left_small_toe | H36M LAnkle[6] | 발 방향 분석 |
| 23 | right_small_toe | H36M RAnkle[3] | 발 방향 분석 |
| 24 | left_heel | H36M LAnkle[6] | stance 분석 |
| 25 | right_heel | H36M RAnkle[3] | stance 분석 |

### 9.2 후처리 코드

```python
HALPE_TO_H36M_ANKLE = {
    20: 6, 21: 3, 22: 6, 23: 3, 24: 6, 25: 3
}
HALPE_ANKLE_2D = {6: 15, 3: 16}  # H36M LAnkle→HALPE15, RAnkle→HALPE16

def lift_foot_joints(
    pose_3d: np.ndarray,       # [T, 17, 3] DSTformer 출력
    pose_2d_halpe: np.ndarray  # [T, 26, 2] RTMPose 원본
) -> np.ndarray:
    """반환: [T, 26, 3] — 발 6개 채워진 HALPE-26 3D"""
    T = pose_3d.shape
    result = np.zeros((T, 26, 3))

    H36M_TO_HALPE_OUT = {
        0:19, 1:12, 2:14, 3:16, 4:11, 5:13, 6:15,
        8:18, 9:18, 10:17, 11:5, 12:7, 13:9, 14:6, 15:8, 16:10
    }
    for h36m_idx, halpe_idx in H36M_TO_HALPE_OUT.items():
        result[:, halpe_idx, :] = pose_3d[:, h36m_idx, :]

    for halpe_foot_idx, h36m_ankle_idx in HALPE_TO_H36M_ANKLE.items():
        halpe_ankle_idx = HALPE_ANKLE_2D[h36m_ankle_idx]
        ankle_3d = pose_3d[:, h36m_ankle_idx, :]
        ankle_2d = pose_2d_halpe[:, halpe_ankle_idx, :]
        foot_2d  = pose_2d_halpe[:, halpe_foot_idx, :]
        offset_2d = foot_2d - ankle_2d
        offset_3d = np.concatenate(
            [offset_2d, np.zeros((T, 1))], axis=-1
        )
        result[:, halpe_foot_idx, :] = ankle_3d + offset_3d

    return result
```

---

## 10. Step 7 — 정규화 및 flip 보정

### 10.1 body-scale 정규화

```python
def normalize_by_shoulder_width(pose_3d: np.ndarray) -> np.ndarray:
    """pose_3d: [T, 26, 3], HALPE left_shoulder=5, right_shoulder=6"""
    l_shoulder = pose_3d[:, 5, :]
    r_shoulder = pose_3d[:, 6, :]
    shoulder_width = np.linalg.norm(l_shoulder - r_shoulder, axis=-1, keepdims=True)
    shoulder_width = np.maximum(shoulder_width, 1e-6)
    hip_center = pose_3d[:, 19, :]
    normalized = (pose_3d - hip_center[:, np.newaxis, :]) / shoulder_width[:, np.newaxis, :]
    return normalized
```

### 10.2 오른손 골퍼 flip 보정

```python
def flip_to_right_handed(pose_3d: np.ndarray, is_left_handed: bool) -> np.ndarray:
    if is_left_handed:
        pose_3d = pose_3d.copy()
        pose_3d[:, :, 0] *= -1
    return pose_3d
```

### 10.3 score < 0.3 프레임 보간

```python
def interpolate_low_confidence(pose_2d: np.ndarray, scores: np.ndarray,
                                threshold: float = 0.3) -> np.ndarray:
    """pose_2d: [T, 26, 2] / scores: [T, 26]"""
    for j in range(26):
        low_conf = scores[:, j] < threshold
        if low_conf.any() and (~low_conf).sum() >= 2:
            t = np.arange(len(pose_2d))
            for dim in range(2):
                pose_2d[low_conf, j, dim] = np.interp(
                    t[low_conf], t[~low_conf], pose_2d[~low_conf, j, dim]
                )
    return pose_2d
```

---

## 11. 랜드마크 종류별 처리 방식 총정리

| HALPE idx | 이름 | DSTformer 직접 리프팅 | 후처리 방식 | 골프 분석 활용 |
|----------|------|:-------------------:|-----------|-------------|
| 0 | nose | ❌ | 제외 (얼굴) | ✖ 불필요 |
| 1 | left_eye | ❌ | 제외 (얼굴) | ✖ 불필요 |
| 2 | right_eye | ❌ | 제외 (얼굴) | ✖ 불필요 |
| 3 | left_ear | ❌ | 제외 (얼굴) | ✖ 불필요 |
| 4 | right_ear | ❌ | 제외 (얼굴) | ✖ 불필요 |
| 5 | left_shoulder | ✅ H36M[11] | — | X_FACTOR, SHOULDER_ROT |
| 6 | right_shoulder | ✅ H36M[14] | — | X_FACTOR, SHOULDER_ROT |
| 7 | left_elbow | ✅ H36M[12] | — | BACKSWING_MAX, WRIST_ANGLE |
| 8 | right_elbow | ✅ H36M[15] | — | BACKSWING_MAX, WRIST_ANGLE |
| 9 | left_wrist | ✅ H36M[13] | — | WRIST_ANGLE, TOP_PAUSE_MS |
| 10 | right_wrist | ✅ H36M[16] | — | WRIST_ANGLE, TOP_PAUSE_MS |
| 11 | left_hip | ✅ H36M[4] | — | X_FACTOR, HIP_ROTATION |
| 12 | right_hip | ✅ H36M[1] | — | X_FACTOR, HIP_ROTATION |
| 13 | left_knee | ✅ H36M[5] | — | 체중이동 |
| 14 | right_knee | ✅ H36M[2] | — | 체중이동 |
| 15 | left_ankle | ✅ H36M[6] | — | STANCE_RATIO |
| 16 | right_ankle | ✅ H36M[3] | — | STANCE_RATIO |
| 17 | head | ✅ H36M[10] | — | HEAD_SWAY |
| 18 | neck | ✅ H36M[8,9] | — | 상체 기준 |
| 19 | hip (root) | ✅ H36M[0] | — | SPINE_TILT |
| 20 | left_big_toe | ❌ | ankle 기준 오프셋 | 체중이동 |
| 21 | right_big_toe | ❌ | ankle 기준 오프셋 | 체중이동 |
| 22 | left_small_toe | ❌ | ankle 기준 오프셋 | 발 방향 |
| 23 | right_small_toe | ❌ | ankle 기준 오프셋 | 발 방향 |
| 24 | left_heel | ❌ | ankle 기준 오프셋 | STANCE_RATIO |
| 25 | right_heel | ❌ | ankle 기준 오프셋 | STANCE_RATIO |
| — | Spine | ❌ (H36M[7]) | Hip+Thorax 중간 보간 | SPINE_TILT |

**요약:**
- ✅ DSTformer 직접 리프팅: **17개** (H36M body)
- ⚠️ 보간 처리: **1개** (Spine)
- ⚠️ 발 후처리: **6개** (big_toe, small_toe, heel × 2)
- ✖ 제외: **5개** (얼굴 joints)

---

## 12. 출력 JSON 스키마

```json
{
  "video": "1003_square",
  "view_type": "face_on",
  "fps": 29.97,
  "total_frames": 298,
  "keypoint_format": "halpe26_3d",
  "pipeline": {
    "pose_extractor": "RTMPose BodyWithFeet balanced",
    "lifter": "MotionBERT DSTformer (dim_feat=256, depth=5)",
    "normalization": "shoulder_width",
    "flip_correction": true
  },
  "events": {
    "address": 12,
    "toe_up": 28,
    "mid_backswing": 44,
    "top": 64,
    "mid_downswing": 76,
    "impact": 92,
    "mid_follow_through": 108,
    "finish": 120
  },
  "frames": [
    {
      "frame": 0,
      "timestamp": 0.0,
      "landmarks_3d": [
        { "idx": 5,  "name": "left_shoulder",  "x": 0.312, "y": -0.421, "z": 0.088 },
        { "idx": 6,  "name": "right_shoulder", "x": -0.298, "y": -0.435, "z": 0.076 }
      ]
    }
  ]
}
```

---

## 13. 디렉토리 구조
DRIVE_ROOT/
├── step2_rtmpose_halpe26/ ← 입력 (RTMPose 2D, ✅ 완료)
│ ├── dtl/
│ ├── face_on/
│ └── other/
│
├── step4_swingnet_enhanced/ ← SwingNet 이벤트 참조 (✅ 완료)
│ ├── dtl/
│ ├── face_on/
│ └── other/
│
└── step25_lifted/ ← 출력 (3D 리프팅 완료, 🔨 진행 중)
├── dtl/
├── face_on/
└── other/

text

---

## 14. Fallback Plan

| 리스크 | 대체 방안 | 적용 조건 |
|--------|-----------|----------|
| RTMPose score < 0.3 | 인접 프레임 선형 보간 | 전체 프레임의 30% 이상 |
| SwingNet 탐지 실패 | 손목 Y좌표 극소 규칙 기반 | 8개 이벤트 중 2개 이상 미탐지 |
| DSTformer OOM | 배치 크기 축소 또는 CPU 추론 | CUDA OOM 발생 시 |
| 발 joint score < 0.3 | ankle 좌표 그대로 복사 (오프셋 0) | 해당 프레임 한정 |
| 3D 리프팅 이상치 | ±3σ 이상 좌표를 인접 프레임 평균으로 교체 | 전처리 후 검증 단계 |
| 세션 중단 후 재실행 | 이미 처리된 파일 자동 skip | 출력 파일 존재 여부 확인 |

---

## 15. 용어 정의

| 용어 | 정의 |
|------|------|
| HALPE-26 | RTMPose가 출력하는 26개 keypoint 포맷. 기본 17 body + head/neck/hip + 발 6개 포함 |
| H36M | Human3.6M 데이터셋 기반 17 joint 체계. DSTformer 입출력 포맷 |
| DSTformer | MotionBERT의 핵심 모델. 2D 포즈 시퀀스를 3D로 리프팅하는 듀얼 스트림 트랜스포머 |
| 3D 리프팅 | 2D 좌표(x, y)를 3D 좌표(x, y, z)로 추정하는 작업 |
| Spine 보간 | HALPE-26에 없는 H36M Spine[7]을 Hip[0]과 Thorax[8] 중간값으로 생성 |
| body-scale 정규화 | 어깨 너비를 기준으로 3D 좌표를 정규화하여 신체 크기 차이를 보정 |
| SwingNet | GolfDB 논문 동반 이벤트 탐지 모델. 영상에서 8개 스윙 이벤트 프레임을 자동 탐지 |
| 슬라이딩 윈도우 | 프레임 수가 clip_len(243)을 초과하는 경우 중첩 윈도우로 분할 추론하는 방식 |
| flip 보정 | 왼손 골퍼 영상을 오른손 기준으로 x축 반전하여 데이터를 통일 |
| step25_lifted | Step 2(2D 추출)와 Step 3(이벤트 탐지) 사이에 추가된 3D 리프팅 단계 산출물 |

---

> **버전 히스토리**
> - v1.0: MediaPipe 기반 초기 설계
> - v2.1: SwingNet 통합, 8단계 파이프라인 상세화
> - v3.0: RTMPose(HALPE-26) + DSTformer(MotionBERT) 기반 전면 재설계
> - **v3.1 (현재):** Step별 실행 순서 및 작업 체크리스트 추가
>
> 작성: 컴퓨터공학부 4학년 종합 프로젝트팀