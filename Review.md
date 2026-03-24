# 버그 분석 리뷰

---

## Review #1: T-Pose 유지 — 아바타가 동작을 수행하지 않음

**보고 시점**: Phase 2 완료 후
**증상**: Play 실행 시 Y-Bot이 T-Pose를 유지한 채 움직이지 않음

---

### 근본 원인 분석

#### 버그 1 (주요 원인): Animator가 매 프레임 T-Pose로 리셋

| 항목 | 내용 |
|------|------|
| **파일** | `BoneMapper.cs` → `Initialize()` |
| **원인** | Unity의 Humanoid Animator는 AnimatorController가 없더라도 매 프레임 Update에서 모든 본을 T-Pose(기본 근육 상태)로 초기화한다. `LateUpdate`에서 회전을 적용해도 Animator의 내부 Humanoid 평가가 본을 리셋하기 때문에 절차적 애니메이션이 덮어쓰여진다. |
| **수정** | T-Pose 데이터 캐싱 완료 후 `animator.enabled = false`로 Animator를 비활성화하여 본 리셋을 차단 |

```csharp
// 수정 전
isInitialized = true;

// 수정 후
animator.enabled = false;  // Humanoid 본 리셋 차단
Debug.Log("[BoneMapper] Animator 비활성화 — 절차적 애니메이션 모드 전환");
isInitialized = true;
```

#### 버그 2: normalized 후 sqrMagnitude 체크 논리 오류

| 항목 | 내용 |
|------|------|
| **파일** | `BoneMapper.cs` → `ApplyBoneRotation()` |
| **원인** | `Vector3.normalized`는 항상 단위 벡터(sqrMagnitude=1.0)를 반환하므로, 정규화 후 `sqrMagnitude < 0.001f` 체크는 의미 없음. 정규화 전에 원본 벡터 길이를 체크해야 함. |
| **영향** | 이 버그 자체로는 T-Pose 유지의 직접 원인이 아님 (데이터 차이가 0인 경우에만 해당). 그러나 논리적 오류. |

```csharp
// 수정 전
Vector3 currentDir = (childKeypoint - parentKeypoint).normalized;
if (currentDir.sqrMagnitude < 0.001f) return;

// 수정 후
Vector3 rawDir = childKeypoint - parentKeypoint;
if (rawDir.sqrMagnitude < 0.0001f) return;  // 정규화 전 체크
Vector3 currentDir = rawDir.normalized;
```

#### 버그 3: 디버그 로그 부족

| 항목 | 내용 |
|------|------|
| **파일** | `BoneMapper.cs` 전역 |
| **원인** | 본 캐싱 성공/실패 여부, 프레임 적용 여부를 콘솔에서 확인할 수 없어 문제 추적 불가 |
| **수정** | 본 null 체크 개별 에러 로그, 캐시 카운트 표시, 첫 프레임 적용 로그 추가 |

---

### 추가된 Debug.Log 목록

| 로그 메시지 | 타입 | 조건 |
|------------|------|------|
| `[BoneMapper] Animator 비활성화 — 절차적 애니메이션 모드 전환` | Log | Animator 비활성화 시 |
| `[BoneMapper] 본 참조 캐시 완료 — N/9 본 발견` | Log | 초기화 시 |
| `[BoneMapper] Hips 본을 찾을 수 없습니다` | Error | Hips null 시 |
| `[BoneMapper] LeftUpperArm 본을 찾을 수 없습니다` | Error | 각 본 null 시 |
| `[BoneMapper] 첫 프레임 적용 — frame: N, landmarks: N` | Log | 첫 ApplyPose 호출 시 |
| `[BoneMapper] ApplyPose 호출됨 — 초기화되지 않은 상태` | Error | 미초기화 상태에서 호출 시 |
| `[BoneMapper] 키포인트 간 거리 0 — boneName 스킵` | Warning | 키포인트 위치 동일 시 |

---

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `Scripts/Core/BoneMapper.cs` | Animator 비활성화, sqrMagnitude 체크 수정, Debug.Log 추가 |

---

### 예상 동작

수정 후 Play 실행 시 콘솔에 다음 순서로 로그가 출력되어야 함:

```
[PoseDataLoader] 로드 완료 — 114프레임, 29.97fps, 키포인트 17개
[BoneMapper] 본 참조 캐시 완료 — 9/9 본 발견
[BoneMapper] T-Pose 기준 데이터 캐시 완료
[BoneMapper] 스케일 계산 — 아바타 다리: X.XXX, 소스 다리: X.XXX, 비율: X.XXX
[BoneMapper] Animator 비활성화 — 절차적 애니메이션 모드 전환
[BoneMapper] 초기화 완료 — scaleFactor: X.XXX
[SwingPlayer] 초기화 완료 — 114프레임, 29.97fps
[SwingPlayer] 재생 시작
[BoneMapper] 첫 프레임 적용 — frame: 0, landmarks: 17
```

만약 `9/9 본 발견`이 아닌 경우 → **Y-Bot Humanoid 리그 설정 미완료** (Project 창 → FBX → Rig → Humanoid → Apply 필요)

---

## Review #2: 팔·다리 비정상 동작 — 좌표계 불일치

**보고 시점**: Review #1 수정 후 (Animator 비활성화 적용 후)
**증상**: 디버그 스켈레톤(Gizmo)은 정상 동작하나, 아바타의 팔이 뒤로 꺾이고 다리가 꼬임

---

### 근본 원인 분석

| 항목 | 내용 |
|------|------|
| **파일** | `BoneMapper.cs` → `ApplyPose()`, `ApplyHipsPosition()`, `ComputeScaleFactor()` |
| **원인** | 데이터 좌표계와 아바타 좌표계의 **Z축 방향이 반대** |

#### 좌표계 비교

```
포즈 데이터 (face_on 촬영):         Y-Bot (Rotation 0,0,0):
  nose z = -0.205 (앞 = -Z)          정면 = +Z
  ankle z = +0.032 (뒤 = +Z)         후면 = -Z
  → 사람이 -Z 방향을 바라봄           → 아바타가 +Z 방향을 바라봄
```

**결과**: `FromToRotation`에 전달되는 데이터 방향 벡터의 Z성분이 아바타 기준으로 반전되어 있어, 팔이 앞이 아닌 뒤로 향하고 다리도 꼬임.

#### 왜 디버그 스켈레톤은 정상인가?

`PoseDebugVisualizer`는 데이터 좌표를 그대로 Gizmo로 그리므로, 데이터 자체의 좌표계에서 정상 표시됨. 아바타의 본 회전에만 좌표계 변환이 필요.

### 수정 내용

`BoneMapper`에 `DataToAvatarSpace()` 좌표 변환 메서드 추가:

```csharp
private Vector3 DataToAvatarSpace(Vector3 dataPos)
{
    return new Vector3(dataPos.x, dataPos.y, -dataPos.z);  // Z축 반전
}
```

모든 데이터 좌표 접근점에 적용:
- `ApplyPose()` — 팔·다리 회전 계산 시 모든 키포인트 좌표
- `ApplyHipsPosition()` — 골반 위치 계산
- `ComputeScaleFactor()` — 스케일 비율 계산

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `Scripts/Core/BoneMapper.cs` | `DataToAvatarSpace()` 추가, 모든 `GetLandmarkPosition` 호출에 적용 |

### 핵심 교훈

디버그 시각화가 정상이더라도, **좌표를 소비하는 시스템(본 매핑)**과 **좌표를 표시하는 시스템(Gizmo)**은 서로 다른 좌표계를 사용할 수 있다. 데이터 좌표계와 타겟 좌표계의 축 방향 일치 여부를 반드시 확인해야 한다.

---

## Review #2-1: 좌표계 반전 불완전 — X축 미반전

**보고 시점**: Review #2 수정 후 (Z축만 반전)
**증상**: 팔이 여전히 뒤로 꺾이고 다리가 꼬임 (Z반전만으로 부족)

---

### 근본 원인

face_on = 사람과 카메라가 **정면 마주보기**. 마주보는 두 사람의 좌우가 반대인 것과 같은 원리로, **X축도 반전**이 필요했음.

```
사람 (face_on, -Z를 바라봄):         Y-Bot (Rotation 0,0,0, +Z를 바라봄):
  왼쪽 팔 = +X 방향                    왼쪽 팔 = -X 방향
  앞(가슴) = -Z 방향                   앞(가슴) = +Z 방향
```

| 축 | 데이터 | 아바타 | 변환 |
|----|--------|--------|------|
| X | 사람 좌측 = +X | 아바타 좌측 = -X | **반전 필요** |
| Y | 위 = +Y | 위 = +Y | 유지 |
| Z | 사람 앞 = -Z | 아바타 앞 = +Z | **반전 필요** |

### 수정

```csharp
// 수정 전 (Z만 반전)
return new Vector3(dataPos.x, dataPos.y, -dataPos.z);

// 수정 후 (X, Z 모두 반전 = Y축 180° 회전)
return new Vector3(-dataPos.x, dataPos.y, -dataPos.z);
```

---

## Review #3: HeadResolver — 과도한 고개 숙임 + 머리 180° 반전

