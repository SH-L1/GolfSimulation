# Golf Swing Coach App
## 프로젝트 아키텍처 & 개발 설계 문서

> **버전:** v2.2
> **최초 작성:** 2026-03-11 | **최종 수정:** 2026-03-31
>
> **변경 사항 (v2.1 → v2.2)**
> - 포즈 추출 모델 변경: MediaPipe Pose → RTMPose (Halpe26, 26 keypoints)
> - GolfDB 전처리 파이프라인 단계 순서 확정 (Step2 → Step4 → Step3)
> - GPU 환경 확정: CUDA 12.8 + cuDNN + onnxruntime-gpu (Colab T4)
> - 배치 처리 전략 추가: 뷰 단위 선복사 → 처리 → Drive 저장 → 로컬 정리
> - SwingNet 출력 클래스 수 확정: 9개 (8 이벤트 + 1 배경)
> - 개발 로드맵 진행 현황 반영

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [서비스 타겟 및 핵심 가치](#2-서비스-타겟-및-핵심-가치)
3. [기술 스택](#3-기술-스택)
4. [시스템 아키텍처](#4-시스템-아키텍처)
5. [레퍼런스 데이터 — GolfDB 파이프라인](#5-레퍼런스-데이터--golfdb-파이프라인)
6. [Module 1 — 스윙 분석](#6-module-1--스윙-분석)
7. [Module 2 — LLM 코칭 챗봇](#7-module-2--llm-코칭-챗봇)
8. [Module 3 — 3D 시각화 & 프로 비교](#8-module-3--3d-시각화--프로-비교)
9. [데이터베이스 설계 (Firebase)](#9-데이터베이스-설계-firebase)
10. [API 설계](#10-api-설계)
11. [개발 로드맵](#11-개발-로드맵)
12. [대체 기능 후보 (Fallback Plan)](#12-대체-기능-후보-fallback-plan)
13. [리스크 & 대응 전략](#13-리스크--대응-전략)
14. [부록 A — 용어 정의](#14-부록-a--용어-정의)
15. [부록 B — 핵심 참조 논문 & 데이터셋](#15-부록-b--핵심-참조-논문--데이터셋)

---

## 1. 프로젝트 개요

### 1.1 문제 정의

골프 스윙은 동작이 0.2초 내외로 매우 빠르고, 어깨·골반·손목·척추 등 다수 관절이 복합적으로 작용한다.
아마추어 골퍼(초보~중급)는 자신의 자세 문제를 정량적으로 파악하기 어렵고, 전문 코치에 의한 피드백은 비용과 접근성 문제가 있다.

### 1.2 솔루션 요약

스마트폰 카메라로 촬영한 골프 스윙 영상을 업로드하면:

- **Module 1**: RTMPose로 관절 랜드마크를 추출해 스윙 지표를 수치화·점수화·시각화
- **Module 2**: 추출 수치 + GolfDB 기반 프로 레퍼런스를 로컬 LLM에 주입해 운동학습 이론 기반 개인화 코칭 챗봇 제공
- **Module 3**: 3D 스켈레톤 애니메이션으로 다각도 관찰 및 프로 스윙과 오버레이 비교

### 1.3 서비스 형태

- **플랫폼**: 모바일 앱 (iOS / Android)
- **처리 방식**: 업로드 후 비동기 처리 (수십 초 대기 후 결과 확인)
- **타겟 사용자**: 초보 ~ 중급 아마추어 골퍼

---

## 2. 서비스 타겟 및 핵심 가치

| 구분 | 초보 (Beginner) | 중급 (Intermediate) |
|------|----------------|---------------------|
| 주요 니즈 | 기본 자세 교정, 쉬운 피드백 | 세밀한 수치 비교, 프로와 차이 확인 |
| Module 1 활용 | 전체 점수 + 빨간 항목 신호등 표시 | 페이즈별 수치 상세 대시보드 |
| Module 2 활용 | "이것만 고치세요" 쉬운 언어 코칭 | 원인-교정-확인 구조 + 드릴 포함 |
| Module 3 활용 | 자신의 3D 스윙 관찰 | 프로 선수 스윙과 오버레이 비교 |

> **UX 방향**: Progressive Disclosure 패턴 적용

---

## 3. 기술 스택

| 계층 | 기술 | 선택 이유 |
|------|------|-----------|
| **Frontend** | React Native (Expo) | 크로스플랫폼, TypeScript |
| **Backend** | FastAPI (Python) | ML/CV 라이브러리와 동일 생태계 |
| **Task Queue** | Celery + Redis | 영상 처리 비동기화 |
| **Auth** | Firebase Auth | 소셜 로그인 |
| **Database** | Firebase Firestore | NoSQL, 실시간 업데이트 |
| **File Storage** | Firebase Storage | 영상·결과 이미지 관리 |
| **CV/ML (GolfDB 전처리)** | RTMPose (Halpe26) + onnxruntime-gpu | 26개 키포인트, GPU 가속 |
| **CV/ML (사용자 앱)** | MediaPipe Pose | 33개 3D 랜드마크, 모바일 실시간 |
| **이벤트 탐지** | SwingNet (GolfDB) | 8개 스윙 이벤트 자동 탐지 |
| **LLM** | Ollama (llama3.1 / gemma3) | 로컬 실행, API 비용 없음 |
| **3D** | Unity WebGL or react-three-fiber | 모바일 경량 3D 렌더링 |
| **Reference Data** | GolfDB (CVPR 2019) | 프로 골퍼 1,400개 스윙 영상 |
| **Container** | Docker Compose | 배포 환경 일관성 |

> ⚠️ **포즈 모델 이원화 정책**
> - GolfDB 전처리: RTMPose (Halpe26) — 정밀도 우선, 서버 GPU 환경
> - 사용자 앱 실시간: MediaPipe Pose (33 keypoints) — 모바일 경량 실시간

---

## 4. 시스템 아키텍처

### 4.1 논리 아키텍처
┌──────────────────────────────────────────────────────┐
│ Mobile App (React Native) │
│ [Login] [Module 1 Dashboard] [Module 2 Chat] │
│ [Module 3 3D Viewer] │
└──────────────────┬───────────────────────────────────┘
│ HTTPS REST / SSE
┌──────────────────▼───────────────────────────────────┐
│ FastAPI Backend │
│ POST /api/module1/analyze │
│ POST /api/module2/chat │
│ GET /api/module3/landmarks/{session_id} │
└────┬──────────────────────┬───────────────────────────┘
│ │
┌────▼────────┐ ┌────────▼──────────────┐
│ ML Services │ │ Firebase │
│ MediaPipe │ │ Auth/Firestore/Storage│
│ SwingNet │ └───────────────────────┘
│ Ollama LLM │
└─────────────┘
↑ (오프라인 전처리, 1회성)
┌──────┴──────────────────────────────────┐
│ GolfDB 전처리 파이프라인 (Colab T4) │
│ RTMPose + SwingNet → reference_stats │
└─────────────────────────────────────────┘


### 4.2 데이터 흐름 요약

1. 사용자 → Firebase Storage에 영상 업로드
2. 앱 → FastAPI에 분석 요청 → Celery 큐 등록
3. Celery Worker → MediaPipe + SwingNet 처리 → 결과 Firestore 저장
4. 앱 → Firebase Realtime 알림 수신
5. 사용자 → 채팅 메시지 → LLM 코칭 응답 스트리밍

---

## 5. 레퍼런스 데이터 — GolfDB 파이프라인

### 5.1 GolfDB 개요

| 항목 | 내용 |
|------|------|
| 출처 | CVPR 2019 Workshop (McNally et al.) |
| 영상 수 | 1,400개 프로 골프 스윙 영상 |
| 레이블 | 8개 이벤트 프레임 (Address ~ Finish) |
| 활용 목적 | 프로 스윙 지표 mean/std/ideal_range 산출 |

### 5.2 오프라인 전처리 파이프라인 (확정 순서)
GolfDB 영상 (1,400개)
→ [Step 1] 뷰 분류 (dtl / face_on / other) + 정사각형 패딩 ✅ 완료
→ [Step 2] RTMPose (Halpe26) → 프레임별 26개 키포인트 추출 ✅ 완료
→ [Step 4] SwingNet → 8개 이벤트 프레임 탐지 🔄 진행 중
→ [Step 3] Unity 좌표 변환 (Cubic Spline, 이상치 보정) ⏳ 대기
→ [Step 5] body-scale 정규화 ⏳ 대기
→ [Step 6] 페이즈별 핵심 지표 계산 (P1 7종) ⏳ 대기
→ [Step 7] 통계 산출: mean/std/p25/p75/ideal_range ⏳ 대기
→ [Step 8] Firestore reference_stats/{version} 저장 ⏳ 대기


> ⚠️ 파일명은 Step3/Step4이나 **실제 실행 순서는 Step2 → Step4 → Step3**

### 5.3 처리 환경 (Colab)

| 항목 | 내용 |
|------|------|
| GPU | T4 (VRAM 15GB) |
| CUDA | 12.8 |
| 추론 백엔드 | onnxruntime-gpu 1.20.1 + CUDAExecutionProvider |
| 배치 전략 | 뷰 단위 전체 선복사 → 처리 → Drive 저장 → 정리 |
| 샘플링 비율 | 20% (step 5씩) |
| 체크포인트 | 50개 단위 자동 저장 |
| 세션 유지 | 크롬 개발자 도구 keepalive 스크립트 |

---

## 6. Module 1 — 스윙 분석

### 6.1 처리 파이프라인
입력: 사용자 스윙 영상 (.mp4)
→ 프레임 추출 (OpenCV)

→ MediaPipe Pose → 33개 랜드마크 (x, y, z, visibility)

→ visibility < 0.5 필터링 → 선형 보간

→ SwingNet 이벤트 탐지 (실패 시 규칙 기반 Fallback)

→ 어깨 너비 기준 body-scale 정규화

→ 페이즈별 지표 계산 (P1 7종 / P2 5종)

→ GolfDB reference_stats 비교 → 점수 산출

→ 시각화 생성

출력: AnalysisResult JSON + 오버레이 이미지 + 3D 랜드마크


### 6.2 핵심 지표 (P1 — 7종)

| 지표 ID | 페이즈 | 단위 |
|---------|--------|------|
| STANCE_RATIO | Address | ratio |
| SHOULDER_ROT | Mid-Backswing | degree |
| X_FACTOR | Top | degree |
| BACKSWING_MAX | Top | degree |
| HIP_ROTATION | Impact | degree |
| WRIST_ANGLE | Impact | degree |
| SPINE_TILT | Finish | degree |

### 6.3 점수화
score = max(0, 100 − |user_value − pro_mean| / pro_std × 20)


**Overall Score 페이즈 가중치**: Address 15% / Top 25% / Impact 45% / Finish 15%

---

## 7. Module 2 — LLM 코칭 챗봇

**핵심 원칙: 판단(통계)과 설명(LLM) 역할 분리**

| 역할 | 담당 |
|------|------|
| 무엇이 문제인가 | GolfDB 통계 + 점수화 알고리즘 |
| 왜 문제인가, 어떻게 고치나 | Ollama LLM |

**Hallucination 방지**: 실제 수치 프롬프트 주입 + JSON 응답 강제 + 파싱 검증

---

## 8. Module 3 — 3D 시각화 & 프로 비교

| 기능 | 설명 |
|------|------|
| 3D 스켈레톤 재생 | 속도 조절 가능한 스윙 애니메이션 |
| 다각도 관찰 | 정면/측면/45도 자유 전환 |
| Shadow Avatar | 프로 스켈레톤 반투명 오버레이 |
| 이벤트 점프 | Top/Impact 프레임 즉시 이동 |

---

## 9. 데이터베이스 설계 (Firebase)
Firestore
├── users/{uid}
│ ├── profile (display_name, skill_level, handicap)
│ └── sessions/{session_id}
│ ├── status: queued | processing | done | error
│ ├── analysis_result: { ...AnalysisResult }
│ └── chat_history/{msg_id}
├── reference_stats/{version}
│ └── metrics_by_phase
└── pro_swings/{player_id}
└── landmarks_3d_path


---

## 10. API 설계

| Module | Method | Path | 설명 |
|--------|--------|------|------|
| Auth | POST | /api/auth/verify | 토큰 검증 |
| Module 1 | POST | /api/module1/analyze | 스윙 분석 요청 |
| Module 1 | GET | /api/module1/result/{session_id} | 분석 결과 조회 |
| Module 2 | POST | /api/module2/chat | 코칭 메시지 |
| Module 2 | SSE | /api/module2/chat/stream | 스트리밍 응답 |
| Module 3 | GET | /api/module3/landmarks/{session_id} | 사용자 랜드마크 |
| Module 3 | GET | /api/module3/pro/{player_id} | 프로 랜드마크 |

---

## 11. 개발 로드맵

| Phase | 내용 | 상태 |
|-------|------|------|
| 1 | GolfDB 전처리 + Reference Stats 구축 | 🔄 진행 중 |
| 2 | Module 1 R&D | ⏳ 대기 |
| 3 | Module 2 R&D | ⏳ 대기 |
| 4 | Module 3 R&D | ⏳ 대기 |
| 5 | Backend API 개발 | ⏳ 대기 |
| 6 | Frontend 개발 | ⏳ 대기 |
| 7 | 통합 테스트 & 배포 | ⏳ 대기 |

---

## 12. 대체 기능 후보 (Fallback Plan)

| 원래 기능 | 어려움 상황 | 대체 |
|-----------|------------|------|
| SwingNet 이벤트 탐지 | 정확도 부족 | 손목 궤적 규칙 기반 Fallback |
| P2 지표 | 팀 역량 부족 | P1 7종만 v1 출시 |
| Module 2 로컬 LLM | 서버 성능 | gemma2:2b 경량 모델 |
| Module 3 Unity | 모바일 성능 | react-three-fiber |

---

## 13. 리스크 & 대응 전략

| 리스크 | 대응 |
|--------|------|
| 카메라 각도 불일치 | 촬영 가이드 + 어깨 너비 정규화 |
| 포즈 추출 오류 | visibility 필터링 + 보간 |
| LLM hallucination | 수치 기반 프롬프트 + JSON 검증 |
| SwingNet 오류 | 규칙 기반 Fallback |
| 영상 처리 지연 | Celery 비동기 + 진행 상태 UI |

---

## 14. 부록 A — 용어 정의

| 용어 | 설명 |
|------|------|
| Halpe26 | RTMPose 키포인트 포맷 (26개, 발끝·발뒤꿈치 포함) |
| X_FACTOR | 백스윙 탑에서 어깨-힙 회전각 차이 |
| body-scale 정규화 | 어깨 너비 기준 좌표 정규화 |
| Reference Stats | GolfDB 기반 프로 통계 |
| SwingNet | 8개 스윙 이벤트 탐지 모델 |
| Guidance Hypothesis | 과도한 피드백이 장기 학습을 저해한다는 이론 |

---

## 15. 부록 B — 핵심 참조 논문 & 데이터셋

| # | 저자 (연도) | 활용처 |
|---|------------|--------|
| 1 | McNally et al. (2019) | GolfDB 데이터셋 + SwingNet |
| 2 | Buszard et al. (2024) | Module 2 피드백 설계 |
| 3 | Dong et al. (2025) | Module 2 선행 연구 |
| 4 | Healy et al. (2011) | X_FACTOR, HIP_ROTATION 수치 |
| 5 | Zheng et al. (2008) | HIP_ROTATION, SHOULDER_ROT |

---

> **문서 버전:** v2.2 | **작성:** 컴퓨터공학부 4학년 종합 프로젝트팀