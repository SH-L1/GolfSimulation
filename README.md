# GolfSimulation — 모바일 골프 코칭 앱

모바일 환경에서 전문가 수준의 골프 스윙을 **AI 분석 + 3D 아바타로 실시간 시각화**하는 골프 코칭 애플리케이션입니다.

---

## 주요 기능

| 화면 | 설명 |
|------|------|
| **홈 대시보드** | 최근 스윙 요약, 점수 추이, 빠른 업로드 진입 |
| **영상 업로드** | 카메라/갤러리에서 스윙 영상 선택 및 업로드 |
| **스윙 분석 결과** | 부위별 점수, 핵심 피드백, AI 코칭 멘트 |
| **3D 모델링 뷰어** | 17개 관절 기반 3D 아바타로 스윙 재현 |
| **AI 코칭 챗봇** | 분석 결과 기반 대화형 코칭 |
| **타임라인** | 스윙 기록 히스토리 및 성장 추이 |
| **프로필** | 사용자 정보, 레벨, 통계 |

---

## 3D 스윙 시각화 핵심 기술

2D/3D 환경에서 추출된 **17개의 희소(Sparse) 관절 좌표 데이터**를 기반으로, 표준화된 3D 아바타 에셋에 경량화된 좌표 데이터를 실시간으로 덮어씌우는 **절차적 애니메이션(Procedural Animation)** 기법을 채택합니다.

| 기술 | 설명 |
|------|------|
| **역운동학(IK)** | 손목·발목 좌표를 Target으로 설정하여 팔꿈치·어깨 위치를 해부학적 한계 내에서 역산 |
| **X-Factor 연산** | 양 어깨·양 골반 벡터의 방향 차이를 도출하여 척추·가슴 회전값을 보간 |
| **Slerp 보간** | 구면 선형 보간으로 30fps 데이터를 60fps 이상의 매끄러운 동작으로 재생 |
| **One Euro Filter** | 동적 로우패스 필터를 적용하여 관절 떨림(Jittering) 노이즈 제거 |

데이터 파이프라인:
```
데이터 정규화 ──▶ 최적 궤적 도출 ──▶ 실시간 렌더링
(골반 중심 원점화)   (스윙 시퀀스 생성)   (뼈대 매핑 + 보간)
```

1. **데이터 정규화** — 골반 중심을 원점으로 정규화하여 개별 신체 비율 차이를 배제
2. **최적 궤적 도출** — 정규화된 좌표와 물리적 지표(척추각 등)를 활용한 스윙 시퀀스를 경량 데이터 포맷으로 출력
3. **실시간 렌더링** — 표준 아바타의 뼈대 계층 구조에 시퀀스 데이터를 실시간 매핑 및 보간

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| **프레임워크** | React Native 0.84.1 |
| **언어** | TypeScript |
| **네비게이션** | React Navigation (Stack + Bottom Tabs) |
| **애니메이션** | React Native Reanimated |
| **3D 렌더링** | Unity (UaaL — Unity as a Library) |
| **미디어** | react-native-video, react-native-image-picker |
| **아이콘** | react-native-vector-icons |
| **로컬 저장소** | @react-native-async-storage/async-storage |

---

## 시작하기

### 사전 요구사항

- Node.js 18+
- Android Studio (Android 빌드)
- Xcode 14+ (iOS 빌드, macOS 전용)
- React Native 환경 세팅: [공식 가이드](https://reactnative.dev/docs/set-up-your-environment)

### 설치 및 실행

```bash
cd GolfSimulation
npm install

# Android
npm run android

# iOS (macOS)
bundle install
bundle exec pod install
npm run ios
```

Metro 개발 서버만 실행:
```bash
npm start
```

---

## 프로젝트 구조

```
GolfSimulation/
├── src/
│   ├── components/
│   │   ├── ui/               # Button, Card, Badge (공통)
│   │   └── swing/            # SwingScoreRing 등 스윙 전용
│   ├── screens/
│   │   ├── Home/             # 홈 대시보드
│   │   ├── SwingUpload/      # 영상 업로드
│   │   ├── SwingFeedback/    # 스윙 분석 결과
│   │   ├── Viewer3D/         # 3D 모델링 뷰어
│   │   ├── SwingChat/        # AI 코칭 챗봇
│   │   ├── Records/          # 타임라인
│   │   └── Profile/          # 프로필
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   └── TabNavigator.tsx
│   ├── theme/
│   │   └── index.ts          # 디자인 토큰 (다크 골프 테마)
│   └── hooks/
│       ├── useSwingAnalysis.ts
│       └── useAuth.ts
├── android/
├── ios/
├── docs/
│   └── architecture/
│       └── 3d-swing-visualization.md
├── App.tsx
├── index.js
└── package.json
```

---

## 디자인 토큰

| 토큰 | 값 | 용도 |
|------|----|------|
| `background` | `#0F1923` | 앱 배경 (다크 네이비) |
| `surface` | `#1E2D3D` | 카드/패널 배경 |
| `accent` | `#1A5C38` | 주요 액션, 강조 (골프 그린) |
| `gold` | `#C8922A` | 점수, 하이라이트 |
| `textPrimary` | `#FFFFFF` | 기본 텍스트 |
| `textSecondary` | `#8899AA` | 보조 텍스트 |
| `border` | `#2A3D50` | 구분선, 테두리 |

---

## 문서

- [3D 스윙 시각화 아키텍처](docs/architecture/3d-swing-visualization.md)
