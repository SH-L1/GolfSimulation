# 프로젝트 분석 보고서 — GolfSimulation

## 1. 프로젝트 현황 요약

| 항목 | 상태 |
|------|------|
| **Unity 버전** | 6000.3.6f1 (Unity 6.3 LTS) |
| **렌더 파이프라인** | URP v17.3.0 (Mobile/PC 듀얼 Quality Tier) |
| **아바타** | Mixamo Y-Bot (Assets/Y Bot.fbx) — Humanoid 리그 설정 필요 |
| **포즈 데이터** | StreamingAssets/golf_swing_pose.json (114 프레임, 17 키포인트) |
| **커스텀 스크립트** | 0개 (TutorialInfo 제외) — 아직 구현 시작 전 |

---

## 2. Unity 프로젝트 구조 상세 분석

### 2.1 폴더 구조

```
GolfSimulation/                          # Unity 프로젝트 루트
├── Assets/
│   ├── Y Bot.fbx                       # Mixamo Y-Bot 3D 모델
│   ├── Scenes/
│   │   └── SampleScene.unity           # 메인 씬 (카메라 + 기본 조명)
│   ├── Settings/
│   │   ├── Mobile_RPAsset.asset        # 모바일 URP 설정 (렌더 스케일 0.8)
│   │   ├── Mobile_Renderer.asset       # 모바일 렌더러
│   │   ├── PC_RPAsset.asset            # PC URP 설정 (렌더 스케일 1.0)
│   │   ├── PC_Renderer.asset           # PC 렌더러
│   │   ├── DefaultVolumeProfile.asset  # 포스트프로세싱 볼륨
│   │   └── UniversalRenderPipelineGlobalSettings.asset
│   ├── TutorialInfo/                   # Unity 기본 튜토리얼 (삭제 가능)
│   │   ├── Editor/ReadmeEditor.cs
│   │   └── Readme.cs
│   ├── InputSystem_Actions.inputactions # 입력 설정 (현재 미사용)
│   └── Readme.asset
├── StreamingAssets/
│   └── golf_swing_pose.json            # 골프 스윙 포즈 데이터
├── Packages/
│   ├── manifest.json                   # 패키지 의존성
│   └── packages-lock.json
└── ProjectSettings/
    ├── ProjectSettings.asset           # Color Space: Linear
    ├── QualitySettings.asset           # Mobile/PC 듀얼 Tier
    └── GraphicsSettings.asset          # URP Forward Rendering
```

### 2.2 설치된 패키지

| 패키지 | 버전 | 용도 | Phase |
|--------|------|------|-------|
| **com.unity.animation.rigging** | 1.4.1 | 런타임 IK 솔버 | Phase 4 |
| **com.unity.nuget.newtonsoft-json** | 3.2.2 | JSON 파싱 | Phase 1 |
| **com.unity.render-pipelines.universal** | 17.3.0 | URP 렌더링 | 전체 |
| **com.unity.inputsystem** | 1.18.0 | 입력 시스템 | Phase 7 |
| **com.unity.timeline** | 1.8.10 | 타임라인 애니메이션 | 선택적 |
| **com.unity.burst** | 1.8.27 (간접) | Burst 컴파일러 | Phase 7 최적화 |
| **com.unity.collections** | 2.6.2 (간접) | Job System 컬렉션 | Phase 7 최적화 |
| **com.unity.mathematics** | 1.3.3 (간접) | 수학 유틸리티 | Phase 2~5 |

### 2.3 URP Quality 설정

| 항목 | Mobile Tier | PC Tier |
|------|------------|---------|
| 렌더 스케일 | 0.8 (80%) | 1.0 (100%) |
| Shadow Resolution | 1024 | 2048 |
| Additional Light Shadows | 미지원 | 지원 |
| MSAA | 비활성 | 비활성 |
| Anisotropic Textures | 1 | 2 |
| HDR | 지원 | 지원 |

### 2.4 씬 구성 (SampleScene.unity)

| 오브젝트 | 컴포넌트 | 비고 |
|----------|---------|------|
| Main Camera | Camera, AudioListener | FOV 60°, Near 0.3, Far 1000, HDR 활성 |
| (기본 조명) | Light | URP 기본 Directional Light |

> Y-Bot은 아직 씬에 배치되지 않은 상태. Assets 폴더에 FBX만 존재.

---

## 3. 포즈 데이터 상세 분석

### 3.1 메타데이터

| 항목 | 값 |
|------|-----|
| 비디오 ID | 8 |
| 뷰 타입 | face_on (정면 촬영) |
| 원본 해상도 | 160×160 px |
| FPS | 29.97 |
| 총 프레임 | 114 |
| 포즈 검출 프레임 | 114/114 (100%) |
| 골반 미검출 프레임 | 0 |
| 키포인트 수 | 17 |
| 총 재생 시간 | 약 3.8초 (114 / 29.97) |

### 3.2 좌표 변환 파이프라인

```
원본 MPP 좌표 (픽셀 공간)
  │
  ▼ Step 1: 골반 중심 정규화
  pelvis_midpoint = (left_hip + right_hip) / 2
  모든 좌표에서 pelvis_midpoint를 빼서 원점 이동
  │
  ▼ Step 2: Y축 반전 (Unity 좌표계)
  y = -y  (MPP는 화면 좌표계, Unity는 월드 좌표계)
  │
  ▼ Step 3: Z축 스케일링
  z = z × 0.3  (깊이 추정값의 불확실성 보정)
  │
  ▼ 결과: Unity 좌표계 기반의 정규화된 좌표
```

### 3.3 프레임 데이터 구조

```json
{
  "frame": 0,
  "timestamp": 0.0,
  "has_pose": true,
  "pelvis_found": true,
  "landmarks": [
    {
      "name": "nose",
      "x": -0.0046,
      "y": 0.1610,
      "z": -0.2047,
      "visibility": 0.9977
    }
    // ... 17개 키포인트
  ],
  "pelvis_midpoint_offset": {
    "x": 0.4624,
    "y": 0.4510
  }
}
```

`pelvis_midpoint_offset`은 정규화 전 원본 골반 중심 위치(픽셀 좌표)로, 역변환 시 사용 가능.

### 3.4 키포인트별 좌표 범위 (프레임 0 기준)

