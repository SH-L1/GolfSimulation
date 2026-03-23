# GolfSimulation

모바일 환경에서 전문가 수준의 골프 스윙을 **3D 아바타로 실시간 시각화**하는 골프 코칭 애플리케이션입니다.

## 프로젝트 소개

2D/3D 환경에서 추출된 **17개의 희소(Sparse) 관절 좌표 데이터**를 기반으로, 표준화된 3D 아바타 에셋에 경량화된 좌표 데이터를 실시간으로 덮어씌우는 **절차적 애니메이션(Procedural Animation)** 기법을 채택하여 모바일 서비스에 최적화된 환경을 구축합니다.

## 핵심 기술

| 기술 | 설명 |
|------|------|
| **역운동학(IK)** | 손목·발목 좌표를 Target으로 설정하여 팔꿈치·어깨 위치를 해부학적 한계 내에서 역산 |
| **X-Factor 연산** | 양 어깨·양 골반 벡터의 방향 차이를 도출하여 척추·가슴 회전값을 보간 |
| **Slerp 보간** | 구면 선형 보간으로 30fps 데이터를 60fps 이상의 매끄러운 동작으로 재생 |
| **One Euro Filter** | 동적 로우패스 필터를 적용하여 관절 떨림(Jittering) 노이즈 제거 |
| **Grip Coupling** | Address frame 기준 양손 상대 오프셋 캐시 → TwoBoneIK로 오른팔 자동 커플링 |
| **Phase-aware Smoothing** | 스윙 페이즈별 반응도 조절 회전 레벨 시간적 스무딩 (프레임레이트 독립) |
| **Dynamic Finish Blend** | Impact 포즈 동적 캡처 → Visibility 기반 점진적 블렌딩으로 피니시 안정화 |

## 데이터 파이프라인

```
데이터 정규화 ──▶ 최적 궤적 도출 ──▶ 실시간 렌더링
(골반 중심 원점화)   (스윙 시퀀스 생성)   (뼈대 매핑 + 보간)
```

1. **데이터 정규화** - Address frame pelvis를 정적 앵커로 정규화하여 체중 이동을 보존하면서 신체 비율 차이를 배제
2. **최적 궤적 도출** - 정규화된 좌표와 물리적 지표(척추각 등)를 활용한 스윙 시퀀스를 경량 데이터 포맷으로 출력 + 스윙 이벤트(8개 페이즈) 메타데이터
3. **실시간 렌더링** - 5단계 파이프라인: FK → Grip Coupling → IK → Finish Blend → Phase-aware Smoothing

## 입력 데이터 소스

| 항목 | 값 |
|------|-----|
| **추출 도구** | MediaPipe Pose (MPP) |
| **키포인트 수** | 17개 (COCO 기반) |
| **좌표계 변환** | 골반 중심 원점화 → Y축 반전(Unity) → Z축 스케일링(×0.3) |
| **프레임레이트** | 29.97 fps |
| **뷰 타입** | face_on |

### 키포인트 목록

```
nose, left_eye, right_eye, left_ear, right_ear,
left_shoulder, right_shoulder, left_elbow, right_elbow,
left_wrist, right_wrist, left_hip, right_hip,
left_knee, right_knee, left_ankle, right_ankle
```

### 좌표 전처리 파이프라인 (v2 — 정적 정규화)

```
원본 MPP 좌표 ──▶ 정적 앵커 정규화 ──▶ Visibility 필터 ──▶ Y축 반전 ──▶ Z축 스케일링(×0.3)
                  (Address frame #27   (threshold 0.5     (Unity 좌표계  (깊이 보정)
                   pelvis 고정)         미만 키포인트 교체)  y = -y)
```

> **정적 vs 동적 정규화**: 기존(v1)은 매 프레임 pelvis를 (0,0)으로 정규화하여 루트 이동 정보가 손실되었으나, v2는 Address frame(#27) pelvis만 고정 앵커로 사용하여 프레임 간 실제 체중 이동을 보존합니다.

### 스윙 이벤트 메타데이터

| 이벤트 | 프레임 | 타임스탬프 |
|--------|--------|-----------|
| Address | 27 | 0.90s |
| Toe Up | 45 | 1.50s |
| Mid Backswing | 48 | 1.60s |
| Top | 59 | 1.97s |
| Mid Downswing | 64 | 2.14s |
| Impact | 67 | 2.24s |
| Mid Follow Through | 69 | 2.30s |
| Finish | 83 | 2.77s |

> **참고**: `left_elbow`(min vis 0.15)과 `left_wrist`(min vis 0.24)는 visibility가 낮은 구간이 존재하여 One Euro Filter 적용이 필수적입니다. v2 데이터에서는 visibility 0.5 미만 키포인트가 사전 보정되어 데이터 품질이 향상되었습니다.

## 기술 스택

- **포즈 추출**: MediaPipe Pose (17 keypoints, z_scale=0.3)
- **렌더링 엔진**: Unity 6.3 LTS (6000.3.6f1)
  - **UaaL(Unity as a Library)**: React Native, Flutter, 네이티브 앱에 3D 뷰어 삽입
  - **모바일 최적화**: 경량 빌드, 배터리 효율 극대화
  - **백엔드 통신**: 실시간 스트리밍 데이터 파싱 및 관절 제어 시스템 연결

## 아바타

- **모델**: Mixamo Y-Bot (T-Pose, FBX)
- **리그**: Unity Humanoid
- **체형 대응**: Position→Rotation 변환 방식으로 원본 체형에 무관하게 동작 재현

## 문서

- [3D 스윙 시각화 아키텍처](docs/architecture/3d-swing-visualization.md)
- [구현 계획 (Phase 1~7)](PLAN.md)

## 프로젝트 구조

```
GolfSimulation/
├── data/
│   └── pose/
│       └── golf_swing_pose.json       # MPP 추출 스윙 포즈 데이터
├── docs/
│   └── architecture/
│       └── 3d-swing-visualization.md  # 아키텍처 설계 문서
├── GolfSimulation/                    # Unity 프로젝트
└── README.md
```