**보고 시점**: Phase 3 완료 후 (SpineResolver + HeadResolver 추가 후)
**증상**: 아바타가 과도하게 고개를 숙이고, 머리가 180° 뒤집어짐 (턱이 하늘, 정수리가 바닥)

---

### 근본 원인 분석

#### 버그 1 (Neck): shoulderCenter→nose를 목 방향으로 사용 — 과도한 전방 편향

| 항목 | 내용 |
|------|------|
| **파일** | `HeadResolver.cs` → `Resolve()` |
| **원인** | nose는 **얼굴 앞쪽**에 위치하므로, `shoulderCenter→nose` 벡터는 "목이 가리키는 방향"이 아니라 "코를 조준하는 방향"이 됨. T-Pose neckRestDir(수직 위)과 비교 시 약 67° 전방 회전 발생 |

```
Frame 0 실측 (DataToAvatarSpace 변환 후):
  shoulderCenter ≈ (0.003, 0.119, 0.107)
  nose'          ≈ (0.005, 0.161, 0.205)
  neckDir = nose' - shoulderCenter ≈ (0.002, 0.043, 0.099)
  → normalized ≈ (0.02, 0.39, 0.91)  ← Z(전방) 91%, Y(상방) 39%
  → FromToRotation(Vector3.up, 이 벡터) = 약 67° 전방 회전
```

**추가 문제**: 절대 방향을 T-Pose 기준과 직접 비교하므로, 첫 프레임에서부터 과도한 회전이 발생. 데이터의 자연스러운 오프셋(머리가 항상 어깨보다 앞에 위치)이 그대로 회전에 반영됨.

#### 버그 2 (Head): Cross product 순서 오류 — headUp이 아래를 가리킴

| 항목 | 내용 |
|------|------|
| **파일** | `HeadResolver.cs` → `Resolve()` |
| **원인** | `Cross(rightEar - leftEar, headForward)` 계산 시 결과 벡터가 -Y(하향)를 가리킴 |

```
DataToAvatarSpace 변환 후:
  rightEar' - leftEar' ≈ (+X, 0, 0)
  headForward ≈ (0, 0, +Z)

  Cross((+X, 0, 0), (0, 0, +Z)) = (0*Z - 0*0, 0*0 - X*Z, X*0 - 0*0) = (0, -XZ, 0)
  → Y 성분이 음수 = 아래를 가리킴!
  → LookRotation에 하향 up 벡터 전달 → 머리 180° 뒤집힘
```

---

### 수정 내용

#### 수정 1: Neck — earCenter 사용 + delta 회전 방식

```csharp
// 수정 전: nose를 조준 → 과도한 전방 편향
Vector3 neckDir = (nose - shoulderCenter).normalized;
Quaternion neckDelta = Quaternion.FromToRotation(neckRestDir, neckDir);
neck.rotation = neckDelta * neckRestRot;

// 수정 후: earCenter 사용 + 첫 프레임 기준 delta만 적용
Vector3 neckDir = (earCenter - shoulderCenter).normalized;
// 첫 프레임에서 dataRestNeckDir 캐시
Quaternion neckDelta = Quaternion.FromToRotation(dataRestNeckDir, neckDir);
neck.rotation = neckDelta * neckRestRot;
```

- **earCenter**: 두개골 중심에 가깝고 nose보다 전방 편향이 적음
- **Delta 방식**: 첫 프레임 기준으로 "변화량"만 적용하므로, 데이터의 자연 오프셋(머리→어깨 전방 차이)이 제거됨

#### 수정 2: Head — Cross product 순서 반전

```csharp
// 수정 전: 하향 벡터 생성
Vector3 headUp = Vector3.Cross(rightEar - leftEar, headForward).normalized;

// 수정 후: 상향 벡터 생성
Vector3 headUp = Vector3.Cross(headForward, earVector).normalized;
```

#### 수정 3: Head — LookRotation도 delta 방식으로 변경

```csharp
// 수정 전: 절대 LookRotation → T-Pose와 무관한 절대 회전 적용
head.rotation = Quaternion.LookRotation(headForward, headUp);

// 수정 후: 첫 프레임 기준 delta 적용
Quaternion currentHeadRot = Quaternion.LookRotation(headForward, headUp);
Quaternion restHeadDataRot = Quaternion.LookRotation(dataRestHeadFwd, dataRestHeadUp);
Quaternion headDelta = currentHeadRot * Quaternion.Inverse(restHeadDataRot);
head.rotation = headDelta * headRestRot;
```

---

### 추가된 Debug.Log 목록

| 로그 메시지 | 타입 | 조건 |
|------------|------|------|
| `[HeadResolver] 첫 프레임 기준 캐시 — neckDir: (...), headFwd: (...)` | Log | 첫 Resolve 호출 시 |

---

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `Scripts/Resolver/HeadResolver.cs` | Neck: earCenter + delta, Head: Cross 순서 수정 + delta |

---

### 핵심 교훈

1. **Keypoint 위치 ≠ 본 위치**: nose는 얼굴 앞쪽이지 두개골 중심이 아님. 본 방향 계산 시 해부학적 위치를 고려해야 함.
2. **Cross product 순서**: `Cross(A, B)` = `-Cross(B, A)`. 좌표계 변환 후 결과 방향을 반드시 검증해야 함.
3. **Delta 회전 패턴**: 절대 방향 비교 대신, "기준 프레임 대비 변화량"을 적용하면 데이터의 자연 오프셋이 자동 제거됨.

---

## Review #4: Hips 회전 미적용 + Spine 회전 부족

**보고 시점**: Phase 4 완료 후
**증상**: 힙 좌표값이 고정되어 움직임 없음, 상체도 스윙에 따른 회전을 수행하지 않음. 디버그 스켈레톤은 정상 회전.

---

### 근본 원인 분석

#### 버그 1: Hips 회전이 전혀 적용되지 않음

| 항목 | 내용 |
|------|------|
| **파일** | `BoneMapper.cs` → `ApplyPose()` |
| **원인** | `ApplyHipsPosition()`만 호출하고 `hips.rotation`은 설정하지 않음. 데이터에 ~83° 힙 회전 신호가 있지만 사용되지 않음. |

```
데이터 실측 (hipDir = rightHip - leftHip):
  Frame 0  (어드레스): hipYaw = +174° → 거의 -X 방향
  Frame 60 (톱):       hipYaw = +150° → 24° 회전
  Frame 90 (임팩트):   hipYaw = -98°  → 83° 대회전!
  → 회전 신호가 존재하지만 BoneMapper가 미사용
```

#### 버그 2: Hips 위치도 사실상 고정

| 항목 | 내용 |
|------|------|
| **파일** | `BoneMapper.cs` → `ApplyHipsPosition()` |
| **원인** | 데이터가 pelvis-centered (pelvis midpoint = origin). `(leftHip + rightHip) / 2 ≈ (0, 0, 0)` 매 프레임 → `hips.position ≈ hipsRestPosition + 0` |

#### 버그 3: SpineResolver의 trunkTilt가 사실상 상수

| 항목 | 내용 |
|------|------|
| **파일** | `SpineResolver.cs` → `Resolve()` |
| **원인** | `trunkTilt = FromToRotation(Vector3.up, trunkDir)`. pelvis-centered 데이터에서 trunkDir(pelvis→shoulder)은 매 프레임 비슷한 값. 절대값으로 설정하므로 **변화량이 아닌 고정된 기울기**만 적용됨. 전체 body yaw(회전)는 포착하지 않음. |
| **추가 원인** | `bone.rotation`을 world-space 절대값으로 설정 → hips가 회전해도 spine이 독립적으로 덮어씀 |

---

### 수정 내용

#### 수정 1: BoneMapper — ApplyHipsRotation() 추가

두 벡터(힙 측면 벡터 + 몸통 상향 벡터)에서 3축 좌표계를 구성하고, 첫 프레임 기준 delta를 적용:

```csharp
Vector3 hipRight = (rightHip - leftHip).normalized;
Vector3 trunkUp = (shoulderCenter - pelvisCenter).normalized;
Vector3 hipForward = Vector3.Cross(hipRight, trunkUp).normalized;
Vector3 hipUp = Vector3.Cross(hipForward, hipRight).normalized;

Quaternion dataOrientation = Quaternion.LookRotation(hipForward, hipUp);
// delta from first frame
Quaternion hipDelta = dataOrientation * Quaternion.Inverse(hipsDataRestOrientation);
hips.rotation = hipDelta * hipsRestRotation;
```

#### 수정 2: SpineResolver — 벡터 블렌딩 방식으로 전면 리팩토링

기존 `trunkTilt * yaw * restRot` 방식을 폐기하고, 각 스파인 본의 right 방향을 hip↔shoulder 사이에서 weight로 보간:

```csharp
// weight: 0=힙 추종, 1=어깨 추종
Vector3 boneRight = Vector3.Slerp(hipRight, shoulderRight, weight);
Vector3 boneForward = Vector3.Cross(boneRight, trunkUp).normalized;
Vector3 boneUp = Vector3.Cross(boneForward, boneRight).normalized;

Quaternion dataOrientation = Quaternion.LookRotation(boneForward, boneUp);
Quaternion delta = dataOrientation * Quaternion.Inverse(dataRestOrientations[i]);
bone.rotation = delta * boneRestWorldRots[i];
```