| 키포인트 | X | Y | Z | Visibility |
|----------|-----|-----|-----|------------|
| nose | -0.005 | 0.161 | -0.205 | 0.998 |
| left_eye | 0.004 | 0.172 | -0.203 | 0.994 |
| right_eye | -0.013 | 0.170 | -0.201 | 0.997 |
| left_ear | 0.013 | 0.168 | -0.162 | 0.991 |
| right_ear | -0.021 | 0.166 | -0.154 | 0.997 |
| left_shoulder | 0.041 | 0.124 | -0.111 | 0.998 |
| right_shoulder | -0.046 | 0.113 | -0.102 | 0.999 |
| left_elbow | 0.035 | 0.045 | -0.085 | **0.483** |
| right_elbow | -0.043 | 0.048 | -0.084 | 0.946 |
| left_wrist | 0.030 | -0.016 | -0.102 | 0.712 |
| right_wrist | -0.026 | -0.017 | -0.106 | 0.942 |
| left_hip | 0.028 | 0.000 | -0.003 | 0.999 |
| right_hip | -0.028 | 0.000 | 0.003 | 0.999 |
| left_knee | 0.048 | -0.126 | -0.013 | 0.899 |
| right_knee | -0.050 | -0.124 | 0.005 | 0.976 |
| left_ankle | 0.071 | -0.241 | 0.032 | 0.957 |
| right_ankle | -0.085 | -0.232 | 0.048 | 0.991 |

### 3.5 Visibility 문제 구간

| 키포인트 | 최소 Visibility | 프레임 | 원인 추정 |
|----------|----------------|--------|----------|
| **left_elbow** | **0.149** | 마지막 프레임 (113) | 팔로스루 시 몸 뒤로 회전 |
| **left_wrist** | **0.244** (프레임 0 기준 0.712) | 후반부 프레임 | 클럽에 의한 가림 |
| **left_elbow** | **0.483** | 프레임 0 (어드레스) | 정면 촬영 시 왼팔 깊이 불확실 |

> 왼쪽 팔(left_elbow, left_wrist)의 visibility가 전반적으로 낮음. face_on(정면) 촬영 특성상 왼팔이 몸에 가려지거나 깊이 추정이 불안정. **Phase 4의 Visibility 블렌딩이 핵심적으로 중요한 구간.**

### 3.6 좌표계 특성 분석

프레임 0 데이터 기반:

- **Y축**: 위(+) / 아래(-) → nose(0.161) > shoulder(0.12) > hip(0.0) > knee(-0.125) > ankle(-0.24)
  - 골반이 원점(0.0)에 위치 — 정규화 정상 확인
- **X축**: 좌(+) / 우(-) → left 계열이 양수, right 계열이 음수
  - 좌우 대칭 확인 (left_hip: 0.028, right_hip: -0.028)
- **Z축**: 카메라 방향 기준 깊이 → 값 범위 약 -0.2 ~ +0.05
  - z_scale=0.3 적용됨 → 원래 깊이의 30%로 압축
  - nose의 z(-0.205)가 가장 작음 = 카메라에 가장 가까움

### 3.7 스윙 동작 범위 추정

프레임 0(어드레스) vs 프레임 113(피니시) 비교:

| 키포인트 | 프레임 0 Y | 프레임 113 Y | 변화량 | 해석 |
|----------|-----------|-------------|--------|------|
| nose | 0.161 | 0.217 | +0.056 | 머리 상승 (피니시 직립) |
| left_wrist | -0.016 | 0.185 | **+0.201** | 손 높이 올라감 (피니시) |
| right_wrist | -0.017 | 0.190 | **+0.207** | 손 높이 올라감 (피니시) |
| left_hip | 0.000 | 0.001 | ~0.0 | 골반 안정 (정규화 기준) |
| left_ankle | -0.241 | -0.188 | +0.053 | 발끝 들림 (피니시 회전) |

- 양 손목의 Y좌표 변화(+0.20)가 가장 큰 동작 범위를 보여줌 → 스윙의 주요 궤적
- 골반(hip)은 거의 이동 없음 → 정규화 기준점으로 적절
- 발목 상승 → 피니시 동작에서 왼발 들림 확인

---

## 4. Y-Bot 본 구조 및 키포인트 매핑 계획

### 4.1 매핑 테이블

```
Y-Bot Humanoid Bone         ←  데이터 소스              ←  변환 방식
────────────────────────────────────────────────────────────────────
Hips                        ←  (left_hip + right_hip)/2  ←  Position (스케일 보정)
  ├─ Spine                  ←  수학적 보간               ←  골반→어깨 벡터 × 0.3 + X-Factor × 0.3
  │  └─ Spine1              ←  수학적 보간               ←  골반→어깨 벡터 × 0.6 + X-Factor × 0.6
  │     └─ Spine2 (Chest)   ←  수학적 보간               ←  골반→어깨 벡터 × 0.9 + X-Factor × 0.9
  │        ├─ Neck           ←  어깨중점 → nose           ←  Direction → Rotation
  │        │  └─ Head        ←  nose, ear                 ←  LookRotation
  │        ├─ LeftUpperArm   ←  left_shoulder→left_elbow  ←  Direction → Rotation
  │        │  └─ LeftLowerArm←  left_elbow→left_wrist     ←  Direction → Rotation
  │        │     └─ LeftHand ←  정적 그립 포즈             ←  Fixed Quaternion
  │        └─ RightUpperArm  ←  right_shoulder→right_elbow←  Direction → Rotation
  │           └─ RightLowerArm← right_elbow→right_wrist   ←  Direction → Rotation
  │              └─ RightHand←  정적 그립 포즈             ←  Fixed Quaternion
  ├─ LeftUpperLeg           ←  left_hip→left_knee         ←  Direction → Rotation
  │  └─ LeftLowerLeg        ←  left_knee→left_ankle       ←  Direction → Rotation
  │     └─ LeftFoot         ←  추정 (지면 기준)            ←  Ground constraint
  └─ RightUpperLeg          ←  right_hip→right_knee       ←  Direction → Rotation
     └─ RightLowerLeg       ←  right_knee→right_ankle     ←  Direction → Rotation
        └─ RightFoot        ←  추정 (지면 기준)            ←  Ground constraint
```

### 4.2 체형 독립성 보장 방식

```
[입력] 좌표 데이터 (체형 종속)
  ↓
[추출] 방향 벡터 = normalize(child - parent)
  ↓  체형 정보(절대 길이) 제거, 자세 정보(방향)만 보존
[변환] Quaternion.FromToRotation(tpose_default_dir, current_dir)
  ↓
[적용] bone.localRotation = calculated_rotation
  ↓  본 길이 = Y-Bot 고유값 유지
[결과] 체형 무관 동작 재현
```

유일한 Position 적용: **Hips 루트 본**
```
scale_factor = avatar_hip_to_ankle_length / source_hip_to_ankle_length
hips.position = pelvis_position × scale_factor
```

---

## 5. 기술적 리스크 및 대응

### 5.1 높은 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| **left_elbow/wrist 저 visibility** | 왼팔 동작이 부자연스럽게 튈 수 있음 | Phase 4 Visibility 블렌딩 + IK 역산 폴백 |
| **Z축 깊이 부정확** | z_scale=0.3으로 이미 압축했으나, 여전히 전후 동작 부자연스러울 가능성 | One Euro Filter Z축 강화 + 해부학적 제약조건 |
| **160×160 저해상도 원본** | 키포인트 정밀도 한계 | 필터링으로 보정, 향후 고해상도 데이터 교체 |

