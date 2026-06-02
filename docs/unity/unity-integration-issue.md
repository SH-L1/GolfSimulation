# Unity 인앱 임베딩 통합 이슈 문서

> **목적**: React Native 앱 내에 Unity 3D 뷰어를 컴포넌트로 임베딩하는 과정에서 발생한 시도·실패·제한 원인을 Unity 개발자와의 협업을 위해 정리한 문서입니다.

---

## 1. 목표 (원래 의도)

골프 스윙 분석 결과(랜드마크 좌표 JSON)를 받아 **3D 아바타가 스윙 동작을 재생하는 뷰어**를 앱 내에 자연스럽게 통합하는 것.

구체적으로 원했던 형태:

```
┌──────────────────────────────────────┐
│          React Native 앱              │
│                                      │
│  ┌────────────────────────────────┐  │
│  │     Unity 3D 뷰포트 (View)     │  │  ← Unity가 이 영역에서 렌더링
│  │   (아바타 스윙 애니메이션)      │  │
│  └────────────────────────────────┘  │
│                                      │
│  [RN UI] 재생버튼 / 배속 / 페이즈    │  ← React Native가 컨트롤 UI 담당
│  [RN UI] 스크러버 / 타임라인         │
│                                      │
└──────────────────────────────────────┘
```

**요구사항**:
- Unity 렌더링 영역과 RN UI가 **같은 화면**에 공존
- RN에서 Unity로 **포즈 JSON 데이터 실시간 전달** (백엔드 API 응답값)
- RN에서 Unity로 **재생 제어 명령 전달** (재생/정지, 배속, 카메라 각도)
- Unity 고유의 UI 없이 **RN UI로 완전 제어**

---

## 2. 현재 임시 해결책 (별도 Activity 실행)

View 임베딩에 반복적으로 실패한 후, 급한 불을 끄기 위해 **Unity를 별도 Activity로 실행**하는 방식으로 우회했습니다.

### 현재 코드 구조

```
android/app/src/main/java/com/golfapp/
├── UnityLauncherModule.kt    ← RN NativeModule
├── UnityLauncherPackage.kt   ← 모듈 등록
└── CustomUnityActivity.kt    ← UnityPlayerGameActivity 상속
```

```kotlin
// UnityLauncherModule.kt
@ReactMethod
fun launch() {
    val intent = Intent(activity, CustomUnityActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)   // ← 별도 태스크로 실행
    }
    activity.startActivity(intent)
}
```

```kotlin
// CustomUnityActivity.kt
class CustomUnityActivity : UnityPlayerGameActivity() {
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            moveTaskToBack(true)   // 뒤로가기 시 RN 태스크로 복귀
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}
```

### 현재 방식의 문제점

| 문제 | 설명 |
|------|------|
| 앱과 완전 단절 | `FLAG_ACTIVITY_NEW_TASK`로 Unity와 RN이 별도 태스크 → 데이터 교환 불가 |
| JSON 하드코딩 | Unity가 `assets/golf_swing_pose.json`을 직접 읽음. 백엔드 데이터 미수신 |
| UI 이중 구현 | Unity 화면과 RN 화면이 분리되어 UX 일관성 없음 |
| 화면 전환 이질감 | Unity 실행 시 전체 화면 전환 발생 |

---

## 3. 시도했던 View 임베딩 방법들

### 시도 1 — `@azesmway/react-native-unity` 라이브러리

가장 많이 사용되는 UaaL View 임베딩 라이브러리.

**설정 방법**:
1. `npm install @azesmway/react-native-unity`
2. `android/settings.gradle`에 unityLibrary 경로 등록
3. `android/app/build.gradle`에 `implementation project(':unityLibrary')` 추가
4. RN에서 `<UnityView />` 컴포넌트 사용

**발생한 오류**:
```
incompatible types: UnityPlayer cannot be converted to FrameLayout
```

라이브러리 내부 코드가 `UnityPlayer`를 `FrameLayout`으로 캐스팅하는데,
Unity 6에서는 `UnityPlayer`가 더 이상 `View`를 상속하지 않아 타입 불일치 발생.

**상태**: 2025년 1월 기준 GitHub Issue #146 오픈, 미해결.

---

### 시도 2 — `fusetools/react-native-unity2` 라이브러리

`react-native-unity-play`의 fork. Unity 2022.x까지 테스트됨.

**발생한 오류**: Unity 6 환경에서 동일한 `UnityPlayer` 타입 문제 발생.

Unity 2020~2022 기준으로 설계된 라이브러리로, Unity 6 대응 없음.