- **Spine (0.3)**: 70% 힙 추종 → 하부 척추는 힙과 함께 회전
- **Chest (0.6)**: 반반 → 중간 전이
- **UpperChest (0.9)**: 90% 어깨 추종 → 상부 척추는 어깨와 함께 회전
- X-Factor가 자연스럽게 분배됨 (별도 yaw 계산 불필요)

---

### 추가된 Debug.Log 목록

| 로그 메시지 | 타입 | 조건 |
|------------|------|------|
| `[BoneMapper] Hips 첫 프레임 기준 캐시 — hipRight: ..., forward: ...` | Log | 첫 회전 적용 시 |
| `[SpineResolver] 첫 프레임 기준 캐시 — hipYaw: ...°, X-Factor: ...°` | Log | 첫 Resolve 시 |

---

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `Scripts/Core/BoneMapper.cs` | `ApplyHipsRotation()` 추가, ApplyPose에 호출 삽입 |
| `Scripts/Resolver/SpineResolver.cs` | 벡터 블렌딩 + delta 방식 전면 리팩토링 |

---

### 핵심 교훈

1. **Pelvis-centered 데이터의 함정**: pelvis midpoint가 원점이므로 hips position은 항상 ~0. 회전 신호는 개별 키포인트 위치 변화에 숨어 있다.
2. **World rotation 독립 설정의 부작용**: `bone.rotation`을 world-space로 직접 설정하면, 부모(hips)의 회전이 자식(spine)에 전파되지 않음. 각 본이 자체 데이터에서 회전을 독립 계산해야 한다.
3. **벡터 블렌딩 패턴**: hip→shoulder 벡터 사이를 Slerp로 보간하면, X-Factor 분배와 body rotation을 하나의 통합 계산으로 처리할 수 있다.

---

## Review #5: 팔 몸통 통과 + 허리 뒤로 꺾임 (재발)

**보고 시점**: Review #4 수정 후
**증상**:
1. 팔이 몸통과 동일 선상에서 움직여 몸통을 관통
2. 허리가 뒤로 꺾임 (팔·다리와 반대 방향으로 움직임)

---

### 근본 원인 분석

#### 버그 1: ApplyPose 실행 순서 — 팔 FK가 SpineResolver보다 먼저 적용

| 항목 | 내용 |
|------|------|
| **파일** | `BoneMapper.cs` → `ApplyPose()` |
| **원인** | 기존 순서: Hips → **Arms FK (2)** → **SpineResolver (3)** → Legs. 팔 본(LeftUpperArm 등)은 Spine/Chest/UpperChest의 **자식 노드**. Unity는 `bone.rotation` 설정 시 내부적으로 `localRotation = parent.rotation.inverse * worldRotation`으로 저장. 이후 SpineResolver가 부모(Spine)의 rotation을 변경하면, 팔의 world rotation = `새 parent.rotation × 저장된 localRotation` ≠ 원래 의도한 값. 결과: 팔이 부모 회전을 이중으로 받아 몸통 안쪽으로 말려들어감 |

```
실행 순서에 따른 팔 world rotation 추적:
  Step 2 (Arms FK): leftUpperArm.rotation = intended_world_rot
    → Unity 내부: localRot = oldSpine.rot⁻¹ × intended_world_rot
  Step 3 (SpineResolver): spine.rotation = newSpine.rot
    → 팔 world rotation = newSpine.rot × (oldSpine.rot⁻¹ × intended_world_rot)
    → = newSpine.rot × oldSpine.rot⁻¹ × intended_world_rot
    → ≠ intended_world_rot  (spine delta가 이중 적용됨!)
```

#### 버그 2: ApplyHipsRotation에 trunkUp 재사용 — 허리 뒤로 꺾임 재발

| 항목 | 내용 |
|------|------|
| **파일** | `BoneMapper.cs` → `ApplyHipsRotation()` |
| **원인** | Review #4-1에서 trunkUp 제거 후 순수 `FromToRotation` 방식으로 수정했으나, 현재 코드에 trunkUp이 다시 포함됨. `trunkUp = (shoulderCenter - pelvisCenter).normalized`는 pelvis-centered 데이터에서 `shoulderCenter ≈ (0, 0.94, 0.34)`를 반환. Cross(hipRight, trunkUp)의 결과 hipForward에 하향 Y 성분 발생 → 스윙 동안 몸통 각도 변화가 hips에 "뒤로 꺾이는" 회전으로 전환됨 |

```
trunkUp 사용 시 문제 수치:
  trunkUp ≈ (0, 0.94, 0.34)  ← Z 성분 = 34% 전방 편향
  hipRight ≈ (1, 0, 0)
  hipForward = Cross(hipRight, trunkUp) = (0, -0.34, 0.94) ← Y = -0.34 (하향!)

  스윙 시 trunk 각도가 42°→35° 변화 → hipForward의 Y가 -0.34→-0.28 변화
  → delta에 상향 회전 포함 → 허리가 뒤로 젖혀짐
```

---

### 수정 내용

#### 수정 1: ApplyPose 실행 순서 변경

```
수정 전: Hips위치 → Hips회전 → Arms FK → SpineResolver → HeadResolver → Legs FK → IK
수정 후: Hips위치 → Hips회전 → SpineResolver → HeadResolver → Arms FK → Legs FK → IK
                                ↑ 부모 회전 먼저 확정    ↑ 자식 회전 나중에 적용
```

부모 본(Spine/Chest/UpperChest)의 world rotation이 확정된 후에 자식 본(UpperArm 등)의 FK를 적용하므로, `bone.rotation = X` 설정 시 부모가 이미 최종 상태 → localRotation 저장값이 올바르게 유지됨.

#### 수정 2: ApplyHipsRotation — trunkUp 제거, 순수 FromToRotation

```csharp
// 수정 전: 3축 좌표계 (hipRight + trunkUp → Cross → forward → LookRotation)
Vector3 trunkUp = (shoulderCenter - pelvisCenter).normalized;
Vector3 hipForward = Vector3.Cross(hipRight, trunkUp).normalized;
Quaternion dataOrientation = Quaternion.LookRotation(hipForward, hipUp);
Quaternion hipDelta = dataOrientation * Quaternion.Inverse(hipsDataRestOrientation);

// 수정 후: 순수 방향 변화만 (yaw + lateral tilt)
Vector3 hipDir = (rightHip - leftHip).normalized;
Quaternion hipDelta = Quaternion.FromToRotation(hipsDataRestDir, hipDir);
hips.rotation = hipDelta * hipsRestRotation;
```

- **trunkUp 제거**: 전방 기울기 성분이 Hips에 전파되지 않음
- **forward lean은 SpineResolver가 담당**: SpineResolver의 trunkUp에서 전방 기울기를 처리
- **역할 분리**: Hips = yaw(좌우 회전), SpineResolver = forward lean + X-Factor 분배

---

### 추가된 Debug.Log 목록

| 로그 메시지 | 타입 | 조건 |
|------------|------|------|
| `[BoneMapper] Hips 첫 프레임 기준 캐시 — hipDir: (...)` | Log | 첫 회전 적용 시 |

---

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `Scripts/Core/BoneMapper.cs` | ApplyPose 순서 변경 (Spine→Head→Arms→Legs), ApplyHipsRotation trunkUp 제거 |

---

### 핵심 교훈

1. **본 계층 구조와 실행 순서**: Unity에서 `bone.rotation`(world)을 설정하면 내부 localRotation이 부모 기준으로 계산됨. 부모가 나중에 변경되면 자식의 world rotation이 의도치 않게 바뀜. **반드시 부모→자식 순으로 설정해야 함.**
2. **trunkUp과 Cross product 오염**: pelvis-centered 데이터에서 trunkUp에 전방 편향이 존재. 이를 Cross 연산에 넣으면 hipForward에 하향 성분이 생겨, 프레임 간 trunk 각도 변화가 "허리 뒤로 꺾임"으로 변환됨. Hips에는 순수 yaw(FromToRotation)만 적용하고, 전방 기울기는 SpineResolver에 위임해야 함.

---

## Review #5-1: SpineResolver trunkUp 오염 — 허리 뒤로 꺾임 + 팔 뒤로 이동 (재발)

