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

## Phase 7: 동작 품질 개선 — 팔 보호 + 하이브리드 블렌딩

### 목표
팔 비정상 꺾임, 마지막 동작 후 팔 드랍, face_on 자기가림 구간 불안정 동작을 수정하여
실제 골프 스윙에 가까운 시각적 품질을 달성한다.

> **근본 원인**: MediaPipe 단안 카메라 깊이 추정 오차 + face_on 자기가림(left arm)은
> 코드로 완전 해결 불가. 이 Phase는 데이터 한계를 보완 전략으로 커버한다.

### 작업 항목

#### A. 해부학적 팔꿈치 각도 제약 (Anatomical Clamp)
- [x] `BoneMapper`에 팔꿈치 과신전 방지 (`maxElbowAngle = 140°`)
- [x] `ClampElbowAngle()` — 상완→전완 벡터 각도 초과 시 전완 회전 보정

#### B. Visibility 기반 팔 포즈 고정 (Freeze-on-Low-Vis)
- [x] 팔 visibility < `armFreezeVisThreshold` (기본 0.35) 구간에서 이전 프레임 포즈 유지
- [x] `ApplyArmProtection()` — visibility 역비례 Slerp 고정 (저가시성 → 이전 포즈 비율 ↑)

#### C. Finish Phase 시간 기반 Hold
- [x] finish 이벤트 이후 `finishBlendTimer` 축적 → 시간이 지날수록 캡처 포즈 비율 증가
- [x] visibility 가중치 + 시간 가중치 `max()` 조합 → 자연스러운 ease-in
- [x] `finishHoldTime` 파라미터로 페이드-인 속도 조절

#### D. Drive Motion Prior 블렌딩 (실험 기능, 기본 비활성)
- [x] Mixamo `Y Bot@Golf Drive.fbx`를 `Assets/Animations/`에 배치
- [x] `ReferenceAnimationSampler.cs` — SwingNet 8이벤트 타임스탬프와 Drive 클립 시간 매핑
- [x] 팔 4본 전용 샘플링 → Hips/Spine/Chest/Head/Arms/Legs 주요 본 샘플링으로 확장
- [x] `HybridBlender.cs` — Drive 모션을 기본 prior로 상시 블렌딩
- [x] visibility, 손목 분리, 프레임 점프, 팔꿈치 각도 기반 부위별 신뢰도 계산
- [x] 저신뢰도 구간은 해당 부위 Drive 비중 자동 상승 (`maxUnreliableBlend`)
- [x] finish / mid_follow_through 구간은 팔 Drive 비중 강제 상승
- [x] `BoneMapper.ApplyPose` 시그니처에 `frameIndex`와 `phase` 전달 → Motion Prior 연동
- [x] 개별 스윙 재현 목표와 충돌 가능성이 있어 `enableMotionPrior = false` 기본값으로 비활성화

#### E. 데이터 기반 자기 보정 파이프라인 (Drive 대체 방향)
- [x] 외부 Drive 모션 대신 해당 스윙 데이터 내부의 신뢰 가능한 프레임만 사용
- [x] `PoseCorrector`에 Sequence Arm Stabilization 추가
  - visibility, 프레임 점프, face_on depth 조건으로 팔꿈치/손목 신뢰도 판정
  - 저신뢰도 구간은 같은 스윙의 전후 신뢰 프레임으로 보간
  - 팔꿈치/손목 moving average 스무딩 및 face_on Z 제한 적용
- [x] `BoneMapper`에 Constrained Arm IK 추가
  - 팔 FK를 기본적으로 건너뛰고 손목 target + 팔꿈치 hint 기반 TwoBoneIK로 팔 적용
  - 기존 `IKController` 팔 IK와 중복되지 않도록 `SkipArms` 연동
- [ ] 양손 그립, 발 접지, 척추 twist 범위를 더 강한 hard/soft constraint로 확장
- [ ] Play Mode에서 `sequenceJumpThreshold`, `smoothingBlend`, `constrainedArmIKWeight` 튜닝

### 산출물
- `BoneMapper.cs` 수정 (A, B, C + Drive Motion Prior 인터페이스 통합)
- `ReferenceAnimationSampler.cs` ✅ 전신 주요 본 샘플링으로 확장
- `HybridBlender.cs` ✅ Motion Prior 실험 기능으로 유지하되 기본 비활성화
- `PoseCorrector.cs` ✅ 스윙 데이터 내부 기준 시퀀스 안정화 추가
- 목표: 여러 입력 스윙 데이터의 개별 차이를 유지하면서, 비정상 관절 붕괴는 데이터 내부 보간과 제약 기반 IK로 억제

---

## Phase 8: 최적화 및 모바일 빌드

### 목표
모바일 환경에서 안정적으로 60fps를 유지하며, UaaL 통합 가능한 상태로 빌드한다.

### 작업 항목

- [ ] 성능 프로파일링 (Unity Profiler)
  - CPU: 회전 계산, JSON 파싱 부하 측정
  - GPU: 렌더링 드로콜 최적화
  - 메모리: 포즈 데이터 메모리 풋프린트 확인

- [ ] 최적화
  - [x] JSON 데이터 → `PoseDataCache` ScriptableObject 바이너리 캐시 (`Window → Golf Simulation → Rebuild Pose Cache`)
  - [x] `PoseDataLoader`에 캐시 우선 로딩 추가 (캐시 없으면 JSON 폴백)
  - [ ] 프레임별 계산을 Job System / Burst Compiler로 병렬화
  - [ ] LOD 설정 (카메라 거리 기반 메시 단순화)

- [x] UaaL 통합 준비
  - [x] `SwingSimulationController.cs` — Play/Pause/Stop/SeekFrame/LoadSwingData/SetPlaybackSpeed
  - [x] `PoseDataLoader.LoadFromFile()` — 런타임 파일 교체 API
  - [x] `SwingPlayer.ReinitializeWithLoader()` — 재로딩 후 BoneMapper/Filter 재초기화
  - [x] `UnitySendMessage` 인터페이스 문서화 (Swift / Kotlin 예시 포함)
  - [ ] Unity Player Settings — UaaL 빌드 설정 (사용자 작업 필요)
    - iOS: Build → Export as XCFramework
    - Android: Build → Export Project

- [ ] 모바일 빌드 테스트 (Android / iOS)

### 산출물
- [x] `SwingSimulationController.cs` — UaaL 퍼블릭 API
- [ ] 모바일 60fps 안정 구동 (빌드 후 확인 필요)
- [ ] UaaL 빌드 설정 완료 (사용자 Player Settings 작업 필요)

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
       Phase 7 (동작 품질 개선)
         │
         ▼
       Phase 8 (최적화·모바일)
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
[Phase 7] 팔 보호 + 하이브리드 블렌딩
  │
  ▼
Y-Bot 아바타 최종 렌더링
```
