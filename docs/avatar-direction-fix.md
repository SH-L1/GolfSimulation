# 아바타 방향 수정 방안 정리

## 현상 및 원인

현재 아바타의 팔이 앞으로 들려야 할 때 뒤로 향하는 문제가 발생하고 있습니다.

원인은 좌표계 변환 구조에서 **Z축이 이중으로 반전**되어 결과적으로 원래 값으로 복원되기 때문입니다.

| 단계 | X | Y | Z |
|---|---|---|---|
| 백엔드 step7 저장 시 | 그대로 | 반전 | 반전 |
| Unity `dataAxisSigns` 적용 | 반전 `×-1` | 유지 `×+1` | 반전 `×-1` |
| **최종 결과** | 반전 | 반전 | **원복 (이중반전)** |

Z축이 원복되면서 데이터 기준 "앞"이 아바타 기준 "뒤"를 가리키게 되고,  
이로 인해 팔 IK 타겟이 뒤쪽으로 계산됩니다.

---

## 수정 방안 3가지

### 방법 1: `useBackFacingBodyFrame` 플래그 토글 (가장 빠름)

`BoneMapper.cs`에 이미 이 목적의 파라미터가 존재합니다.  
Inspector에서 값을 바꾸는 것만으로 테스트 가능합니다.

```csharp
// BoneMapper.cs (현재 기본값)
[SerializeField] private bool useBackFacingBodyFrame = true;

// → Inspector에서 false 로 변경
```

`GetAnatomicalFrontDirection()`과 `GetAnatomicalRightDirection()` 내부에서  
이 플래그가 `true`일 때 방향 부호를 뒤집습니다.  
`false`로 변경하면 아바타가 반대 방향을 바라보는 효과가 납니다.  
**코드 수정 없이 Inspector 토글만으로 즉시 확인 가능합니다.**

---

### 방법 2: 아바타 루트 GameObject Y축 180도 회전

Unity 씬 Hierarchy에서 아바타 루트 오브젝트의 Transform Rotation Y값을 `180`으로 설정합니다.

```
아바타 루트 오브젝트
└─ Transform
   └─ Rotation: (0, 180, 0)
```

또는 코드로 처리할 경우 `SwingSimulationController.cs` 초기화 시점에 적용합니다.

```csharp
avatarRoot.transform.rotation = Quaternion.Euler(0f, 180f, 0f);
```

`BoneMapper.cs`의 `CalibrateDataFrame()`이 `animator.transform.forward`를 기준으로  
좌표계를 자동 보정하기 때문에, 아바타를 돌리면  
**골반, 척추, 팔, 다리, 머리 방향이 전부 연쇄적으로 자동 재보정**됩니다.  
별도 캘리브레이션 코드 수정이 필요 없습니다.

```
수정 전:
데이터 Z(앞) → 이중반전 → Unity Z(앞) → 아바타 forward(뒤) → 팔이 뒤로 ❌

수정 후:
데이터 Z(앞) → 이중반전 → Unity Z(앞) → 아바타 forward(앞) → 팔이 앞으로 ✅
```

---

### 방법 3: `dataFrameToAvatarFrame`에 180도 강제 추가

방법 1, 2로 해결되지 않을 경우, 캘리브레이션 결과 쿼터니언에 직접 180도 회전을 추가합니다.

```csharp
// BoneMapper.cs — CalibrateDataFrame() 수정

// 변경 전
dataFrameToAvatarFrame = avatarRot * Quaternion.Inverse(dataRot);

// 변경 후: Y축 180도 강제 추가
dataFrameToAvatarFrame = Quaternion.Euler(0f, 180f, 0f)
                         * avatarRot * Quaternion.Inverse(dataRot);
```

이 방법은 씬 구조나 Inspector 설정과 무관하게 코드 레벨에서 방향을 고정하므로,  
카메라 앵글이나 아바타 세팅이 바뀌어도 항상 동일하게 적용됩니다.

---

## 권장 적용 순서

| 순서 | 방법 | 변경 범위 | 비고 |
|---|---|---|---|
| 1단계 | `useBackFacingBodyFrame = false` | Inspector 토글 | 코드 수정 없음, 즉시 확인 가능 |
| 2단계 | 아바타 루트 Y축 180도 회전 | 씬 설정 또는 코드 1줄 | 캘리브레이션 자동 반영 |
| 3단계 | `dataFrameToAvatarFrame`에 180도 추가 | `BoneMapper.cs` 1줄 | 코드 레벨 고정 |

---

## 향후 고려사항 (선택)

현재 Z축 이중 반전 구조는 결과적으로 동작하지만, 유지보수 관점에서 혼란을 줄 수 있습니다.  
추후 리팩토링 시 아래 둘 중 하나로 정리를 권장합니다.

- **Option A:** 백엔드 step7의 Z 반전 제거 → Unity `dataAxisSigns.z = -1` 단일 반전으로 통일
- **Option B:** Unity `dataAxisSigns.z` 를 `-1` → `+1` 변경 → 기존 JSON 재사용 가능, 백엔드 수정 불필요

> 이는 즉시 대응 사항이 아니며, 위 3가지 방법과 **충돌하지 않습니다.**

---

## 관련 파일

| 파일 | 경로 |
|---|---|
| 좌표 변환 핵심 | `GolfSimulation/Assets/Scripts/Core/BoneMapper.cs` |
| 씬 컨트롤러 | `GolfSimulation/Assets/Scripts/Core/SwingSimulationController.cs` |
| JSON 로더 | `GolfSimulation/Assets/Scripts/Data/PoseDataLoader.cs` |
