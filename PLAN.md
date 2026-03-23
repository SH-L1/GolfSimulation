# 골프 스윙 3D 시각화 — 구현 계획

## 개요

MediaPipe Pose에서 추출된 17개 키포인트 좌표 데이터를 Unity Y-Bot 아바타에 절차적 애니메이션으로 적용하여, 모바일 환경에서 골프 스윙을 3D로 재현하는 시스템을 구축한다.

---

## 사전 준비 (Pre-requisites)

### 개발 환경

| 항목 | 설정 |
|------|------|
| **Unity 버전** | Unity 6.3 LTS (6000.3.6f1) |
| **렌더 파이프라인** | URP (프로젝트 생성 시 "3D (URP)" 템플릿) |
| **아바타** | Mixamo Y-Bot (T-Pose, FBX, With Skin, 애니메이션 미포함) |

### 필수 패키지 (Package Manager)

| 패키지 | 용도 | 사용 Phase |
|--------|------|-----------|
| **Animation Rigging** | 런타임 IK 솔버 (Two Bone IK Constraint 등) | Phase 4 |
| **Newtonsoft Json** (com.unity.nuget.newtonsoft-json) | JSON 파싱 — JsonUtility의 중첩 배열 처리 한계 보완 | Phase 1 |
| **TextMeshPro** | 디버그 UI (X-Factor 각도, 필터 파라미터 표시) | Phase 3, 5 |

### Unity 프로젝트 설정

| 항목 | 경로 | 값 |
|------|------|----|
| Color Space | Player → Other Settings | **Linear** |
| Graphics API | Player → Other Settings | Android: Vulkan + OpenGLES3 / iOS: Metal |
| Scripting Backend | Player → Other Settings | **IL2CPP** |
| Anti-Aliasing | URP Asset | **4x MSAA** |

### Y-Bot 임포트 확인

1. Mixamo에서 Y-Bot 다운로드 (FBX Binary, T-Pose, With Skin)
2. Unity Inspector → Y-Bot FBX → Rig 탭
   - Animation Type: **Humanoid**
   - Avatar Definition: **Create From This Model**
   - Apply → Configure → 모든 본 초록색 확인

### Unity Assets 폴더 구조

```
Assets/
├── StreamingAssets/        ← golf_swing_pose.json (런타임 교체 용이)
├── Models/
│   └── YBot/              ← Y-Bot FBX + Materials
├── Scripts/
│   ├── Data/              ← PoseDataLoader, 데이터 구조체
│   ├── Core/              ← BoneMapper, SwingPlayer
│   ├── IK/                ← IKController
│   ├── Resolver/          ← SpineResolver, HeadResolver
│   ├── Filter/            ← OneEuroFilter, SlerpInterpolator
│   └── Utility/           ← 디버그, 튜닝 UI
├── Animations/            ← 정적 그립 포즈
├── Prefabs/
└── Scenes/
    └── Main.unity
```

### 체크리스트

- [x] Unity 6.3 LTS (6000.3.6f1) 설치 완료
- [x] URP 프로젝트 생성 완료 (Mobile/PC 듀얼 Quality Tier 구성됨)
- [x] Mixamo Y-Bot FBX 다운로드 완료 (`Assets/Y Bot.fbx` 배치됨)
- [x] Y-Bot Humanoid 리그 매핑 정상 확인 (Configure → 모든 본 초록색)
- [x] Newtonsoft Json 패키지 설치 완료 (v3.2.2)
- [x] Animation Rigging 패키지 설치 완료 (v1.4.1)
- [x] StreamingAssets 폴더에 `golf_swing_pose.json` 복사 완료

---

## Phase 1: 프로젝트 세팅 및 데이터 로딩

### 목표
Unity 프로젝트에서 Y-Bot을 배치하고, JSON 포즈 데이터를 프레임 단위로 파싱할 수 있는 상태까지 구축한다.

### 작업 항목

- [x] Unity 프로젝트 기본 환경 구성 (URP, 카메라, 조명)
- [x] Mixamo Y-Bot FBX 임포트 및 Humanoid 리그 설정
  - Rig → Animation Type: **Humanoid**
  - Avatar Definition: **Create From This Model**
  - Configure에서 모든 본 매핑 확인 (초록색)