### 5.2 중간 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| **29.97fps → 60fps 보간** | Slerp 보간 시 빠른 다운스윙 구간에서 동작 손실 가능 | 인접 프레임 간 각속도 모니터링, 필요시 3점 보간 |
| **X-Factor 분배 비율** | 0.3/0.6/0.9 비율이 실제와 맞지 않을 수 있음 | 런타임 튜닝 UI로 실시간 조정 |
| **정적 그립 포즈** | 손가락 데이터 없이 자연스러운 그립 표현 한계 | Mixamo 그립 애니메이션 참고 또는 수동 조정 |

### 5.3 낮은 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| **Y-Bot Humanoid 매핑** | Mixamo 네이밍 규칙이 Unity와 호환 → 자동 매핑 성공률 높음 | Configure에서 수동 확인 |
| **Newtonsoft JSON 파싱** | 114 프레임 × 17 키포인트 = 1,938 데이터 포인트 → 가벼움 | 문제 없음 |
| **URP 렌더링** | 단일 캐릭터 렌더링 → 성능 부하 극소 | 문제 없음 |

---

## 6. 현재 프로젝트 상태 평가

### 6.1 완료된 항목

- [x] Unity 6.3 LTS 프로젝트 생성 (URP 템플릿)
- [x] Mobile/PC 듀얼 Quality Tier 구성
- [x] Linear Color Space 설정
- [x] 필수 패키지 설치 (Animation Rigging 1.4.1, Newtonsoft Json 3.2.2)
- [x] Y-Bot FBX 임포트 (Assets/Y Bot.fbx)
- [x] 포즈 데이터 배치 (StreamingAssets/golf_swing_pose.json)
- [x] 아키텍처 문서 작성 (docs/architecture/3d-swing-visualization.md)
- [x] 구현 계획 수립 (PLAN.md — Phase 1~7)

### 6.2 즉시 필요한 작업

- [ ] **Y-Bot Humanoid 리그 설정** — FBX 임포트 설정에서 Rig → Humanoid → Apply → Configure 확인
- [ ] **Phase 1 시작** — JSON 데이터 로더 및 시각화 스크립트 구현

### 6.3 정리 가능한 항목

| 항목 | 경로 | 비고 |
|------|------|------|
| TutorialInfo 폴더 | Assets/TutorialInfo/ | Unity 기본 튜토리얼, 삭제 가능 |
| InputSystem_Actions | Assets/InputSystem_Actions.inputactions | Player 입력 매핑 — 현재 프로젝트에 불필요, Phase 7에서 재평가 |
| Readme.asset | Assets/Readme.asset | Unity 튜토리얼 에셋, 삭제 가능 |

---

## 7. 데이터 흐름 종합 다이어그램

```
┌──────────────────────────────────────────────────────────────┐
│                     golf_swing_pose.json                      │
│  114 프레임 × 17 키포인트 × (x, y, z, visibility)            │
│  29.97fps, face_on, z_scale=0.3, 골반 중심 정규화             │
└───────────────────────────┬──────────────────────────────────┘
                            │
                    [Phase 1: 파싱]
                            │
                            ▼
              ┌─────────────────────────┐
              │  Frame[] (메모리 배열)    │
              │  각 Frame: Landmark[17]  │
              └────────────┬────────────┘
                           │
                  [Phase 5: One Euro Filter]
                           │
                           ▼
              ┌─────────────────────────┐
              │  필터링된 좌표 데이터     │
              │  노이즈 제거 완료         │
              └────────────┬────────────┘
                           │
               ┌───────────┼───────────┐
               │           │           │
       [Phase 2]    [Phase 3]    [Phase 4]
    Position→       X-Factor       IK +
    Rotation       Spine 복원    Visibility
               │           │           │
               └───────────┼───────────┘
                           │
                  [Phase 5: Slerp 보간]
                  29.97fps → 60fps+
                           │
                           ▼
              ┌─────────────────────────┐
              │  [Phase 6]              │
              │  정적 그립 + 클럽 부착   │
              └────────────┬────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │  Y-Bot 아바타 렌더링     │
              │  60fps+ 매끄러운 동작    │
              └─────────────────────────┘
```

---

---

## 8. Phase 1 완료 상태

### 8.1 완료 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| Unity 6.3 LTS 프로젝트 생성 | ✅ | URP 3D 템플릿 |
| Mobile/PC 듀얼 Quality Tier | ✅ | Mobile 렌더 스케일 0.8, PC 1.0 |
| Linear Color Space | ✅ | ProjectSettings.asset 확인 |
| Animation Rigging 설치 | ✅ | v1.4.1 |
| Newtonsoft Json 설치 | ✅ | v3.2.2 |
| Y-Bot FBX 임포트 | ✅ | Assets/Y Bot.fbx |
| 포즈 데이터 배치 | ✅ | StreamingAssets/golf_swing_pose.json |

### 8.2 미완료 항목 (Unity Editor 수동 작업 필요)

| 항목 | 상태 | 필요 작업 |
|------|------|----------|
| Y-Bot Humanoid 리그 설정 | ⬜ | Project 창 → Y Bot.fbx → Inspector Rig 탭 → Humanoid → Apply → Configure |
| Y-Bot 씬 배치 | ⬜ | Y Bot.fbx를 Hierarchy에 드래그 앤 드롭 |
| 카메라 위치 조정 | ⬜ | 아바타 전신이 보이도록 Main Camera 위치·각도 조정 |
| Assets 폴더 구조 정리 | ⬜ | Scripts/, Models/ 등 하위 폴더 생성 |

---

---

## 9. Phase 2 완료 — 본 매핑 및 회전 변환

### 9.1 구현된 스크립트

| 스크립트 | 경로 | 역할 |
|----------|------|------|
| **PoseData.cs** | Scripts/Data/ | JSON 직렬화 데이터 구조체 (PoseSequence, PoseFrame, Landmark 등) |
| **PoseDataLoader.cs** | Scripts/Data/ | StreamingAssets에서 JSON 로드 + 프레임/키포인트 접근 API |
| **BoneMapper.cs** | Scripts/Core/ | 키포인트→본 회전 변환 (Position→Direction→Quaternion) |
| **SwingPlayer.cs** | Scripts/Core/ | 타임스탬프 기반 프레임 순차 재생 컨트롤러 |
| **PoseDebugVisualizer.cs** | Scripts/Utility/ | Scene 뷰 Gizmo 시각화 (17 키포인트 + 연결선) |

### 9.2 스크립트 간 의존 관계

```
SwingPlayer (재생 제어)
  ├── PoseDataLoader (데이터 공급)
  │     └── PoseData (구조체 정의)
  └── BoneMapper (본 적용)
        └── Animator (Unity Humanoid)

PoseDebugVisualizer (독립 디버그)
  ├── PoseDataLoader
  └── SwingPlayer (현재 프레임 인덱스 참조)
```

### 9.3 핵심 알고리즘: Position → Rotation 변환