---

### 시도 3 — 직접 네이티브 ViewManager 구현

라이브러리 없이 직접 Kotlin으로 `ReactViewManager`를 작성하고
`UnityPlayer`를 View로 올리는 방식 시도.

**발생한 오류**:
```
Cannot instantiate abstract class UnityPlayer
```

Unity 6에서 `UnityPlayer` 자체가 abstract class로 변경됨.
직접 인스턴스화 불가. 아래 Unity 6 아키텍처 변경 섹션 참고.

---

## 4. 왜 View 임베딩이 안 되는가 — 근본 원인

### Unity 6에서 발생한 아키텍처 변경

Unity 2022 LTS까지와 Unity 6는 `UnityPlayer`의 설계가 근본적으로 다릅니다.

#### Unity 2022 LTS 이전 구조

```
UnityPlayer extends FrameLayout (= View)
    ↓
앱의 레이아웃에 직접 addView() 가능
    ↓
모든 임베딩 라이브러리가 이 구조를 전제로 설계됨
```

```kotlin
// Unity 2022까지 가능했던 방식
val unityPlayer = UnityPlayer(activity)          // 직접 인스턴스화 가능
val frameLayout = unityPlayer as FrameLayout     // View 캐스팅 가능
parentLayout.addView(frameLayout)                // 레이아웃에 삽입 가능
```

#### Unity 6 (6000.x) 이후 구조

```
UnityPlayer → abstract class (View 아님)
UnityPlayerForGameActivity (구체 클래스, Activity 전용)
UnityPlayerGameActivity extends GameActivity (AndroidX Games 라이브러리)
    ↓
UnityPlayer는 Activity 없이 단독으로 존재할 수 없음
    ↓
View로 직접 추출·삽입 불가
```

```java
// Unity 6의 UnityPlayerGameActivity.java (실제 코드)
public class UnityPlayerGameActivity extends GameActivity
    implements IUnityPlayerLifecycleEvents, IUnityPermissionRequestSupport, IUnityPlayerSupport {

    protected UnityPlayerForGameActivity mUnityPlayer;  // Activity 내부에서만 생성됨

    // onCreate 내부에서만 초기화 — 외부에서 꺼낼 수 없음
}
```

**Unity 6에서 삭제된 API 목록**:

| 삭제된 메서드/속성 | 기존 역할 |
|-------------------|-----------|
| `new UnityPlayer(activity)` | UnityPlayer 직접 생성 |
| `UnityPlayer extends FrameLayout` | View로서의 레이아웃 삽입 |
| `unityPlayer.requestFocus()` | 포커스 제어 |
| `unityPlayer.getParent()` | View 계층 탐색 |
| `unityPlayer.setZ()` | Z축 레이어 제어 |
| `unityPlayer.quit()` | 종료 |

### Unity 6가 이렇게 바꾼 이유

Unity 6는 Android의 **GameActivity** (Google AndroidX Games 라이브러리)를 기반으로 전환했습니다.
`GameActivity`는 `AppCompatActivity`와 달리 네이티브 레이어와 더 직접적으로 연결되며,
Activity 라이프사이클과 GL 렌더링 컨텍스트를 함께 관리합니다.
이 구조에서는 렌더링 Surface가 Activity와 분리될 수 없습니다.

```
기존 (Activity ↔ View 분리 가능):
  AppCompatActivity → FrameLayout → UnityPlayer (View)

Unity 6 (Activity와 Surface 결합):
  GameActivity ─── NativeActivity 레이어 ─── GL Surface
       ↑
  UnityPlayerGameActivity가 이 전체를 소유
```

---

## 5. 현재 프로젝트 환경 상세

### Unity 빌드 환경

| 항목 | 값 |
|------|----|
| Unity 버전 | **6000.3.6f1 (Unity 6)** |
| 빌드 방식 | UaaL (Unity as a Library) — Android Library 모듈로 export |
| AGP 버전 | 8.10.0 |
| compileSdk | 36 |
| targetSdk | 36 |
| minSdk | 25 |
| NDK 버전 | 27.2.12479018 |
| Scripting Backend | IL2CPP |
| ABI | armeabi-v7a, arm64-v8a |
| 추가 Unity 패키지 | com.unity.purchasing (billingclient 8.3.0 포함) |

### 빌드 출력 구조