- [x] Y-Bot T-Pose 상태로 씬에 배치
- [x] JSON 데이터 로더 스크립트 작성
  - `golf_swing_pose.json` 파싱
  - 프레임별 17개 키포인트(x, y, z, visibility) 구조체 매핑
  - 타임스탬프 기반 프레임 인덱싱
- [x] 디버그용 키포인트 시각화 (Gizmos로 17개 점 표시)

### 산출물
- `PoseDataLoader.cs` — JSON 파싱 및 데이터 구조체
- `PoseDebugVisualizer.cs` — 키포인트 Gizmo 표시
- 씬에서 Y-Bot + 17개 점이 동시에 보이는 상태

---

## Phase 2: 본 매핑 및 회전 변환 (핵심)

### 목표
17개 키포인트 좌표를 Y-Bot의 Humanoid 본에 **회전(Rotation)**으로 변환하여 적용한다. 체형 차이에 무관하게 동작이 재현되는 구조를 확립한다.

### 핵심 원리

```
좌표(Position) → 방향 벡터(Direction) → 회전(Quaternion) → 본 적용
```

### 작업 항목

- [x] Y-Bot T-Pose 기준 방향 벡터 캐싱
  - 각 본의 기본 방향(rest direction)을 시작 시 저장
- [x] 키포인트 → 본 매핑 테이블 정의

  | MPP Keypoint | Y-Bot Bone | 변환 방식 |
  |-------------|------------|----------|
  | left/right_hip 중점 | Hips | 위치(Position) + 스케일 보정 |
  | shoulder → elbow | UpperArm | 방향 → 회전 |
  | elbow → wrist | ForeArm (LowerArm) | 방향 → 회전 |
  | hip → knee | UpperLeg | 방향 → 회전 |
  | knee → ankle | LowerLeg | 방향 → 회전 |

- [x] 방향 벡터 → Quaternion 변환 로직 구현
  ```
  current_dir = normalize(child_keypoint - parent_keypoint)
  rotation = Quaternion.FromToRotation(tpose_dir, current_dir)
  bone.rotation = rotationDelta * tposeRotation
  ```
- [x] Hips(루트 본) 위치 적용 — 스케일 비율 보정
  ```
  scale = avatar_hip_to_ankle / source_hip_to_ankle
  hips.position = hipsRestPosition + pelvisCenter * scale
  ```
- [x] 프레임 재생 시스템 구현 (타임스탬프 기반 순차 재생)

### 산출물
- `BoneMapper.cs` — 키포인트→본 매핑 및 회전 변환
- `SwingPlayer.cs` — 프레임 순차 재생 컨트롤러
- Y-Bot이 기본 골프 스윙 동작을 따라하는 상태 (거친 동작)

---

## Phase 3: 누락 부위 복원 (척추·가슴·목·머리)

### 목표
17개 키포인트에 없는 척추, 가슴, 목 등의 회전값을 수학적으로 계산하여 자연스러운 상체 표현을 완성한다.

### 작업 항목

- [x] **척추 체인 회전 분배 (X-Factor)**
  ```
  어깨 벡터 = right_shoulder - left_shoulder
  골반 벡터 = right_hip - left_hip
  X-Factor = angle(어깨 벡터, 골반 벡터)

  Spine  회전 = 몸통 기울기 × X-Factor × 0.3
  Spine1 회전 = 몸통 기울기 × X-Factor × 0.6
  Spine2 회전 = 몸통 기울기 × X-Factor × 0.9
  ```

- [x] **목(Neck) 보간**
  ```
  어깨 중점 = (left_shoulder + right_shoulder) / 2
  neck_dir = normalize(nose - 어깨 중점)
  → Neck 본 회전 적용
  ```

- [x] **머리(Head) 회전**
  ```
  forward = nose - ear 중점
  up = cross(right_ear - left_ear, forward)
  head_rotation = Quaternion.LookRotation(forward, up)
  ```

- [x] X-Factor 디버그 표시 (실시간 각도값 UI 출력)

### 산출물
- `SpineResolver.cs` — X-Factor 연산 및 척추 체인 회전 분배
- `HeadResolver.cs` — 목·머리 회전 계산
- 상체 꼬임이 자연스럽게 표현되는 상태

---

## Phase 4: IK 시스템 및 Visibility 블렌딩