```
[초기화 — T-Pose 캐싱]
  각 본(bone)에 대해:
    tposeDir[bone] = normalize(childBone.position - bone.position)
    tposeRot[bone] = bone.rotation

[매 프레임 — 회전 적용]
  각 본(bone)에 대해:
    currentDir = normalize(childKeypoint - parentKeypoint)
    rotationDelta = Quaternion.FromToRotation(tposeDir, currentDir)
    bone.rotation = rotationDelta × tposeRot
```

**체형 독립성 보장**: 방향(Direction)만 추출하므로 원본 신체 길이 정보가 제거됨. 본 길이는 Y-Bot 고유값 유지.

### 9.4 본 매핑 구현 상세

| MPP 키포인트 쌍 | Y-Bot Bone | HumanBodyBones 열거형 |
|-----------------|-----------|----------------------|
| left_hip + right_hip 중점 | Hips | Hips (Position 적용) |
| left_shoulder → left_elbow | LeftUpperArm | LeftUpperArm |
| left_elbow → left_wrist | LeftLowerArm | LeftLowerArm |
| right_shoulder → right_elbow | RightUpperArm | RightUpperArm |
| right_elbow → right_wrist | RightLowerArm | RightLowerArm |
| left_hip → left_knee | LeftUpperLeg | LeftUpperLeg |
| left_knee → left_ankle | LeftLowerLeg | LeftLowerLeg |
| right_hip → right_knee | RightUpperLeg | RightUpperLeg |
| right_knee → right_ankle | RightLowerLeg | RightLowerLeg |

### 9.5 Hips 위치 스케일 보정

```
avatarLegLength = Distance(hips.position, leftFoot.position)
sourceLegLength = Distance(left_hip, left_ankle)  // 프레임 0 기준
scaleFactor = avatarLegLength / sourceLegLength

hips.position = hipsRestPosition + pelvisCenter × scaleFactor
```

### 9.6 재생 시스템 사양

| 항목 | 값 |
|------|-----|
| 재생 방식 | LateUpdate에서 타임스탬프 기반 프레임 인덱싱 |
| 재생 속도 | 0.1x ~ 3.0x 조절 가능 |
| 루프 | 지원 (on/off) |
| 자동 재생 | 지원 (on/off) |
| 프레임 점프 | SetFrame(index) API |
| 디버그 UI | OnGUI 오버레이 (프레임, 시간, 속도, 상태) |

### 9.7 디버그 시각화 사양

| 항목 | 값 |
|------|-----|
| Gizmo 형태 | Sphere (반경 0.01) |
| 색상 | visibility 기반 Red(0.0) → Green(1.0) 그라데이션 |
| 연결선 | 17개 본 체인 연결 (얼굴, 상체, 몸통, 하체) |
| 라벨 | 키포인트 이름 + visibility 수치 |

### 9.8 현재 Assets 폴더 구조

```
Assets/
├── Models/
│   └── Y Bot.fbx               # Mixamo Y-Bot (Humanoid)
├── Scripts/
│   ├── Data/
│   │   ├── PoseData.cs          # 데이터 구조체
│   │   └── PoseDataLoader.cs    # JSON 로더
│   ├── Core/
│   │   ├── BoneMapper.cs        # 본 매핑 + 회전 변환
│   │   └── SwingPlayer.cs       # 프레임 재생
│   ├── Filter/                  # (Phase 5 예정)
│   ├── IK/                      # (Phase 4 예정)
│   ├── Resolver/                # (Phase 3 예정)
│   └── Utility/
│       └── PoseDebugVisualizer.cs # Gizmo 디버그
├── Animations/                  # (Phase 6 예정)
├── Prefabs/                     # (빈 폴더)
├── Scenes/
│   └── SampleScene.unity
└── Settings/                    # URP 렌더 파이프라인 설정
```

### 9.9 Phase 2 제한사항 (후속 Phase에서 해결)

| 제한사항 | 영향 | 해결 Phase |
|----------|------|-----------|
| 척추/가슴/목/머리 회전 미적용 | 상체가 뻣뻣하게 보임 | Phase 3 (X-Factor) |
| IK 미적용 | 관절 꺾임이 비정상적일 수 있음 | Phase 4 |
| Visibility 블렌딩 없음 | 저 visibility 구간에서 팔이 튈 수 있음 | Phase 4 |
| 프레임 간 보간 없음 | 29.97fps 그대로 재생 → 미세한 끊김 | Phase 5 (Slerp) |
| 노이즈 필터 없음 | 관절 떨림 가능 | Phase 5 (One Euro) |
| 그립/클럽 없음 | 손이 비어있음 | Phase 6 |

---

## 10. Phase 3 완료 — 누락 부위 복원 (척추·가슴·목·머리)

### 10.1 구현된 스크립트

| 스크립트 | 경로 | 역할 |
|----------|------|------|
| **SpineResolver.cs** | Scripts/Resolver/ | X-Factor 연산 + 몸통 기울기 → Spine 체인 회전 분배 |
| **HeadResolver.cs** | Scripts/Resolver/ | 어깨중점→nose→ear로 Neck/Head 회전 계산 |

### 10.2 SpineResolver 알고리즘

```
[매 프레임]
  1. 몸통 기울기 (Trunk Tilt)
     pelvisCenter = (left_hip + right_hip) / 2
     shoulderCenter = (left_shoulder + right_shoulder) / 2
     trunkDir = normalize(shoulderCenter - pelvisCenter)
     trunkTilt = FromToRotation(Vector3.up, trunkDir)

  2. X-Factor (Y축 회전 차이)
     shoulderVec = normalize(right_shoulder - left_shoulder)
     hipVec = normalize(right_hip - left_hip)
     X-Factor = SignedAngle(hipFlat, shoulderFlat)  // XZ 평면 투영

  3. Spine 체인 분배
     Spine  = trunkTilt × AngleAxis(X-Factor × 0.3) × restRot
     Spine1 = trunkTilt × AngleAxis(X-Factor × 0.6) × restRot
     Spine2 = trunkTilt × AngleAxis(X-Factor × 0.9) × restRot
```

**분배 비율**: Inspector에서 0.0~1.0 범위로 실시간 조정 가능

### 10.3 HeadResolver 알고리즘

```
[Neck 회전]
  shoulderCenter = (left_shoulder + right_shoulder) / 2
  neckDir = normalize(nose - shoulderCenter)
  neckDelta = FromToRotation(neckRestDir, neckDir)
  neck.rotation = neckDelta × neckRestRot

[Head 회전]
  earCenter = (left_ear + right_ear) / 2
  headForward = normalize(nose - earCenter)
  headUp = cross(normalize(right_ear - left_ear), headForward)
  head.rotation = LookRotation(headForward, headUp)
```

### 10.4 BoneMapper 통합