```
GolfSimulation/unity/
├── unityLibrary/               ← Android Library 모듈 (핵심)
│   ├── src/main/
│   │   ├── assets/
│   │   │   ├── golf_swing_pose.json         ← 현재 하드코딩된 포즈 데이터
│   │   │   ├── 613_square_cleanswing.json   ← 테스트 샘플
│   │   │   └── bin/Data/
│   │   │       └── data.unity3d             ← 컴파일된 Unity 에셋 (6.1MB)
│   │   ├── java/com/unity3d/player/
│   │   │   └── UnityPlayerGameActivity.java ← Unity 6 Activity
│   │   ├── cpp/                             ← IL2CPP 네이티브 코드
│   │   └── jniLibs/                         ← .so 바이너리 (libil2cpp.so 등)
│   └── build.gradle
└── launcher/                   ← Unity 독립 실행용 (현재 미사용)
```

### RN ↔ Android 연동 현황

```
android/settings.gradle:
  include ':unityLibrary'
  project(':unityLibrary').projectDir = file('../unity/unityLibrary')

android/app/build.gradle:
  implementation project(':unityLibrary')
  implementation fileTree(dir: '../../unity/unityLibrary/libs', include: ['*.jar'])
  implementation 'androidx.games:games-activity:3.0.5'
```

### 포즈 JSON 포맷 (백엔드가 Unity에 넘겨야 하는 형식)

```json
{
  "fps": 29.97,
  "totalframes": 223,
  "events": {
    "address":          { "frame": 0,   "confidence": 0.94, "timestamp": 0.83 },
    "toe_up":           { "frame": 77,  "confidence": 0.99, "timestamp": 3.40 },
    "mid_backswing":    { "frame": 98,  "confidence": 0.99, "timestamp": 4.10 },
    "top":              { "frame": 128, "confidence": 0.99, "timestamp": 5.10 },
    "mid_downswing":    { "frame": 149, "confidence": 0.99, "timestamp": 5.80 },
    "impact":           { "frame": 164, "confidence": 0.99, "timestamp": 6.30 },
    "mid_followthrough":{ "frame": 174, "confidence": 0.99, "timestamp": 6.64 },
    "finish":           { "frame": 215, "confidence": 0.90, "timestamp": 8.00 }
  },
  "landmarknames": [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder",
    "left_elbow", "right_elbow",
    "left_wrist", "right_wrist",
    "left_hip", "right_hip",
    "left_knee", "right_knee",
    "left_ankle", "right_ankle",
    "left_heel", "right_heel",
    "left_foot_index", "right_foot_index",
    "hip_center"
  ],
  "frames": [
    {
      "frame": 0,
      "timestamp": 0.0,
      "landmarks": [
        { "name": "nose", "x": 0.461, "y": -0.377, "z": 0.065, "visibility": 1.0 },
        { "name": "left_shoulder", "x": 0.312, "y": -0.201, "z": 0.021, "visibility": 0.98 }
      ]
    }
  ]
}
```

---

## 6. Unity 개발자 확인 필요 사항

다음 항목들을 Unity 개발자 측에서 확인 및 결정해주어야 합니다.

- [ ] **C# 렌더링 로직 완성도**: 아바타 본 매핑, IK, Slerp 보간, 포즈 JSON 파싱이 실제로 구현되어 있는지
- [ ] **Unity 버전 협의**: Unity 6 유지 vs Unity 2022 LTS 다운그레이드 중 어느 방향이 현실적인지
- [ ] **Unity 6 Fragment 임베딩 가능 여부**: Unity 6 기준 공식 또는 비공식 Fragment 임베딩 방법 존재 여부
- [ ] **UnitySendMessage API 사용 가능 여부**: 현재 Unity 6 빌드에서 `UnityPlayer.UnitySendMessage()` 호출 가능한지 (방향 A 구현 전제 조건)
- [ ] **포즈 JSON 포맷 수용 여부**: 섹션 5의 JSON 포맷이 C# 파서에서 처리 가능한지, 또는 다른 포맷이 필요한지

---

## 7. 참고 링크

- [azesmway/react-native-unity — Unity 6 빌드 실패 이슈 #146](https://github.com/azesmway/react-native-unity/issues/146)
- [azesmway/react-native-unity — Unity 2023 FrameLayout 타입 오류 이슈 #123](https://github.com/azesmway/react-native-unity/issues/123)
- [Unity 공식 — GameActivity 문서](https://docs.unity3d.com/6000.0/Documentation/Manual/android-game-activity.html)
- [dev.family — RN 0.73 + Unity 2022.3 통합 성공 사례](https://dev.family/blog/article/integrating-unity-code-into-react-native)
- [Google AndroidX Games — GameActivity](https://developer.android.com/games/agdk/game-activity)