### 목표
Unity IK 솔버를 활용하여 말단(wrist, ankle) 기반의 정밀한 관절 위치를 보정하고, visibility가 낮은 구간에서 자연스러운 폴백을 구현한다.

### 작업 항목

- [x] 수동 Two-Bone IK 솔버 구현 (animator.enabled=false 환경 대응)
- [x] **IK Target 설정**
  - 양 손목(wrist) → Hand IK Target
  - 양 발목(ankle) → Foot IK Target
  - IK가 elbow/knee hint를 통해 자연스러운 관절 꺾임 유도

- [x] **Visibility 기반 블렌딩**
  ```
  if (visibility > 0.7)
      → 실측 데이터 100% 사용
  else if (visibility > 0.3)
      → 실측 데이터와 IK 역산 결과를 Lerp 블렌딩
  else
      → IK 역산 결과 100% 사용
  ```
  - 특히 `left_elbow`(min vis 0.15), `left_wrist`(min vis 0.24) 구간 대응

- [x] IK 해부학적 제약조건 설정
  - Two-Bone IK hint 기반 벤드 방향 제어
  - Law of Cosines 기반 관절 각도 클램핑 (도달 불가 시 max/min reach 제한)

### 산출물
- `IKController.cs` — IK 타겟 관리 및 visibility 블렌딩
- visibility가 낮은 구간에서도 팔이 자연스럽게 유지되는 상태

---

## Phase 5: 보간 및 노이즈 필터링

### 목표
29.97fps 데이터를 60fps 이상으로 부드럽게 업스케일링하고, 프레임 간 관절 떨림을 제거한다.

### 작업 항목

- [x] **Slerp 보간 구현**
  ```
  데이터 프레임(29.97fps)  ●──────────────●──────────────●
                            ↓   Slerp 보간   ↓
  렌더링 프레임(60fps+)    ●──●──●──●──●──●──●──●──●──●
  ```
  - 인접 2개 데이터 프레임 사이를 `Quaternion.Slerp()`로 보간
  - 위치(Hips)는 `Vector3.Lerp()`로 보간
  - `Time.time` 기반 보간 비율(t) 계산

- [x] **One Euro Filter 구현**
  - 빠른 동작(다운스윙): 지연 최소화 (β 높음)
  - 느린 동작(어드레스, 피니시): 강한 스무딩 (β 낮음)
  - 파라미터: `minCutoff`, `beta`, `dCutoff`
  - 각 키포인트(x, y, z)에 독립 적용

- [x] 필터 파라미터 튜닝용 런타임 UI (슬라이더)

### 산출물
- `SlerpInterpolator.cs` — 프레임 보간 시스템
- `OneEuroFilter.cs` — 동적 로우패스 필터
- `FilterTuner.cs` — 런타임 파라미터 조정 UI
- 60fps에서 매끄러운 스윙 동작 재생

---

## Phase 6: 정적 포즈 및 소품 부착

### 목표
골프 그립 애니메이션을 손목 하단에 적용하고, 클럽 오브젝트를 동적으로 부착한다.

### 작업 항목

- [x] 골프 그립 정적 포즈 제작
  - 양손 Finger 본에 그립 자세 Quaternion 값 설정
  - 손목 하위 본에 영구 적용 (절차적 애니메이션과 독립)

- [x] 골프 클럽 3D 모델 임포트 및 배치
  - LeftHand 본에 자식으로 부착 (리드 핸드 기준)
  - 위치·회전 오프셋 조정
  - 프로시저럴 클럽 자동 생성 (외부 모델 없을 시)

- [x] 그립 + 클럽이 스윙 동작과 자연스럽게 연동되는지 확인

### 산출물
- `GripController.cs` — 정적 그립 포즈 관리
- 클럽을 쥔 아바타가 완전한 스윙 동작을 수행하는 상태

---

## JSON 데이터 구조 v2 마이그레이션

### 목표
새로운 정적 정규화 JSON 포맷(v2)에 맞게 전체 C# 스크립트를 업데이트한다.

### 작업 항목

- [x] PoseData.cs — SwingEvents, FixesApplied 클래스 추가, 레거시 필드 제거
- [x] PoseDataLoader.cs — address frame 해석, events 파싱, 스윙 페이즈 판별
- [x] BoneMapper.cs — 정적 pelvis 정규화 기반 root motion (addressPelvisOffset delta)
- [x] SwingPlayer.cs — address frame 참조, currentPhase 트래킹, pelvis_found 제거
- [x] PoseFilter.cs — pelvis_found 참조 제거