ApplyPose 실행 순서:
1. Hips 위치 (Position)
2. 팔 회전 (UpperArm, LowerArm)
3. **척추 회전 (SpineResolver)** ← Phase 3 추가
4. **목·머리 회전 (HeadResolver)** ← Phase 3 추가
5. 다리 회전 (UpperLeg, LowerLeg)

### 10.5 현재 Assets 폴더 구조

```
Assets/Scripts/
├── Data/
│   ├── PoseData.cs
│   └── PoseDataLoader.cs
├── Core/
│   ├── BoneMapper.cs          # Resolver 통합 완료
│   └── SwingPlayer.cs
├── Resolver/                   # Phase 3 신규
│   ├── SpineResolver.cs       # X-Factor + 몸통 기울기
│   └── HeadResolver.cs        # 목·머리 회전
└── Utility/
    └── PoseDebugVisualizer.cs
```

---

---

## 11. Phase 4 — IK 시스템 및 Visibility 블렌딩

### 11.1 설계 결정: 수동 Two-Bone IK

Animation Rigging 패키지의 `RigBuilder`는 Animator의 Playable Graph에 의존하므로,
`animator.enabled = false` 환경에서는 동작하지 않는다.
따라서 **수동 Two-Bone IK 솔버**를 구현하여 절차적 애니메이션 파이프라인에 직접 통합했다.

| 항목 | Animation Rigging | 수동 솔버 (채택) |
|------|-------------------|-----------------|
| Animator 의존 | Playable Graph 필수 | 불필요 |
| 실행 시점 제어 | 자동 (Animator 평가 시) | 직접 제어 (ApplyPose 후 호출) |
| FK 블렌딩 | 복잡한 Layer 설정 필요 | Slerp로 직접 블렌딩 |
| 커스텀 제약조건 | 제공 컴포넌트 제한적 | 자유롭게 확장 가능 |

### 11.2 Two-Bone IK 알고리즘

```
입력: root(어깨/힙), mid(팔꿈치/무릎), tip(손목/발목), target, hint
  1. 체인 길이 계산
     upperLen = |root → mid|
     lowerLen = |mid → tip|
  2. 도달 거리 클램핑
     targetDist = clamp(|root → target|, |a-b|+ε, a+b-ε)
  3. Law of Cosines — root 각도
     cos(θ) = (a² + c² - b²) / (2ac)
  4. 벤드 평면 결정 (hint 기반)
     hint를 target 축에 직교 투영 → 벤드 방향 추출
  5. root 회전: target 방향 + θ 오프셋 (벤드 방향)
  6. mid 회전: tip → target 방향 추적
```

핵심: hint 벡터가 관절의 벤드 방향을 결정하므로, 팔꿈치/무릎이 자연스러운 방향으로 굽어진다.

### 11.3 Visibility 블렌딩 전략

```
visibility ≥ 0.7  →  IK weight = 0  (FK 100%, 데이터 신뢰)
0.3 < vis < 0.7   →  IK weight = 선형 보간 (FK↔IK Lerp)
visibility ≤ 0.3  →  IK weight = 1  (IK 100%, 데이터 불신뢰)
```

각 사지의 IK weight는 체인 내 **최소 visibility**로 결정한다:
- 왼팔: `min(left_wrist_vis, left_elbow_vis)`
- 오른팔: `min(right_wrist_vis, right_elbow_vis)`
- 왼다리: `min(left_ankle_vis, left_knee_vis)`
- 오른다리: `min(right_ankle_vis, right_knee_vis)`

블렌딩은 Quaternion.Slerp로 수행: `Slerp(FK_rotation, IK_rotation, ikWeight)`

### 11.4 파이프라인 실행 순서

```
BoneMapper.ApplyPose()
  │
  ├─ 1. Hips 위치
  ├─ 2. 팔 FK (FromToRotation)
  ├─ 3. SpineResolver (X-Factor)
  ├─ 4. HeadResolver (Neck/Head delta)
  ├─ 5. 다리 FK (FromToRotation)
  │
  └─ 6. IKController.Apply()           ← NEW (Phase 4)
       ├─ FK 회전 백업
       ├─ TwoBoneIKSolver.Solve()
       └─ Slerp(FK, IK, weight)
```

IK는 FK **이후**에 실행되어 보정하는 구조. FK 결과를 백업 → IK 풀이 → Visibility에 따라 블렌딩.

### 11.5 디버그 오버레이

`IKController.OnGUI()`로 실시간 모니터링:
```
[IK] Left Arm — vis: 0.48, weight: 0.55
[IK] Right Arm — vis: 0.95, weight: 0.00
[IK] Left Leg — vis: 0.92, weight: 0.00
[IK] Right Leg — vis: 0.88, weight: 0.00
```

### 11.6 파일 구조

```
Scripts/IK/
├── TwoBoneIKSolver.cs   — 순수 수학 솔버 (static class, 의존성 없음)
└── IKController.cs      — 4개 사지 IK 관리 + Visibility 블렌딩 + OnGUI 디버그
```

| 파일 | LOC | 역할 |
|------|-----|------|
| `TwoBoneIKSolver.cs` | ~75 | Law of Cosines + hint 기반 Two-Bone IK |
| `IKController.cs` | ~165 | 사지별 IK 적용, Visibility 연산, FK↔IK 블렌딩 |

### 11.7 데이터 기반 근거

포즈 데이터 visibility 분포 (Phase 2 분석 결과):

| 키포인트 | 최소 vis | 최대 vis | IK 개입 빈도 (예상) |
|----------|---------|---------|-------------------|
| left_elbow | 0.15 | 0.95 | 높음 (다운스윙 시 가림) |
| left_wrist | 0.24 | 0.98 | 높음 |
| right_elbow | 0.60 | 0.99 | 중간 |
| right_wrist | 0.55 | 0.99 | 중간 |
| left_knee | 0.45 | 0.98 | 중간 |
| right_knee | 0.70 | 0.99 | 낮음 |

→ **왼팔이 IK 보정의 주요 대상** (face_on 촬영 시 왼팔이 몸에 가려지는 구간 多)

---

## 12. Phase 5 완료 — 보간 및 노이즈 필터링

### 12.1 구현 개요

29.97fps 데이터를 60fps+ 렌더링으로 부드럽게 업스케일링하고, 프레임 간 관절 떨림을 제거하는 시스템 구현.

### 12.2 아키텍처

```
데이터 프레임 (29.97fps)
  Frame A ●──────────────● Frame B
           ↓  Lerp 보간   ↓
렌더 프레임 (60fps+)
  ●──●──●──●──●──●──●──●──●
           ↓
  One Euro Filter (노이즈 제거)
           ↓
  BoneMapper.ApplyPose()
```

### 12.3 새 스크립트