**보고 시점**: Review #5 수정 적용 후 Unity 테스트
**증상**:
1. 허리가 **더** 뒤로 꺾임 (Review #5 이전보다 악화)
2. 팔이 **더** 뒤로 이동 — 모든 동작에서 몸통보다 팔이 뒤에 위치

---

### 근본 원인 분석

Review #5에서 ApplyPose 순서를 Spine→Arms로 변경한 것 자체는 정확한 수정이었으나, **SpineResolver 자체의 backward rotation**이 원인이었음.

#### SpineResolver의 trunkUp 오염이 BoneMapper보다 심각

| 항목 | 내용 |
|------|------|
| **파일** | `SpineResolver.cs` → `Resolve()` |
| **원인** | `trunkUp = (shoulderCenter - pelvisCenter).normalized ≈ (0, 0.94, 0.34)`. Z 성분 34%가 Cross(boneRight, trunkUp) 결과에 **-Y(하향) 성분**을 생성. Delta 방식에서 trunk 각도가 변하면 (address 20° → follow-through 15°) = -5° delta → T-Pose(0°)에 적용 시 **-5° backward lean** |

```
SpineResolver 문제 메커니즘:
  trunkUp ≈ (0, 0.94, 0.34)    ← Z=0.34 (전방 편향)
  boneRight ≈ (1, 0, 0)
  boneForward = Cross(boneRight, trunkUp) = (0, -0.34, 0.94) ← Y=-0.34 (하향!)

  Frame 0 (address): boneForward.Y = -0.34 → dataRestOrientation 캐시
  Frame 80 (impact): trunk 각도 변화 → boneForward.Y = -0.28
  Delta = 상향 회전 +6° ← T-Pose(수직)에 적용 → 6° 뒤로 꺾임
```

#### 왜 Review #5 이후 더 악화되었는가

```
수정 전 (Arms → Spine 순서):
  1. Arms FK: 정확한 world rotation 설정
  2. SpineResolver: spine 회전 변경 → 팔에 spine delta 이중 적용
  → 팔은 "앞으로 두 번 밀림" → 결과적으로 몸통 선상에 위치 (우연히 덜 나빠 보임)

수정 후 (Spine → Arms 순서):
  1. SpineResolver: spine이 뒤로 꺾임 (backward lean)
  2. Arms FK: 정확한 world rotation 설정... 하지만 부모(spine)가 뒤로 꺾여 있으므로
     localRotation = backward_spine.inverse × intended_world → 결과적으로 팔도 뒤로 이동
  → 팔이 뒤로 꺾인 spine을 따라감
```

### 수정 내용

#### SpineResolver — trunkUp을 Vector3.up으로 교체

```csharp
// 수정 전: 데이터 기반 trunkUp (Z 성분 오염)
Vector3 trunkUp = (shoulderCenter - pelvisCenter).normalized;

// 수정 후: 고정 상향 벡터 (pitch 오염 제거)
Vector3 trunkUp = Vector3.up;
```

- **효과**: `Cross(boneRight, Vector3.up)` = 순수 XZ 평면 forward → Y 성분 없음 → pitch delta 제거
- **Yaw(좌우 회전)**: boneRight의 XZ 변화가 그대로 캡처됨 (정상)
- **Lateral tilt(측면 기울기)**: boneRight의 Y 성분이 있으면 일부 캡처됨 (정상)
- **Forward lean(전방 기울기)**: T-Pose 상태 유지 (골프 스윙에서 spine angle은 거의 일정하므로 시각적으로 적절)

---

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `Scripts/Resolver/SpineResolver.cs` | `trunkUp = Vector3.up` 으로 변경 |

---

### 핵심 교훈

1. **데이터 기반 trunkUp의 한계**: pelvis-centered + z_scale=0.3 데이터에서 trunkUp의 Z 성분은 깊이 추정 오차에 크게 영향받음. 이를 Cross product에 사용하면 피할 수 없는 pitch 오염 발생.
2. **Delta 방식의 기준점 불일치**: 데이터의 address 자세(전방 기울기 20°)와 T-Pose(수직)의 기준이 다르므로, 데이터에서 "기울기 감소"가 T-Pose 기준으로 "뒤로 꺾임"으로 변환됨.
3. **연쇄 효과**: 부모 본(spine)의 잘못된 회전은 올바른 순서(부모→자식)로 실행될수록 자식(팔)에 더 정확히 전파됨. 실행 순서 수정 전에는 이중 적용 버그가 spine의 오류를 우연히 상쇄했음.

---

## Review #6: JSON 포즈 데이터 이상값 분석

**분석 대상**: `data/pose/golf_swing_pose.json`
**데이터 사양**: 17 keypoints, 114 frames, 29.97fps, 160x160, pelvis-centered, z_scale=0.3

---

### 이상값 1 (CRITICAL): 좌우 발목·무릎 좌표 swap — 프레임 73, 85, 93, 98-99

MediaPipe가 1~2프레임 동안 좌/우 발목·무릎 ID를 혼동. 좌표값 자체는 유효하나 좌우가 뒤바뀐 상태.

| 프레임 | landmark | 이전 프레임 값 | 해당 프레임 값 | 비고 |
|--------|----------|---------------|---------------|------|
| **73** | left_ankle.x | +0.0505 | **-0.1112** | swap (right 값) |
| **73** | right_ankle.x | -0.1162 | **+0.0428** | swap (left 값) |
| **73** | left_knee.x | +0.0287 | **-0.0943** | 동시 swap |
| **73** | right_knee.x | -0.0876 | **+0.0321** | 동시 swap |
| **85** | left_ankle.x | +0.0419 | **-0.1116** | 1프레임 swap |
| **85** | right_ankle.x | -0.1189 | **+0.0381** | 1프레임 swap |
| **93** | left_ankle.x | +0.0406 | **-0.0981** | 1프레임 swap |
| **93** | right_ankle.x | -0.1199 | **+0.0341** | 1프레임 swap |
| **98** | left_ankle.x | +0.0380 | **-0.1045** | 2프레임 연속 swap |
| **99** | left_ankle.x | -0.1045 | **-0.0998** | 연속 |

**추정 원인**: Monocular L/R identity flip — 단안 포즈 추정에서 하반신 좌우 식별 실패. 전후 프레임은 정상이므로 단발성 오탐.

---

### 이상값 2 (SEVERE): 오른 손목 y/z 좌표 진동 — 프레임 71~80

다운스윙~임팩트 구간에서 right_wrist가 두 tracking 가설 사이를 진동.

| 프레임 | right_wrist.y | delta_y | right_wrist.z | delta_z |
|--------|-------------|---------|--------------|---------|
| 71 | +0.049 | — | -0.028 | — |
| 72 | +0.186 | **+0.138** | -0.095 | -0.067 |
| 75 | +0.265 | — | -0.132 | — |
| 76 | +0.075 | **-0.191** | +0.034 | **+0.166** |
| 77 | +0.168 | **+0.093** | -0.087 | -0.121 |
| 78 | +0.231 | +0.063 | -0.118 | -0.031 |
| 79 | +0.071 | **-0.159** | +0.021 | **+0.139** |

**추정 원인**: 160x160 해상도에서 클럽 + 빠른 손목 이동에 의한 모션 블러. MediaPipe가 두 개의 포즈 가설(손목 높음/낮음) 사이를 프레임마다 전환.

---

### 이상값 3 (SEVERE): 왼팔 y좌표 점프 — 프레임 55-56, 78-79, 88-90, 93-94

| 프레임 전이 | landmark | 이전 값 | 해당 값 | delta | median 대비 |
|------------|----------|---------|---------|-------|------------|
| 55→56 | left_elbow.y | +0.143 | +0.223 | **+0.080** | 26x |
| 55→56 | left_wrist.y | +0.098 | +0.248 | **+0.150** | 22x |
| 78→79 | left_elbow.y | +0.195 | +0.125 | **-0.070** | 23x |
| 88→89 | left_elbow.y | +0.112 | +0.180 | **+0.068** | 22x |
| 88→89 | left_wrist.y | +0.045 | +0.176 | **+0.131** | 19x |
| 93→94 | left_wrist.y | +0.161 | +0.038 | **-0.123** | 18x |

**추정 원인**: 프레임 82 이후 left_elbow visibility < 0.50, 프레임 104에서 0.15까지 하락. 저신뢰 구간에서 좌표 추정이 불안정.

---

### 이상값 4 (MODERATE): 전체 Z축 드리프트

| landmark | 초반 10프레임 평균 z | 후반 10프레임 평균 z | 총 변화 |
|----------|-------------------|-------------------|--------|
| nose | -0.188 | -0.013 | **+0.175** |
| left_shoulder | -0.095 | +0.054 | **+0.149** |
| right_shoulder | -0.105 | -0.071 | +0.034 |
| left_ear | -0.172 | -0.028 | **+0.144** |

**추정 원인**: 골퍼 몸통 회전(address→follow-through)에 의한 실제 z 변화 + z_scale=0.3에서의 깊이 추정 누적 오차.

---

### 이상값 5 (MODERATE): 힙/어깨 x부호 역전 — 프레임 73~

정상 상태: left_hip.x > 0, right_hip.x < 0 (face_on).
프레임 73 이후 좌우 역전 발생 프레임:

| landmark | 역전 프레임 목록 |
|----------|----------------|
| hip x | 73, 74, 75, 94, 95, 97, 98, 105, 106, 107, 108, 109 |
| shoulder x | 74, 75, 89, 91-99, 108, 109, 110, 113 |

**추정 원인**: 임팩트 이후 몸통 회전(카메라 반대쪽으로 돌아감)에 의한 실제 좌우 역전 + MediaPipe L/R 혼동 복합.

---

### 이상값 6 (MINOR): Z축 스파이크 — 프레임 43-44, 64-65

| 프레임 전이 | landmark | delta_z | median 대비 |
|------------|----------|---------|------------|
| 43→44 | left_shoulder.z | +0.033 | 8.5x |
| 43→44 | left_ear.z | +0.033 | 6.5x |
| 64→65 | left_shoulder.z | +0.037 | 9.4x |
| 64→65 | nose.z | +0.040 | ~7x |

**추정 원인**: 머리/어깨 영역에서의 갑작스러운 깊이 추정 변화.

---

### 이상값 7 (MINOR): 초기 프레임 안정화 — 프레임 1-3

| 프레임 전이 | landmark | delta | median 대비 |
|------------|----------|-------|------------|
| 1→2 | left_ankle.y | +0.016 | 12x |
| 1→2 | left_knee.y | +0.012 | 12x |

**추정 원인**: 포즈 추정 초기 프레임 안정화 지터.

---

### 이상 프레임 요약 (위험도 순)

| 위험도 | 프레임 범위 | 주요 이상 |
|--------|-----------|----------|
| **CRITICAL** | 73, 85, 93, 98-99 | 발목/무릎 L/R swap |
| **SEVERE** | 71-80 | 오른 손목 y/z 진동 |
| **SEVERE** | 55-56, 78-79, 88-90, 93-94 | 왼팔 y 점프 |
| MODERATE | 전체 (누적) | Z축 드리프트 (~0.175) |
| MODERATE | 73~ (간헐) | 힙/어깨 x부호 역전 |
| MINOR | 43-44, 64-65 | Z축 스파이크 |
| MINOR | 1-3 | 초기 안정화 지터 |

---

## Review #7: BoneMapper 전면 재설계 — Delta 방식 폐기, Absolute Aim+Twist 도입

**보고 시점**: Review #5-1 수정 후에도 허리 뒤로 꺾임 + 팔 뒤로 이동 지속
**증상**:
1. 허리가 여전히 뒤로 꺾임 (SpineResolver의 trunkUp=Vector3.up으로도 해결 불가)
2. 팔이 모든 프레임에서 몸통보다 뒤에 위치
3. 가이드 스켈레톤은 자연스러운 허리 굽힘을 보여주지만 아바타는 수직 유지

---

### 근본 원인: Delta 방식의 구조적 한계

| 문제 | Delta 방식 | Absolute 방식 |
|------|-----------|--------------|
| 초기 전방 기울기 | **누락** — data frame 0과 T-Pose의 기준점이 다름 | **캡처** — T-Pose(수직) → data 방향으로 직접 매핑 |
| 스윙 중 기울기 변화 | 줄어들면 → T-Pose 기준 **뒤로 꺾임** | 줄어들면 → 덜 숙여짐 (자연스러움) |
| Cross product 오염 | trunkUp의 Z 성분이 boneForward에 -Y 생성 | Cross product 불사용 — FromToRotation만 |

```
Delta 방식의 실패 메커니즘:
  Address 자세: 전방 기울기 20° (data rest)
  T-Pose:      전방 기울기 0°  (avatar rest)

  Frame 0:  delta = 20° - 20° = 0° → T-Pose + 0° = 수직 (기울기 누락!)
  Frame 80: delta = 15° - 20° = -5° → T-Pose + (-5°) = 뒤로 꺾임!

Absolute Aim+Twist 방식:
  Frame 0:  FromToRotation(Vector3.up, trunkDir_20°) = 20° 전방 기울기 ✓
  Frame 80: FromToRotation(Vector3.up, trunkDir_15°) = 15° 전방 기울기 ✓
```

---

### 새로운 아키텍처: Aim + Twist 분해

**Aim**: `FromToRotation(restUp, aimTarget)` — bone의 T-Pose 상향축을 데이터 방향으로 회전
**Twist**: `AngleAxis(angle, aimTarget)` — aim 후 남은 axial roll을 rightTarget에 맞춤

```
ApplyAimTwist(bone, aimTarget, rightTarget):
  1. aim = FromToRotation(bone.restUp, aimTarget)
  2. afterAim = aim × bone.restRotation
  3. aimedRight = afterAim × Vector3.right (aim 후 right 방향)
  4. projAimed = ProjectOnPlane(aimedRight, aimTarget)  // aim축에 수직
  5. projTarget = ProjectOnPlane(rightTarget, aimTarget) // 목표 right
  6. twistAngle = SignedAngle(projAimed, projTarget, aimTarget)
  7. twist = AngleAxis(twistAngle, aimTarget)
  8. bone.rotation = twist × afterAim
```

**장점**: Cross product 없음, LookRotation 없음, 순수 FromToRotation + AngleAxis만 사용

---

### Bone별 매핑

| Bone | aimTarget | rightTarget |
|------|-----------|-------------|
| Hips | trunkDir (pelvis→shoulder) | hipRight (L→R hip) |
| Spine | trunkDir | Slerp(hipRight, shoulderRight, 0.25) |
| Chest | trunkDir | Slerp(hipRight, shoulderRight, 0.55) |
| UpperChest | trunkDir | Slerp(hipRight, shoulderRight, 0.85) |
| Neck | neckDir (shoulder→ear) | shoulderRight |
| Head | headUp (Cross(fwd,earR)) | earRight |
| 팔/다리 | (parent→child).normalized | N/A (FromToRotation only) |

---

### 통합된 단일 파이프라인

기존: BoneMapper → SpineResolver → HeadResolver → IKController (4개 컴포넌트)
신규: **BoneMapper 하나로 통합** (SpineResolver/HeadResolver 기능 내장) + IKController (선택)

실행 순서: Hips → Spine chain → Neck → Head → Arms → Legs → IK

---

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `Scripts/Core/BoneMapper.cs` | **전면 재작성** — Delta 방식 제거, Aim+Twist 방식 도입, SpineResolver/HeadResolver 통합 |

---

### Unity Editor 설정 변경 사항

1. **SpineResolver 컴포넌트 제거** — BoneMapper에 통합됨 (Inspector에서 Remove Component)
2. **HeadResolver 컴포넌트 제거** — BoneMapper에 통합됨
3. BoneMapper Inspector에서 기존 Resolvers 필드가 사라지고 **Spine Weights** 슬라이더가 새로 생김
4. IKController는 그대로 유지 (BoneMapper가 자동 탐색)

---

## Phase 5 구현 완료: 보간 및 노이즈 필터링

### 생성 파일

| 파일 | 역할 |
|------|------|
| `Scripts/Filter/OneEuroFilter.cs` | 단일 1D 값 동적 로우패스 필터 (속도 적응형) |
| `Scripts/Filter/PoseFilter.cs` | 17 keypoints × 3축 = 51개 필터 래퍼, GC-free PoseFrame 출력 |
| `Scripts/Filter/FilterTunerUI.cs` | 런타임 GUI 슬라이더 (minCutoff/beta/dCutoff 실시간 조정) |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `Scripts/Core/SwingPlayer.cs` | Lerp 보간 + PoseFilter 통합, EnableInterpolation/EnableFilter 프로퍼티 추가 |

### Unity Editor 설정 체크리스트

- [ ] SwingPlayer Inspector에서 새 필드 확인:
  - **Enable Interpolation**: ✅ 체크 (29.97fps → 60fps+ 보간)
  - **Enable Filter**: ✅ 체크 (One Euro Filter 활성화)
  - **Filter Min Cutoff**: 1.0 (기본값)
  - **Filter Beta**: 0.007 (기본값)
  - **Filter D Cutoff**: 1.0 (기본값)
- [ ] 빈 GameObject 생성 → "FilterTuner" 이름 지정
- [ ] FilterTunerUI 컴포넌트 추가
- [ ] SwingPlayer 필드에 씬의 SwingPlayer 드래그 연결 (미연결 시 자동 탐색)
- [ ] Play Mode에서 우하단 "Show Filter UI" 버튼 → 슬라이더 패널 동작 확인

### 필터 파라미터 가이드

| 파라미터 | 범위 | 효과 |
|---------|------|------|
| Min Cutoff ↓ | 0.01~10 | 정지 시 스무딩 강화 (부드럽지만 지연) |
| Min Cutoff ↑ | | 정지 시 스무딩 약화 (반응 빠르지만 떨림) |
| Beta ↓ | 0~1 | 빠른 동작도 강하게 스무딩 (지연 가능) |
| Beta ↑ | | 빠른 동작에서 필터 해제 (다운스윙 추종↑) |

> **권장**: 먼저 기본값(1.0/0.007/1.0)으로 재생 → beta를 0.01~0.02로 올려보며 다운스윙 추종 확인 → minCutoff를 0.5로 내려보며 address 떨림 확인

---

## Review #7: 새 데이터 적용 시 동일 동작 재생 — 파일 경로 오류

**증상**: golf_swing_pose.json을 교체했음에도 아바타가 항상 동일한 스윙을 수행. 여러 다른 영상 데이터를 적용해도 완전히 같은 동작.

### 근본 원인

JSON 파일이 **2개의 서로 다른 경로**에 존재:

```
GolfSimulation/
├── GolfSimulation/                      ← Unity 프로젝트 루트
│   ├── Assets/
│   │   └── StreamingAssets/
│   │       └── golf_swing_pose.json     ← Unity가 읽는 파일 (video "8", 114 frames)
│   └── StreamingAssets/
│       └── golf_swing_pose.json         ← 새 데이터 (video "9", 278 frames) — 무시됨
```

`Application.streamingAssetsPath` = `{프로젝트루트}/Assets/StreamingAssets/`
→ 프로젝트 루트의 `StreamingAssets/`에 파일을 교체하면 Unity는 절대 읽지 않음.

### 수정 내용

1. **파일 교체 위치**: 반드시 `Assets/StreamingAssets/golf_swing_pose.json`에 복사
2. **PoseDataLoader 진단 로그 강화**: 로드 시 파일 경로, 영상명, 프레임 수, Frame0 좌표값 출력 → 콘솔에서 어떤 데이터가 로드되었는지 즉시 확인 가능

### 교훈

Unity 프로젝트에서 `StreamingAssets`는 반드시 `Assets/` 하위에 위치해야 함. 프로젝트 루트에 동일 이름 폴더가 있으면 혼동 발생.

---

## Phase 6 구현 완료: 정적 그립 포즈 및 클럽 부착

### 생성 파일

| 파일 | 역할 |
|------|------|
| `Scripts/Grip/GripController.cs` | 양손 30개 Finger 본에 골프 그립 포즈 적용 (`[DefaultExecutionOrder(200)]`) |
| `Scripts/Grip/ClubAttachment.cs` | Hand 본에 프로시저럴/외부 골프 클럽 부착 (`[DefaultExecutionOrder(210)]`) |

### Unity Editor 설정 체크리스트

- [ ] Y-Bot GameObject 선택 → **Add Component** → `GripController` 추가
  - Animator: Y-Bot의 Animator 드래그 (미연결 시 자동 탐색)
  - Enable Grip: ✅
  - Finger Curl Axis: `(0, 0, -1)` 기본 — 손가락이 안 구부러지면 `(1, 0, 0)` 또는 `(0, 0, 1)` 시도
  - Thumb Curl Axis: Finger Curl Axis와 동일하게 시작, 필요 시 독립 조정
  - 좌우 손 Curl 기본값은 자동 설정됨
- [ ] Y-Bot GameObject 선택 → **Add Component** → `ClubAttachment` 추가
  - Animator: Y-Bot의 Animator 드래그
  - Club Model: 비워두면 프로시저럴 클럽 자동 생성
  - Attach Bone: `LeftHand` (리드 핸드 기준, 기본값)
  - Create Procedural: ✅
  - Position Offset / Rotation Offset: Play Mode에서 실시간 조정
- [ ] Play Mode에서 확인:
  - 양손 손가락이 그립 자세로 구부러짐
  - 클럽이 왼손에 부착되어 스윙 동작을 따라감
  - **손가락 방향이 반대인 경우**: Finger Curl Axis 값 변경
  - **클럽 위치가 어긋난 경우**: Position/Rotation Offset 조정

### 클럽 위치 오프셋 가이드

| 축 | 의미 | 조정 방향 |
|----|------|----------|
| Position X | 손바닥 좌우 | + = 엄지 쪽, - = 새끼 쪽 |
| Position Y | 손목 상하 | + = 손등 쪽, - = 손바닥 쪽 |
| Position Z | 손가락 방향 | + = 손끝 쪽, - = 손목 쪽 |
| Rotation X/Y/Z | 클럽 기울기 | 기본 (0, 0, 90) — 실시간 조정 필요 |

> **팁**: Play Mode에서 Inspector의 offset 값을 드래그하며 실시간 확인. 적절한 값을 찾으면 메모 후 Edit Mode에서 재입력.

---

## Review #8: 3대 시각적 결함 통합 수정 — 지터, 팔 분리, 피니시 붕괴

**보고 시점**: Phase 6 완료 후 (JSON v2 마이그레이션 적용 상태)
**증상**:
1. **프레임 간 텔레포팅/지터** — 아바타 관절이 프레임 사이에서 순간이동하듯 떨림
2. **스윙 중 양팔 분리** — 양손이 그립을 잡고 있어야 하는데 좌우 팔이 독립적으로 움직임
3. **피니시 포즈 좌표 붕괴** — 임팩트 이후 팔이 아래로 떨어지거나 비정상적 자세

---

### Issue 1: 프레임 간 텔레포팅/지터

#### 원인 분석

| 항목 | 내용 |
|------|------|
| **근본 원인** | 기존 One Euro Filter + Lerp 보간은 **위치(position) 레벨**에서만 스무딩. 위치가 미세하게 달라도 `FromToRotation`에 의해 회전으로 변환되면 **각도 차이가 증폭**됨 |
| **추가 원인** | 29.97fps → 60fps+ 보간으로 중간 위치를 생성해도, AI 추정 노이즈는 보간 키프레임 자체에 존재하므로 보간된 회전도 노이즈를 포함 |
| **데이터 근거** | Review #6 이상값 2 (right_wrist y/z 진동, 프레임 71~80), 이상값 3 (left_elbow/wrist y 점프, 프레임 55-56/78-79/88-90) |

#### 사용자 가설 평가

> 사용자: "FPS 불일치 + AI estimation noise"

정확한 진단이나, 해결책으로 제시된 "Slerp + One Euro"는 이미 Phase 5에서 구현된 상태. 위치 레벨 필터링만으로는 회전 레벨 노이즈를 충분히 억제할 수 없음이 핵심 미해결 문제.

#### 수정: Phase-aware Rotation Smoothing

```
smoothLerp = 1 - Pow(1 - responsiveness, deltaTime × 60)
bone.rotation = Slerp(prevRotation, currentRotation, smoothLerp)
hips.position = Lerp(prevPosition, currentPosition, smoothLerp)
```

**프레임 레이트 독립성**: `Pow(base, dt*60)` 공식은 60fps 기준 `base`를 dt에 비례하여 스케일링. 30fps에서는 `Pow(base, 0.5*60)=Pow(base,2)` → 2프레임분 한번에 적용 → fps가 달라도 동일한 시각적 결과.

**Phase별 responsiveness 값**:

| Phase | responsiveness | 효과 |
|-------|---------------|------|
| setup | 0.35 | 강한 스무딩 (거의 정지 상태) |
| address | 0.35 | 강한 스무딩 |
| toe_up / mid_backswing | 0.55 | 중간 스무딩 |
| top | 0.50 | 중간 스무딩 |
| mid_downswing | 0.85 | 약한 스무딩 (빠른 동작 추종) |
| impact | 0.90 | 최소 스무딩 (최대 반응) |
| mid_follow_through | 0.55 | 중간 스무딩 |
| finish | 0.30 | 강한 스무딩 (안정적 정지) |

---

### Issue 2: 스윙 중 양팔 분리

#### 원인 분석

| 항목 | 내용 |
|------|------|
| **근본 원인** | MediaPipe는 각 팔을 독립적으로 추정. 특히 face_on 촬영에서 깊이(Z축) 추정이 부정확하여 양손 사이 거리가 프레임마다 변동 |
| **데이터 근거** | z_scale=0.3으로 깊이 축소, 160×160 저해상도, 자기 폐색(self-occlusion)에 의한 왼팔 visibility 저하 |

#### 사용자 가설 평가

> 사용자: "Animation Rigging의 Two Bone IK + Multi-Aim Constraint"

**기각 사유**: Animation Rigging 패키지는 Animator의 Playable Graph에 의존하므로, `animator.enabled = false` 환경에서 작동 불가. 이미 Phase 4에서 수동 TwoBoneIKSolver를 구현한 배경과 동일.

#### 수정: Grip Coupling Constraint

**원리**: Address frame에서 왼손 local space 기준 오른손 상대 위치를 캐시 → 매 프레임 왼손이 움직이면 오른손 목표 위치를 `leftHand.TransformPoint(offsetLocal)`로 산출 → 기존 TwoBoneIKSolver로 오른팔을 목표에 맞춤.

```
[초기화 — CaptureGripOffset]
  1. T-Pose 본 회전을 전부 저장
  2. Address frame에 FK 임시 적용
  3. gripOffsetLocal = leftHand.InverseTransformPoint(rightHand.position)
  4. 저장한 T-Pose 회전 복원 (GripController rest rotation 보존)

[매 프레임 — ApplyGripCoupling]
  1. coupledTarget = leftHand.TransformPoint(gripOffsetLocal)
  2. TwoBoneIKSolver.Solve(rightUpperArm, rightLowerArm, rightHand, coupledTarget, hint)
  3. 현재 gripWeight < 1이면 FK↔IK 사이 Slerp 블렌딩
```

**T-Pose 오염 방지**: CaptureGripOffset에서 FK를 임시 적용하면 본이 address 포즈로 변경됨. 이 상태에서 GripController가 캐시한 rest rotation이 오염될 수 있으므로, **FK 적용 전 모든 본 회전을 백업 → 캡처 후 즉시 복원**.

**Phase별 gripWeight**:

| Phase | gripWeight | 사유 |
|-------|-----------|------|
| setup | 0 | 준비 동작, 그립 미형성 |
| address | 0.9 | 그립 형성 (약간 여유) |
| toe_up ~ impact | 1.0 | 완전 커플링 |
| mid_follow_through | 0.7 | 릴리스 시작 |
| finish | 0.3 | 그립 해제 중 |

**IKController 연동**: Grip Coupling 활성 시 `ikController.SkipArms = true` → 팔 IK 중복 적용 방지. 다리 IK는 항상 실행.

---

### Issue 3: 피니시 포즈 좌표 붕괴

#### 원인 분석

| 항목 | 내용 |
|------|------|
| **근본 원인** | 피니시 구간에서 심한 자기 폐색(self-occlusion) → 왼팔 visibility 0.15~0.24까지 하락 → FK 방향 벡터 신뢰도 극저 → IK 힌트도 부정확 → 양쪽 모두 나쁜 결과 |
| **데이터 근거** | left_elbow min vis=0.149, left_wrist min vis=0.244. 프레임 82 이후 지속적 하락 |

#### 사용자 가설 평가

> 사용자: "State Machine + 미리 만든 임팩트~피니시 애니메이션 블렌딩"

**기각 사유**: 과도한 엔지니어링. 별도 AnimationClip 제작과 State Machine 관리가 필요하며, 데이터 기반 시스템의 장점(다양한 스윙 대응)을 잃음. 가벼운 대안이 존재.

#### 수정: Dynamic Pose Capture + Visibility-Driven Blend

**원리**: Impact/Mid Follow Through 시점의 본 상태를 동적으로 캡처 → Finish 구간에서 팔 visibility가 임계값 이하로 떨어지면 캡처된 포즈로 블렌딩.

```
[캡처 — HandleFinishPhase]
  Phase == "impact" 또는 "mid_follow_through" && !finishPoseCaptured:
    → 전체 trackedBones의 rotation + hips.position 저장

[블렌딩 — ComputeFinishBlendWeight]
  minArmVis = Min(4개 팔 관절 visibility)
  blendWeight = InverseLerp(finishVisThreshold, 0.05, minArmVis)
    → vis ≥ 0.5: weight = 0 (데이터 신뢰)
    → vis = 0.05: weight = 1 (캡처 포즈 100%)
    → 사이: 선형 보간

[적용 — ApplyFinishBlend]
  bone.rotation = Slerp(currentFK, capturedRotation, blendWeight)
  hips.position = Lerp(currentPos, capturedPos, blendWeight * 0.5)
```

**미리 만든 애니메이션 대비 장점**:
- 원본 스윙의 실제 임팩트 포즈를 사용 → 다양한 스윙 데이터에 자동 적응
- 별도 에셋 불필요
- 데이터 신뢰도(visibility)에 비례한 점진적 블렌딩 → 갑작스러운 전환 없음

---

### 통합 파이프라인 — 5단계 ApplyPose

```
BoneMapper.ApplyPose(frame, loader, phase)
  │
  ├─ 1. ApplyFKInternal()     ← Aim+Twist 전체 FK (Hips, Spine, Neck, Head, Arms, Legs)
  │
  ├─ 2. ApplyGripCoupling()   ← 오른팔을 왼손 기준 커플링 (Issue 2)
  │
  ├─ 3. IKController.Apply()  ← 다리 IK (팔은 Grip 시 스킵)
  │
  ├─ 4. HandleFinishPhase()   ← 캡처 포즈 블렌딩 (Issue 3)
  │
  └─ 5. ApplySmoothing()      ← 회전 레벨 시간적 스무딩 (Issue 1)
      │
      └─ CacheCurrentPose()   ← 다음 프레임 비교용 저장
```

실행 순서 근거:
- FK → Grip → IK 순서: FK 결과물 위에 Grip이 오른팔 보정, IK가 다리 보정
- Finish Blend → Smoothing 순서: 나쁜 데이터를 캡처 포즈로 교체한 후 시간적 스무딩 적용
- Smoothing이 마지막: 모든 보정이 완료된 최종 결과를 이전 프레임과 블렌딩

---

### 추가된 Debug.Log 목록

| 로그 메시지 | 타입 | 조건 |
|------------|------|------|
| `[BoneMapper] Initialized — scale: X.XXX, spine: N, grip: True/False, addressOffset: (...)` | Log | Initialize 완료 시 |
| `[BoneMapper] Grip offset captured: (...)` | Log | CaptureGripOffset 성공 시 |
| `[BoneMapper] Address frame이 없어 pelvis offset을 (0,0,0)으로 설정` | Warning | Address frame 미발견 시 |
| `[BoneMapper] Address pelvis offset: (...)` | Log | CacheAddressPelvisOffset 완료 시 |
| `[BoneMapper] Finish reference pose captured` | Log | Impact/MidFollowThrough에서 캡처 시 |
| `[BoneMapper] Post-process state reset` | Log | 루프 재시작/Stop 시 |

---

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `Scripts/Core/BoneMapper.cs` | **전면 재작성** — 5단계 파이프라인 (FK + GripCoupling + IK + FinishBlend + Smoothing), Phase별 파라미터 |
| `Scripts/IK/IKController.cs` | `SkipArms` 프로퍼티 추가, 팔 IK 스킵 로직, OnGUI Grip 상태 표시 |
| `Scripts/Core/SwingPlayer.cs` | `ApplyPose(frame, loader, currentPhase)` 3인자 호출, `ResetPostProcessState()` 추가 |

---

### Unity Editor 설정 체크리스트

- [ ] BoneMapper Inspector 새 필드 확인:
  - **Enable Grip Coupling**: ✅ 체크 (양팔 커플링 활성화)
  - **Enable Smoothing**: ✅ 체크 (회전 스무딩 활성화)
  - **Enable Finish Blend**: ✅ 체크 (피니시 포즈 블렌딩 활성화)
  - **Finish Vis Threshold**: 0.5 (기본값) — 이 값 이하에서 블렌딩 시작
- [ ] IKController Inspector 확인 — 기존 설정 유지 (SkipArms는 런타임 자동 제어)
- [ ] Play Mode에서 OnGUI 디버그 오버레이 확인:
  - `[BoneMapper] Phase: xxx | Spine: 3`
  - `Grip: ON (0.90)` 또는 `OFF`
  - `Smoothing: ON (resp: 0.55)` 또는 `OFF`
  - `Finish Blend: 0.XX | Captured: True/False`

---

### 핵심 교훈

1. **위치 필터 ≠ 회전 필터**: Position 레벨 One Euro Filter는 회전 변환 후 증폭되는 각도 노이즈를 억제할 수 없다. 회전 레벨 시간적 스무딩(Slerp between frames)이 필수.
2. **Animation Rigging의 한계**: `animator.enabled = false` 절차적 애니메이션에서는 Playable Graph 의존 패키지 사용 불가. 동일 기능을 순수 코드로 구현해야 한다.
3. **동적 캡처 vs 사전 제작**: 미리 만든 애니메이션 대신 런타임 캡처 포즈를 사용하면, 다양한 입력 데이터에 자동 적응하면서도 구현 복잡도가 낮다.
4. **T-Pose 오염 주의**: 초기화 시 FK를 임시 적용하면 다른 컴포넌트의 rest state 캐시가 오염될 수 있다. 반드시 백업→적용→복원 패턴 사용.

---

## Review #8: 포즈 데이터 이상값 — 시스템적 방어 아키텍처 설계 및 구현

**보고 시점**: Phase 6 완료 후 / GolfSwingData 전체 데이터셋 분석
**증상**:
- 파일 9: 팔이 몸통을 관통하고 스윙 중간에 심한 좌표 팝핑 발생
- 파일 8: 피니시 페이즈에서 오른손이 왼손에서 완전히 분리됨
- 전체 데이터셋에 유사한 물리적 불가능 현상 및 추적 손실 산재

---

### 근본 원인 분석

#### 분석 대상

| 경로 | 내용 |
|---|---|
| `GolfSwingData/face_on/` | Face-on 뷰 JSON 파일 다수 |
| `GolfSwingData/dtl/` | DTL(Down-The-Line) 뷰 JSON 파일 다수 |
| `GolfSwingData/other/` | 기타 뷰 JSON 파일 |

#### 데이터 수치 분석 결과

| 파일 | 뷰 | 클리핑 비율 | 최대 손목 분리 | 점프 횟수 |
|---|---|---|---|---|
| 1003 | face_on | **50.5%** | 0.194 | 1 |
| 1005 | face_on | **55.8%** | 0.308 | 5 |
| 1008 | face_on | 41.8% | **30.16** ← 추적 완전 붕괴 | 43 |
| 1011 | face_on | **62.5%** | 0.297 | 2 |
| 1001 | dtl | 44.0% | **6.232** | 50 |
| 1021 | dtl | 38.7% | **1.200** | 10 |

#### 3가지 근본 원인

**원인 1 — Z 깊이 추정 실패 (P1: 팔 몸통 관통)**

2D → 3D 리프팅 모델(MediaPipe 계열)의 구조적 한계:
- 단안(monocular) 카메라 기반이므로 깊이(Z) 추정 불확실성이 매우 높음
- 팔과 몸통이 2D 이미지에서 겹칠 때(자기 차폐), 깊이 값을 구분하지 못함
- 결과: face_on 뷰에서 팔의 Z ≈ 흉부 Z → 아바타 공간에서 팔이 몸통 안으로 들어감
- **실측**: face_on 파일의 40~62% 프레임에서 `arm_z > chest_z` (팔이 흉부 뒤에 위치)

**원인 2 — 3D 그립 분리 (P2: 손목 분리)**

전처리 `step3: grip_constraint (tolerance=3%, 2D basis)`:
- 2D(x, y) 기준 손목 거리만 제약 → Z축 분리는 방치
- 추적 손실 시 Z값이 폭발적으로 증가 (파일 1008: max=30.16 units)
- 결과: 3D 손목 거리가 수십 배 벌어져 오른팔이 완전히 분리됨

**원인 3 — 신뢰도 급락 시 좌표 도약 (P3: 팝핑)**

- 연속 프레임 간 관절 위치가 0.15 units 이상 이동: 물리적으로 불가능
- 파일 1001: 50회 점프 (92 프레임 영상에서!)
- 원인: visibility가 낮을 때 추정값이 안정화되지 않음

---

### 해결책: PoseCorrector 시스템

#### 아키텍처

```
[JSON 로드] → [PoseCorrector.PreprocessSequence()]
                    │
                    ├─ Pass 1: 하드 클램프 (|값| > 1.5 → 이전 프레임 사용)
                    ├─ Pass 2: 속도 게이트 (Δ > 0.18 → 속도 외삽 + blend)
                    ├─ Pass 3: Z 깊이 강제 (face_on만: arm_z ≤ chest_z - 0.03)
                    └─ Pass 4: 3D 그립 제약 (|lWrist - rWrist| ≤ 0.20)
                    │
               [메모리 내 인플레이스 수정 완료]
                    │
        [BoneMapper.Initialize()] → [재생 파이프라인]
```

**오프라인 배치 처리** 방식 선택 이유:
1. 런타임 부담 없음 (로드 시 1회만 처리)
2. 프레임 간 상태(이전 위치, 속도)를 순차적으로 올바르게 유지
3. InterpolateFrames 및 OneEuroFilter가 이미 보정된 값을 사용하게 됨
4. BoneMapper.Initialize(addressFrame)도 보정된 기준 프레임 사용

#### 수정 파일

| 파일 | 변경 내용 |
|---|---|
| `Scripts/Correction/PoseCorrector.cs` | **신규** — 3단계 방어 시스템 |
| `Scripts/Core/SwingPlayer.cs` | `Start()`에서 PoseCorrector 호출 추가 |

#### PoseCorrector 파라미터

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `minArmDepthOffset` | 0.03 | 팔이 흉부보다 이 값만큼 카메라 쪽에 있어야 함 |
| `maxWristSeparation` | 0.20 | 3D 손목 간 최대 허용 거리 |
| `elbowFollowWeight` | 0.35 | 손목 이동 시 팔꿈치 추종 비율 |
| `maxJumpPerFrame` | 0.18 | 이 값 초과 시 점프로 판정 |
| `hardClampThreshold` | 1.5 | 이 값 초과 시 즉시 이전 프레임으로 대체 |
| `extrapolationBlend` | 0.15 | 점프 감지 시 외삽값과 현재값 블렌드 비율 |

---

### Unity 설정 체크리스트

- [ ] SwingPlayer와 동일한 GameObject에 `PoseCorrector` 컴포넌트 추가
- [ ] Inspector에서 `Enable Pose Correction = true` 확인
- [ ] Console에서 `[PoseCorrector] 전처리 완료` 로그 확인
- [ ] face_on 데이터: `깊이 보정` 횟수가 0보다 큰지 확인
- [ ] 파일 1008/1001 등 심각한 파일: `하드 클램프` 횟수 확인

### 핵심 교훈

1. **Z 깊이는 신뢰할 수 없다**: 단안 pose estimation의 구조적 한계. 항상 물리 제약으로 보완해야 함.
2. **2D 제약 ≠ 3D 제약**: 파이썬 전처리의 grip_constraint는 2D 기반이므로 3D Z 분리를 잡지 못함.
3. **오프라인 전처리의 장점**: 런타임 보정보다 데이터 로드 시 1회 배치 처리가 InterpolateFrames와의 순서 문제를 해결하고 퍼포먼스 부담도 없음.
4. **뷰 타입별 다른 제약**: face_on Z 제약은 DTL에 적용하면 안 됨. view_type 분기 필수.


---

## Review #9: PoseCorrector 깊이 클램핑 — 정상 데이터 파괴 버그

**보고 시점**: PoseCorrector 적용 후 Unity 테스트
**증상**: 팔꿈치가 뒤로 꺾임, 팔이 뒤로 꺾임, 왼팔/오른팔이 서로 헷갈린 것처럼 보임

---

### 근본 원인 분석

#### 버그 1 — 너무 공격적인 임계값

| 항목 | 내용 |
|---|---|
| **파일** | `PoseCorrector.cs` → `ApplyDepthClamping()` |
| **이전 코드** | `depthLimit = chestZ - minArmDepthOffset` (minArmDepthOffset = 0.03) |
| **문제** | chest_z = -0.085인 file 9에서 depthLimit = -0.115. 어깨보다 0.03 이상 앞에 있어야 한다는 조건인데, address에서 팔꿈치(-0.0752)와 손목(-0.0805)이 어깨(-0.0895)보다 살짝 뒤에 있는 것은 완전히 정상 포즈임에도 클램핑 대상으로 판정 |

실제 file 9 address 프레임 분석:
```
chest_z = -0.085  →  depthLimit = -0.115 (이전)

L_shoulder: z=-0.0895 (NOT clamped)
L_elbow:    z=-0.0752 → clamped to -0.115  ← 정상값인데 수정됨!
L_wrist:    z=-0.0805 → clamped to -0.115  ← 정상값인데 수정됨!
```

결과: file 9에서 **742회** 잘못된 보정 발생 (전체 ~1112 팔 관절 프레임의 67%)

#### 버그 2 — 관절 독립 클램핑이 팔 구조 파괴

```
이전 로직:
  elbow_z: -0.0752 → -0.115 (강제)
  wrist_z: -0.0805 → -0.115 (강제)
  결과: forearm 방향 z = wrist_z - elbow_z = -0.115 - (-0.115) = 0  ← 전완 방향 소멸!

올바른 로직:
  worstZ = max(elbow_z, wrist_z)
  shift = worstZ - maxAllowed
  elbow_z -= shift  (동일 이동)
  wrist_z -= shift  (동일 이동)
  결과: forearm 방향 z = PRESERVED  ✓
```

**팔꿈치가 뒤로 꺾인 원인**: elbow_z = wrist_z = -0.115 → 전완 방향 z = 0 → BoneMapper.ApplyLimb의 AimTwist가 z성분 없는 방향벡터로 잘못된 회전 계산.

**왼팔/오른팔 혼동처럼 보인 원인**: 양팔의 팔꿈치/손목이 모두 동일 z값(-0.115)으로 강제 → 양팔 FK 회전이 비슷해짐 → 좌우 대칭처럼 보임.

#### 버그 3 — 페이즈 비인식 (백스윙 중 오른팔 클램핑)

이전 로직은 스윙 페이즈를 무시하고 항상 동일 조건 적용. 백스윙 탑에서 오른팔이 몸통 뒤로 가는 것(정상 포즈)을 클램핑해서 앞으로 강제.

---

### 해결책

**깊이 클램핑 3단 개선**:

| 항목 | 이전 | 이후 |
|---|---|---|
| 임계값 | `shoulder_z - 0.03` (어깨보다 0.03 앞 강제) | `shoulder_z + 0.20` (어깨보다 0.20 이상 뒤일 때만 수정) |
| 적용 단위 | 관절 개별 클램핑 (relative z 파괴) | **팔 단위 uniform shift** (elbow+wrist 동일 이동) |
| 페이즈 인식 | 없음 | 백스윙(top, mid_backswing): 오른팔 skip / 피니시(finish, mid_follow_through): 왼팔 skip |

**새 로직 검증 결과**:
```
file 9 (face_on, 278프레임):
  이전: 깊이 보정 742회 (잘못된 보정)
  이후: 깊이 보정 0회  (정상 데이터이므로 수정 불필요) ✓
```

**핵심 교훈**:
1. **임계값 설계 실수**: `chestZ - offset`은 "어깨보다 앞에 있어야 한다"는 강한 조건. 실제 데이터에서 팔꿈치가 어깨보다 살짝 뒤에 있는 것은 자연스러운 자세.
2. **관절 독립 클램핑의 위험**: 두 관절을 같은 값으로 클램핑하면 relative z (방향벡터의 z성분)가 0이 되어 FK 회전 계산이 붕괴됨.
3. **페이즈 인식의 중요성**: 백스윙에서 오른팔이 몸 뒤로 가는 것은 이상값이 아님. 물리적으로 맞는 포즈에 제약을 걸면 오히려 망가짐.
4. **정상 파일로 먼저 검증**: 수정 전 python으로 실제 데이터에 시뮬레이션해서 오탐률 확인 필수.