### 산출물
- 새 JSON v2 포맷 완전 호환
- 프레임 간 실제 체중 이동 반영 root motion
- 실시간 스윙 페이즈 표시 (OnGUI)

---

## 시각적 결함 수정 (Post-Phase 6)

### 목표
3대 시각적 결함(지터, 팔 분리, 피니시 붕괴)을 수정하여 아바타 동작의 시각적 품질을 확보한다.

### 작업 항목

- [x] **Issue 1: Phase-aware Rotation Smoothing** — 회전 레벨 시간적 스무딩 (프레임레이트 독립)
- [x] **Issue 2: Grip Coupling Constraint** — Address frame 기준 양손 오프셋 캐시 → TwoBoneIK로 오른팔 커플링
- [x] **Issue 3: Dynamic Finish Pose Capture** — Impact 포즈 캡처 → Visibility 기반 점진적 블렌딩
- [x] BoneMapper 5단계 파이프라인 통합 (FK → GripCoupling → IK → FinishBlend → Smoothing)
- [x] IKController SkipArms 연동 (Grip 활성 시 팔 IK 스킵)
- [x] SwingPlayer phase 전달 및 ResetPostProcessState 연동

### 산출물
- BoneMapper.cs 전면 재작성 (5단계 파이프라인)
- IKController.cs SkipArms 추가
- SwingPlayer.cs 3인자 ApplyPose + ResetPostProcessState

---

## Phase 7: 최적화 및 모바일 빌드

### 목표
모바일 환경에서 안정적으로 60fps를 유지하며, UaaL 통합 가능한 상태로 빌드한다.

### 작업 항목

- [ ] 성능 프로파일링 (Unity Profiler)
  - CPU: 회전 계산, JSON 파싱 부하 측정
  - GPU: 렌더링 드로콜 최적화
  - 메모리: 포즈 데이터 메모리 풋프린트 확인

- [ ] 최적화
  - JSON 데이터 사전 파싱하여 ScriptableObject 또는 바이너리 캐시로 변환
  - 프레임별 계산을 Job System / Burst Compiler로 병렬화
  - LOD 설정 (카메라 거리 기반 메시 단순화)

- [ ] UaaL 통합 준비
  - Unity를 라이브러리로 빌드하는 설정
  - 네이티브 앱과의 인터페이스 정의 (데이터 입력, 재생 제어)

- [ ] 모바일 빌드 테스트 (Android / iOS)

### 산출물
- 모바일 60fps 안정 구동
- UaaL 빌드 설정 완료
- 네이티브 앱 연동 인터페이스

---

## Phase 간 의존 관계

```
Phase 1 (세팅·로딩)
  │
  ▼
Phase 2 (본 매핑·회전 변환) ◀── 핵심 마일스톤: 아바타가 움직이기 시작
  │
  ├──▶ Phase 3 (누락 부위 복원)
  │
  ├──▶ Phase 4 (IK·Visibility)
  │
  └──▶ Phase 5 (보간·필터링)
         │
         ▼
       Phase 6 (그립·클럽)
         │
         ▼
       Phase 7 (최적화·모바일)
```

> **Phase 3, 4, 5는 병렬 진행 가능** — Phase 2 완료 후 독립적으로 작업할 수 있으며, 최종적으로 Phase 6에서 통합한다.

---

## 데이터 흐름 전체 파이프라인

```
golf_swing_pose.json
  │
  ▼
[Phase 1] JSON 파싱 → 프레임별 17 키포인트 배열
  │
  ▼
[Phase 5] One Euro Filter → 노이즈 제거된 좌표
  │
  ▼
[Phase 2] Position → Direction → Quaternion 변환
  │
  ├─[Phase 3] X-Factor → Spine/Chest 회전 분배
  ├─[Phase 3] Neck/Head 회전 계산
  ├─[Phase 4] IK Target 설정 + Visibility 블렌딩
  │
  ▼
[Phase 5] Slerp 보간 (29.97fps → 60fps+)
  │
  ▼
[Phase 6] 정적 그립 + 클럽 부착
  │
  ▼
Y-Bot 아바타 최종 렌더링
```