| 파일 | 역할 |
|------|------|
| `Scripts/Filter/OneEuroFilter.cs` | 단일 1D 값에 대한 동적 로우패스 필터. 속도 적응형: 느린 동작→강한 스무딩, 빠른 동작→즉시 반응 |
| `Scripts/Filter/PoseFilter.cs` | 17 keypoints × 3축 = 51개 OneEuroFilter 인스턴스 관리. PoseFrame 입력 → 필터링된 PoseFrame 출력 |
| `Scripts/Filter/FilterTunerUI.cs` | 런타임 GUI 슬라이더 (minCutoff, beta, dCutoff 실시간 조정) |

### 12.4 SwingPlayer 수정사항

| 변경 | 내용 |
|------|------|
| 보간 로직 추가 | `framePos = playbackTime / frameDuration` → Floor/Ceil 프레임 사이 `Lerp(A, B, t)` |
| 필터 통합 | 보간 후 PoseFilter.Apply() 호출 → 필터링된 프레임을 BoneMapper에 전달 |
| GC 최적화 | interpolatedFrame, cachedFrame 재사용 (매 프레임 new 없음) |
| 속성 노출 | EnableInterpolation, EnableFilter, FilterMinCutoff/Beta/DCutoff 프로퍼티 추가 |

### 12.5 One Euro Filter 동작 원리

```
입력 신호 → 미분(속도) 계산 → 속도에 따른 cutoff 조정 → 로우패스 필터 적용
                                    ↓
                    cutoff = minCutoff + beta × |velocity|
                                    ↓
                    빠른 동작: cutoff ↑ → alpha ↑ → 지연 최소화
                    느린 동작: cutoff ↓ → alpha ↓ → 강한 스무딩
```

| 파라미터 | 기본값 | 영향 |
|---------|--------|------|
| `minCutoff` | 1.0 | 정지/저속 시 스무딩 강도. 낮을수록 부드럽지만 지연 증가 |
| `beta` | 0.007 | 속도 반응 계수. 높을수록 빠른 동작에서 필터 약화(지연 감소) |
| `dCutoff` | 1.0 | 미분 신호의 스무딩. 대부분 1.0 유지 |

### 12.6 골프 스윙별 권장 파라미터

| 구간 | 특성 | 권장 설정 |
|------|------|----------|
| Address (0-30f) | 거의 정지 | minCutoff=0.5, beta=0.001 |
| Backswing (30-60f) | 느린 이동 | minCutoff=1.0, beta=0.005 |
| Downswing (60-80f) | **빠른 이동** | minCutoff=1.5, beta=0.01 |
| Follow-through (80-114f) | 감속 | minCutoff=1.0, beta=0.007 |

> 실제 스윙에서는 단일 파라미터 세트로 전 구간 대응 가능. beta=0.007이 범용적.

### 12.7 보간 효과 분석

```
보간 OFF (29.97fps→29.97fps):
  프레임 전환 시 △t = 33.4ms → 관절 '점프' 인지 가능

보간 ON (29.97fps→60fps+):
  프레임 전환 시 △t ≈ 16.7ms → Lerp로 중간 위치 생성
  29.97fps 데이터에서 실질적으로 무한 fps 출력

보간 + 필터 (권장):
  Lerp가 프레임 간 선형 보간 → 여전히 각진 궤적
  One Euro Filter가 곡선형 스무딩 → 자연스러운 궤적
```

### 12.8 처리 흐름 (매 LateUpdate)

```
1. playbackTime += deltaTime × speed
2. framePos = playbackTime / frameDuration (실수)
3. frameA = Floor(framePos), t = frac(framePos)
4. interpolatedFrame = Lerp(frame[A], frame[A+1], t)
5. filteredFrame = OneEuroFilter(interpolatedFrame, playbackTime)
6. BoneMapper.ApplyPose(filteredFrame)
```

---

## 13. BoneMapper 전면 재설계 (Phase 3 리팩토링)

### 13.1 배경

Phase 3~4 구현 과정에서 Delta 방식(첫 프레임 대비 변화량)의 구조적 한계가 발견됨:
- 허리 뒤로 꺾임 (초기 전방 기울기 누락)
- 팔이 몸통 뒤에 위치 (spine backward rotation이 자식 본에 전파)

### 13.2 Absolute Aim+Twist 방식

| 항목 | 기존 Delta | 신규 Absolute |
|------|-----------|---------------|
| 방식 | `delta × tposeRest` | `FromToRotation(restUp, dataDir) × twist` |
| 초기 기울기 | 누락 (delta=0) | 캡처 (restUp→dataDir 직접 매핑) |
| 수학 연산 | Cross product, LookRotation | FromToRotation + AngleAxis만 |
| 외부 의존 | SpineResolver, HeadResolver | **BoneMapper 단독 처리** |

### 13.3 통합 결과

기존 4개 컴포넌트 → BoneMapper 1개 + IKController 1개(선택):
- SpineResolver.cs → BoneMapper에 통합 (Aim+Twist로 spine chain 처리)
- HeadResolver.cs → BoneMapper에 통합 (Aim+Twist로 neck/head 처리)

---

## 14. Phase 6 완료 — 정적 그립 포즈 및 클럽 부착

### 14.1 구현 개요

골프 그립 손가락 포즈를 Finger 본에 적용하고, 프로시저럴 골프 클럽을 Hand 본에 부착하는 시스템 구현.

### 14.2 새 스크립트

| 파일 | 역할 |
|------|------|
| `Scripts/Grip/GripController.cs` | 양손 30개 Finger 본(5손가락 × 3관절 × 2손)에 골프 그립 포즈 적용 |
| `Scripts/Grip/ClubAttachment.cs` | Hand 본에 골프 클럽 부착 (프로시저럴 생성 또는 외부 모델) |

### 14.3 GripController 설계

```
실행 순서: [DefaultExecutionOrder(200)] — BoneMapper(기본) 이후 실행

T-Pose localRotation 캐시
         ↓
LateUpdate:
  bone.localRotation = restLocalRot × spread × AngleAxis(curl × jointWeight, axis)

관절별 가중치:
  Proximal:     70% (손바닥 쪽, 적당히 구부림)
  Intermediate: 90% (가장 많이 구부림)
  Distal:       50% (손끝, 자연스러운 마무리)
```

| 설정 | 좌측 기본값 | 우측 기본값 | 비고 |
|------|-----------|-----------|------|
| Thumb Curl | 25° | 30° | 샤프트 위 가볍게 얹음 |
| Index Curl | 65° | 55° | 트리거 핑거 스타일 |
| Middle Curl | 75° | 70° | 완전 감싸기 |
| Ring Curl | 80° | 75° | 완전 감싸기 |
| Little Curl | 85° | 85° | 인터록/오버랩 |

### 14.4 ClubAttachment 설계

```
실행 순서: [DefaultExecutionOrder(210)] — GripController 이후 실행

Start():
  clubModel 있음? → Instantiate
  없음 + createProcedural? → BuildProceduralClub()
         ↓
  club.parent = Hand 본
  club.localPosition = positionOffset
  club.localRotation = Euler(rotationOffset)
```

프로시저럴 클럽 구조:
```
GolfClub_Procedural
├── Grip  (Cylinder, ∅22mm × 280mm, 검정)
├── Shaft (Cylinder, ∅12mm × 1100mm, 은색)
└── ClubHead (Cube, 90×20×65mm, 진회색, 12° loft)
```

### 14.5 URP 머티리얼 대응

프로시저럴 클럽은 런타임에 `Universal Render Pipeline/Lit` 셰이더로 머티리얼 생성. 해당 셰이더 미발견 시 `Standard` 폴백.

---

## 15. JSON 데이터 구조 재설계 (v2)

### 15.1 변경 배경

기존 JSON은 매 프레임마다 pelvis midpoint를 (0,0)으로 정규화하여 루트 이동 정보가 손실되었다. 새 데이터 구조는 address frame(#27)의 pelvis만 고정 앵커로 사용하여 프레임 간 실제 이동량을 보존한다.

### 15.2 주요 변경 4가지

| 변경 | 기존 (v1) | 신규 (v2) |
|------|----------|----------|
| **좌표 정규화** | 매 프레임 pelvis = (0,0) (동적) | Address frame(#27) pelvis만 고정 (정적) |
| **Visibility 필터링** | 원본 그대로 | threshold 0.5 미만 키포인트 교체/보정 |
| **이벤트 메타데이터** | 없음 | 8개 스윙 페이즈 프레임 마커 |
| **수정 이력** | 없음 | fixes_applied (앵커 정보, 교체 통계) |

### 15.3 제거된 필드

| 필드 | 위치 | 사유 |
|------|------|------|
| `pelvis_missing_frames` | 루트 | 정적 정규화로 불필요 |
| `pelvis_found` | PoseFrame | 정적 정규화로 불필요 |
| `pelvis_midpoint_offset` | PoseFrame | 정적 정규화로 불필요 |
| `ConversionInfo.anchor` | 루트 | fixes_applied로 이동 |
| `ConversionInfo.z_scale_factor` | 루트 | step4 텍스트로 대체 |

### 15.4 추가된 필드

```json
"events": {
  "address": {"frame": 27, "timestamp": 0.9009},
  "toe_up": {"frame": 45, "timestamp": 1.5015},
  "mid_backswing": {"frame": 48, "timestamp": 1.6016},
  "top": {"frame": 59, "timestamp": 1.9686},
  "mid_downswing": {"frame": 64, "timestamp": 2.1355},
  "impact": {"frame": 67, "timestamp": 2.2356},
  "mid_follow_through": {"frame": 69, "timestamp": 2.3023},
  "finish": {"frame": 83, "timestamp": 2.7694}
},
"fixes_applied": {
  "anchor": "address_frame_pelvis_midpoint (fixed)",
  "anchor_frame": 27,
  "anchor_value": {"x": 0.4538, "y": 0.4677},
  "visibility_threshold": 0.5,
  "total_keypoints_replaced": 56
}
```

### 15.5 C# 코드 수정 영향

| 파일 | 변경 내용 |
|------|----------|
| **PoseData.cs** | SwingEvents, SwingEvent, FixesApplied, AnchorValue 클래스 추가. PelvisMidpointOffset 제거. PoseFrame에서 pelvis_found 제거. ConversionInfo에서 anchor/z_scale_factor 제거, step4 추가 |
| **PoseDataLoader.cs** | AddressFrameIndex 프로퍼티, GetAddressFrame(), GetCurrentSwingPhase() 메서드 추가. events/fixes_applied 파싱 및 Debug.Log 출력 |
| **BoneMapper.cs** | addressPelvisOffset 캐싱. ApplyPose()에서 `pelvis - addressPelvisOffset`으로 delta 계산 → 정적 정규화 기반 루트 이동 |
| **SwingPlayer.cs** | referenceFrame을 address frame으로 변경. currentPhase 트래킹. OnGUI에 Phase 표시. pelvis_found 참조 제거 |
| **PoseFilter.cs** | pelvis_found 참조 제거 |

### 15.6 Root Motion 로직 변경

```
[기존 — 동적 정규화]
  매 프레임 pelvis = (0,0) → hips.position = hipsRest + pelvis * scale
  → pelvis가 항상 원점이므로 루트 이동 없음 (= 제자리 스윙)

[신규 — 정적 정규화]
  Address frame pelvis = 앵커 → addressPelvisOffset 캐싱
  매 프레임: pelvisDelta = currentPelvis - addressPelvisOffset
  → hips.position = hipsRest + pelvisDelta * scale
  → 프레임 간 실제 체중 이동, 무릎 구부림 등 반영
```

### 15.7 스윙 페이즈별 프레임 분포

```
Setup (0-26) → Address (27) → Toe Up (45) → Mid Backswing (48) → Top (59) →
Mid Downswing (64) → Impact (67) → Mid Follow Through (69) → Finish (83) → End (113)
```

| 구간 | 프레임 | 시간(s) | 특성 |
|------|--------|---------|------|
| Setup → Address | 0-27 | 0-0.90 | 준비 동작 |
| Address → Top | 27-59 | 0.90-1.97 | 백스윙 (32프레임, 1.07s) |
| Top → Impact | 59-67 | 1.97-2.24 | 다운스윙 (8프레임, 0.27s) ← 가장 빠름 |
| Impact → Finish | 67-83 | 2.24-2.77 | 팔로스루 (16프레임, 0.53s) |
| Finish → End | 83-113 | 2.77-3.77 | 마무리 정지 (30프레임, 1.0s) |

---

## 16. 3대 시각적 결함 수정 — BoneMapper 5단계 파이프라인

### 16.1 문제 요약

| Issue | 증상 | 근본 원인 |
|-------|------|----------|
| 1. 지터 | 관절이 프레임 간 순간이동 | 위치 레벨 필터만으로는 회전 레벨 노이즈 미억제 |
| 2. 팔 분리 | 양손이 독립 운동 | MediaPipe 독립 추정 + 깊이 부정확 |
| 3. 피니시 붕괴 | 임팩트 후 팔 좌표 무너짐 | 자기 폐색 → visibility 0.15까지 하락 |

### 16.2 해결 아키텍처

```
ApplyPose(frame, loader, phase)
  │
  1. ApplyFKInternal()       ← 전체 Aim+Twist FK
  2. ApplyGripCoupling()     ← 오른팔→왼손 커플링 (TwoBoneIK)
  3. IKController.Apply()    ← 다리 IK (팔은 Grip 시 스킵)
  4. HandleFinishPhase()     ← Impact 포즈 캡처 → Finish에서 블렌딩
  5. ApplySmoothing()        ← Phase별 시간적 Slerp 스무딩
     └─ CacheCurrentPose()
```

### 16.3 핵심 기법

| 기법 | 공식/원리 | 적용 대상 |
|------|----------|----------|
| Phase-aware Smoothing | `smoothLerp = 1 - Pow(1-resp, dt×60)` | 전체 본 회전 (Issue 1) |
| Grip Coupling | `target = leftHand.TransformPoint(offsetLocal)` → TwoBoneIK | 오른팔 (Issue 2) |
| Dynamic Pose Capture | Impact에서 캡처 → `InverseLerp(0.5, 0.05, minArmVis)` | Finish 구간 (Issue 3) |
| Phase Parameter Table | 8개 Phase별 responsiveness (0.3~0.9) + gripWeight (0~1) | 전체 흐름 |

### 16.4 기각된 대안

| 사용자 제안 | 기각 사유 |
|------------|----------|
| Animation Rigging IK | `animator.enabled = false`에서 Playable Graph 미동작 |
| State Machine + 사전 애니메이션 | 과도한 엔지니어링, 다양한 스윙 비대응, 별도 에셋 필요 |

---

## 17. 결론 및 권장사항

1. **Phase 6 완료** — 골프 그립 + 프로시저럴 클럽 부착 → 스윙 동작과 연동
2. **JSON v2 적용 완료** — 정적 정규화, events, fixes_applied, visibility 필터링
3. **3대 시각적 결함 수정 완료** — 지터(Smoothing), 팔 분리(Grip Coupling), 피니시 붕괴(Dynamic Pose Capture)
4. **총 12개 스크립트** — Data(2), Core(2), IK(2), Filter(3), Grip(2), ~~Resolver(2, 미사용)~~, Utility(1)
5. **BoneMapper 5단계 파이프라인** — FK → GripCoupling → IK → FinishBlend → Smoothing
6. **다음 단계**: Phase 7 (최적화 및 모바일 빌드)
7. **그립 튜닝**: GripController Inspector에서 Curl 각도 + Curl Axis 조정
8. **클럽 위치 튜닝**: ClubAttachment Inspector에서 positionOffset/rotationOffset 조정
9. **클럽 모델 교체**: Inspector의 Club Model 필드에 외부 FBX 드래그 → 프로시저럴 자동 비활성화

---

## 섹션 15: PoseCorrector — 시스템적 데이터 방어 레이어

### 15.1 문제 배경

`GolfSwingData/` 디렉토리에 존재하는 face_on, dtl, other 세 개 폴더의 JSON 파일들은 모두 단안(monocular) 2D→3D 포즈 추정 모델로 추출되었기 때문에 구조적 이상값을 다수 포함한다.

#### 데이터 수치 요약

| 이상값 종류 | 실측 규모 | 예시 파일 |
|---|---|---|
| 팔 Z 깊이 실패 (몸통 관통) | face_on 40~62% 프레임 | 1011 (62.5%) |
| 3D 손목 분리 (그립 붕괴) | 최대 30.16 units | 1008 (30.16), 1001 (6.23) |
| 프레임 간 좌표 도약 | 파일당 0~50회 | 1001 (50회/92프레임) |

### 15.2 좌표계 상세 (보정 로직 이해를 위해)

```
JSON 원시 데이터 (preprocessing 완료 후)
  x: 수평 (양수 = 카메라 기준 오른쪽)
  y: 수직 (flipped, 양수 = 위)  
  z: 깊이 (양수 = 카메라에서 멀어짐, * 0.3 스케일)

DataToAvatarSpace 변환 후
  avatar_x = -data_x (좌우 반전)
  avatar_y = data_y (동일)
  avatar_z = -data_z (깊이 반전: 양수 = 카메라 방향 = 몸통 앞)

face_on 클리핑 조건:
  data.arm_z > data.chest_z → 팔이 흉부보다 카메라에서 멀다 → avatar 공간에서 팔이 몸통 뒤에 있음
  수정: arm_z ≤ chest_z - minOffset (팔을 강제로 앞으로)
```

### 15.3 PoseCorrector 아키텍처

```
PreprocessSequence(PoseSequence, viewType)
  │
  ├── for each frame (순차):
  │     ├── Pass 1: ApplyJumpRejection
  │     │     ├── 하드 클램프: |x|,|y|,|z| > 1.5 → 이전 프레임 값 사용
  │     │     └── 속도 게이트: Δ > 0.18 → 외삽 + 15% 블렌드
  │     ├── Pass 2: ApplyDepthClamping (face_on only)
  │     │     └── arm_z ≤ (lShoulder_z + rShoulder_z)/2 - 0.03
  │     ├── Pass 3: ApplyGripConstraint
  │     │     ├── |lWrist - rWrist| > 0.20 → rWrist = lWrist + dir * 0.20
  │     │     └── rElbow 35% 추종 (shoulder→newWrist 방향)
  │     └── UpdateVelocityState (이전 위치/속도 캐시 갱신)
  │
  └── Debug 통계 출력
```

**오프라인 배치 처리 선택 이유**:
- 런타임 부담 없음 (로드 시 1회)
- 프레임 간 상태(velocity)를 시간 순서대로 올바르게 유지
- InterpolateFrames/OneEuroFilter가 이미 보정된 값 사용
- BoneMapper.Initialize(addressFrame)도 보정된 기준 프레임 사용

### 15.4 통합 방법

`SwingPlayer.Start()`에서 `BoneMapper.Initialize()` 이전에 호출:

```
[PoseDataLoader.Awake] → 원시 JSON 로드
[SwingPlayer.Start]
  ├── PoseCorrector.PreprocessSequence(Sequence) ← 인플레이스 수정
  ├── BoneMapper.Initialize(correctedAddressFrame)
  └── 재생 시작
```

### 15.5 파라미터 튜닝 가이드

| 파라미터 | 범위 | 기본값 | 언제 조정 |
|---|---|---|---|
| `minArmDepthOffset` | 0.01~0.15 | 0.03 | 팔이 여전히 관통 → 증가 / 팔 동작 과도하게 제한 → 감소 |
| `maxWristSeparation` | 0.05~0.50 | 0.20 | 그립이 분리된 채 재생 → 감소 |
| `elbowFollowWeight` | 0~1 | 0.35 | 팔꿈치가 부자연스럽게 꺾임 → 감소 |
| `maxJumpPerFrame` | 0.05~0.60 | 0.18 | 점프 미탐지 → 감소 / 정상 동작 과도 억제 → 증가 |
| `hardClampThreshold` | 0.5~10 | 1.5 | 파일 1008 같은 극단적 이상값 → 1.5 유지 |
| `extrapolationBlend` | 0~0.5 | 0.15 | 점프 후 복귀가 너무 느림 → 증가 |

### 15.6 뷰 타입별 차이

| 뷰 타입 | 깊이 클램핑 | 그립 제약 | 점프 제거 |
|---|---|---|---|
| face_on | ✅ Z축 (팔이 흉부 앞) | ✅ 3D | ✅ |
| dtl | ❌ (DTL에서 팔 Z 방향 다름) | ✅ 3D | ✅ |
| other | ❌ | ✅ 3D | ✅ |

DTL 깊이 클램핑은 면밀한 좌표계 분석 후 별도 구현 필요.

