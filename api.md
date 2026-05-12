# Golf Swing Coach — 통합 디렉터리 구조 및 API 명세서

> 기준 문서  
> - 프로젝트 아키텍처: `Golf_Swing_Coach_Architecture_v2.3-1.md`  
> - 프론트 변동사항: `api-spec-1.md`  
>
> 목적  
> - 프론트/백엔드 디렉터리 구조 통합
> - API 엔드포인트 구조 통합
> - Request / Response JSON 구조를 한눈에 보기 쉽게 정리
> - `.env` 구성 항목 정리
>
> 반영 원칙  
> - 디렉터리 구조는 기존 확정안 유지
> - API는 `api-spec-1.md`의 변경사항 우선 반영
> - 아키텍처 문서와 충돌 시, 프론트 연동에 직접 필요한 사항은 `api-spec-1.md` 기준으로 보완

---

# 1. 공통 규칙

## 1.1 Base URL

| 환경 | URL |
|------|-----|
| 로컬(Android Emulator) | `http://10.0.2.2:8000/api` |
| 개발 서버 | `https://dev.{host}/api` |
| 운영 서버 | `https://{host}/api` |

> Android 에뮬레이터에서는 `localhost` 대신 `10.0.2.2` 사용

## 1.2 공통 헤더

### 일반 JSON 요청
```http
Content-Type: application/json
Authorization: Bearer {access_token}
```

### 파일 업로드 요청
```http
Content-Type: multipart/form-data
Authorization: Bearer {access_token}
```

## 1.3 날짜 형식

모든 날짜/시간은 **ISO 8601 UTC** 형식 사용

```txt
2026-05-01T09:00:00Z
```

## 1.4 공통 에러 응답 형식

```json
{
  "code": "UNAUTHORIZED",
  "message": "인증이 필요합니다."
}
```

### 에러 코드 표

| HTTP 상태 | code | 설명 |
|-----------|------|------|
| `400` | `INVALID_REQUEST` | 잘못된 요청 파라미터 |
| `401` | `UNAUTHORIZED` | 인증 토큰 없음 또는 만료 |
| `403` | `FORBIDDEN` | 권한 없음 |
| `404` | `NOT_FOUND` | 리소스 없음 |
| `422` | `VALIDATION_ERROR` | 유효성 검사 실패 |
| `500` | `INTERNAL_ERROR` | 서버 내부 오류 |
| `503` | `ANALYSIS_FAILED` | 스윙 분석 실패 |

---

# 2. 디렉터리 구조

## 2.1 Backend

```txt
backend/
├── .env
├── .env.example
├── requirements.txt
├── Dockerfile
├── main.py
│
├── core/
│   ├── config.py
│   ├── firebase.py
│   ├── security.py
│   └── celery_app.py
│
├── api/
│   ├── __init__.py
│   ├── deps.py
│   │
│   ├── auth/
│   │   ├── router.py
│   │   └── schemas.py
│   │
│   ├── module1/
│   │   ├── router.py
│   │   └── schemas.py
│   │
│   ├── module2/
│   │   ├── router.py
│   │   └── schemas.py
│   │
│   └── module3/
│       ├── router.py
│       └── schemas.py
│
├── services/
│   ├── auth_service.py
│   ├── firestore_service.py
│   ├── storage_service.py
│   │
│   ├── module1/
│   │   ├── analyzer.py
│   │   ├── pose_extractor.py
│   │   ├── event_detector.py
│   │   ├── scorer.py
│   │   └── visualizer.py
│   │
│   ├── module2/
│   │   ├── ollama_client.py
│   │   ├── prompt_builder.py
│   │   ├── priority_selector.py
│   │   └── context_manager.py
│   │
│   └── module3/
│       └── landmark_service.py
│
├── models/
│   ├── user.py
│   ├── session.py
│   ├── pose.py
│   └── chat.py
│
├── workers/
│   └── tasks.py
│
└── tests/
    ├── test_auth.py
    ├── test_module1.py
    ├── test_module2.py
    └── test_module3.py
```

## 2.2 Frontend

```txt
frontend/
├── .env
├── app.json
├── package.json
├── tsconfig.json
│
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   │
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   │
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── home.tsx
│   │   ├── analyze.tsx
│   │   ├── history.tsx
│   │   ├── chat.tsx
│   │   └── viewer.tsx
│   │
│   ├── result/
│   │   └── [session_id].tsx
│   │
│   └── settings.tsx
│
├── src/
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── module1.ts
│   │   ├── module2.ts
│   │   └── module3.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSwingAnalysis.ts
│   │   ├── useChatStream.ts
│   │   └── useLandmarks.ts
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── ScoreCard.tsx
│   │   │   ├── MetricRow.tsx
│   │   │   └── LoadingOverlay.tsx
│   │   │
│   │   ├── module1/
│   │   │   ├── VideoUploader.tsx
│   │   │   ├── PollingIndicator.tsx
│   │   │   ├── SwingFeedback.tsx
│   │   │   └── RecommendationCard.tsx
│   │   │
│   │   ├── module2/
│   │   │   ├── ChatBubble.tsx
│   │   │   ├── StreamingText.tsx
│   │   │   └── ChatInput.tsx
│   │   │
│   │   └── module3/
│   │       ├── SkeletonViewer.tsx
│   │       ├── PhaseTimeline.tsx
│   │       └── ProOverlay.tsx
│   │
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── analysisStore.ts
│   │   └── chatStore.ts
│   │
│   ├── types/
│   │   ├── auth.ts
│   │   ├── module1.ts
│   │   ├── module2.ts
│   │   └── module3.ts
│   │
│   └── utils/
│       ├── polling.ts
│       ├── sseParser.ts
│       └── experienceMapper.ts
│
└── assets/
    └── images/
```

---

# 3. API 한눈에 보기

## 3.1 엔드포인트 요약표

| Domain | Method | Path | 설명 |
|--------|--------|------|------|
| Auth | `POST` | `/auth/login` | 이메일 로그인 |
| Auth | `POST` | `/auth/login/kakao` | 카카오 로그인 |
| Auth | `POST` | `/auth/login/google` | 구글 로그인 |
| Auth | `GET` | `/auth/me` | 현재 사용자 정보 조회 |
| Auth | `GET` | `/auth/verify` | 토큰 검증 |
| Module1 | `POST` | `/module1/analyze` | 영상 업로드 + 분석 요청 |
| Module1 | `GET` | `/module1/status/{job_id}` | 분석 상태 폴링 |
| Module1 | `GET` | `/module1/result/{session_id}` | 분석 결과 조회 |
| Module1 | `GET` | `/module1/sessions` | 분석 세션 목록 |
| Module1 | `GET` | `/module1/sessions/{session_id}` | 분석 세션 단건 |
| Module2 | `POST` | `/module2/chat/stream` | AI 코칭 스트리밍(SSE) |
| Module2 | `GET` | `/module2/history/{session_id}` | 채팅 이력 조회 |
| Module2 | `DELETE` | `/module2/history/{session_id}` | 채팅 초기화 |
| Module3 | `GET` | `/module3/landmarks/{session_id}` | 사용자 랜드마크 조회 |
| Module3 | `GET` | `/module3/pro/{player_id}` | 프로 랜드마크 조회 |

## 3.2 데이터 흐름 요약

### Module 1 분석 흐름
```txt
영상 선택
→ POST /module1/analyze
→ { job_id }
→ GET /module1/status/{job_id} (2초 간격)
→ status: done
→ { session_id }
→ GET /module1/result/{session_id}
→ 결과 화면 표시
```

### Module 2 챗봇 흐름
```txt
메시지 입력
→ POST /module2/chat/stream
→ text/event-stream 수신
→ token 이벤트 누적 렌더링
→ done 이벤트 수신
→ 메시지 저장 완료
```

### Module 3 3D 뷰어 흐름
```txt
결과 화면 또는 비교 화면 진입
→ GET /module3/landmarks/{session_id}
→ 필요 시 GET /module3/pro/{player_id}
→ 3D 뷰어 렌더링
```

---

# 4. Auth API

## 4.1 로그인 / 인증 구조 요약

| 기능 | 엔드포인트 | 인증 필요 |
|------|------------|----------|
| 이메일 로그인 | `POST /auth/login` | 아니오 |
| 카카오 로그인 | `POST /auth/login/kakao` | 아니오 |
| 구글 로그인 | `POST /auth/login/google` | 아니오 |
| 내 정보 조회 | `GET /auth/me` | 예 |
| 토큰 검증 | `GET /auth/verify` | 예 |

## 4.2 공통 User JSON

```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "handicap": 12,
  "experience_level": "beginner",
  "avatar_url": "string | null"
}
```

## 4.3 `POST /auth/login`

### Request
```json
{
  "email": "user@example.com",
  "password": "string"
}
```

### Response `200`
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "handicap": 12,
    "experience_level": "beginner",
    "avatar_url": "string | null"
  }
}
```

## 4.4 `POST /auth/login/kakao`

### Request
```json
{
  "oauth_token": "string"
}
```

### Response `200`
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "handicap": 12,
    "experience_level": "beginner",
    "avatar_url": "string | null"
  }
}
```

## 4.5 `POST /auth/login/google`

### Request
```json
{
  "oauth_token": "string"
}
```

### Response `200`
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": "string",
    "name": "string",
    "email": "string",
    "handicap": 12,
    "experience_level": "beginner",
    "avatar_url": "string | null"
  }
}
```

## 4.6 `GET /auth/me`

### Response `200`
```json
{
  "id": "string",
  "name": "string",
  "email": "string",
  "handicap": 12,
  "experience_level": "beginner",
  "avatar_url": "string | null"
}
```

## 4.7 `GET /auth/verify`

### Response `200`
```json
{
  "valid": true
}
```

### Response `401`
```json
{
  "valid": false
}
```

## 4.8 경험 수준 매핑

| UI 단계 | API 값 |
|---------|--------|
| beginner | `beginner` |
| intermediate | `experienced` |
| advanced | `experienced` |

---

# 5. Module 1 — 스윙 분석 API

## 5.1 구조 요약

| 기능 | 엔드포인트 | 핵심 응답 |
|------|------------|----------|
| 분석 요청 | `POST /module1/analyze` | `job_id`, `status` |
| 상태 조회 | `GET /module1/status/{job_id}` | `status`, `session_id` |
| 결과 조회 | `GET /module1/result/{session_id}` | `AnalysisResult` |
| 세션 목록 | `GET /module1/sessions` | `sessions[]`, `total` |
| 세션 단건 | `GET /module1/sessions/{session_id}` | `AnalysisResult` |

## 5.2 `POST /module1/analyze`

### Form Data
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `video` | File | 예 | 업로드 영상 |
| `view_type` | string | 예 | `dtl` \| `face_on` \| `other` |
| `club_type` | string | 예 | `driver` \| `iron` |
| `trim_start` | float | 아니오 | 기본값 `0` |
| `trim_end` | float | 아니오 | 기본값 영상 전체 |

### Response `202`
```json
{
  "job_id": "job_123456",
  "status": "queued"
}
```

## 5.3 `GET /module1/status/{job_id}`

### Response `200`
```json
{
  "status": "queued"
}
```

```json
{
  "status": "processing"
}
```

```json
{
  "status": "done",
  "session_id": "session_abc123"
}
```

```json
{
  "status": "error",
  "message": "영상 품질이 낮아 분석에 실패했습니다."
}
```

## 5.4 `GET /module1/result/{session_id}`

### Response 구조 요약
```txt
AnalysisResult
├── session_id
├── view_type
├── club_type
├── overall_score
├── analyzed_at
├── phase_scores
├── metrics
└── recommendations
```

### Response `200`
```json
{
  "session_id": "session_abc123",
  "view_type": "dtl",
  "club_type": "driver",
  "overall_score": 62,
  "analyzed_at": "2026-05-01T09:00:00Z",
  "phase_scores": {
    "address": 78,
    "top": 62,
    "impact": 55,
    "finish": 65
  },
  "metrics": {
    "STANCE_RATIO": {
      "user_value": 1.02,
      "pro_mean": 1.05,
      "pro_std": 0.08,
      "ideal_range": [0.97, 1.13],
      "unit": "ratio",
      "score": 93
    },
    "SHOULDER_ROT": {
      "user_value": 95.0,
      "pro_mean": 100.0,
      "pro_std": 7.0,
      "ideal_range": ,
      "unit": "°",
      "score": 86
    },
    "X_FACTOR": {
      "user_value": 38.2,
      "pro_mean": 45.0,
      "pro_std": 5.2,
      "ideal_range": ,
      "unit": "°",
      "score": 74
    },
    "BACKSWING_MAX": {
      "user_value": 88.0,
      "pro_mean": 92.0,
      "pro_std": 7.1,
      "ideal_range": ,
      "unit": "°",
      "score": 89
    },
    "HIP_ROTATION": {
      "user_value": 29.1,
      "pro_mean": 40.0,
      "pro_std": 4.8,
      "ideal_range": ,
      "unit": "°",
      "score": 55
    },
    "WRIST_ANGLE": {
      "user_value": 145.0,
      "pro_mean": 148.0,
      "pro_std": 6.3,
      "ideal_range": ,
      "unit": "°",
      "score": 91
    },
    "SPINE_TILT": {
      "user_value": 33.0,
      "pro_mean": 35.0,
      "pro_std": 5.0,
      "ideal_range": ,
      "unit": "°",
      "score": 92
    }
  },
  "recommendations": [
    {
      "metric_id": "HIP_ROTATION",
      "title": "임팩트 시 힙 회전 부족",
      "body": "임팩트 시 힙 회전각이 프로 평균 대비 10.9° 부족합니다. 힙 회전 드릴을 추천합니다.",
      "drill_title": "Hip Rotation Drill",
      "drill_preview_url": "string | null"
    }
  ]
}
```

## 5.5 `GET /module1/sessions`

### Query Params
| 이름 | 타입 | 기본값 |
|------|------|--------|
| `page` | int | `1` |
| `limit` | int | `20` |

### Response `200`
```json
{
  "sessions": [
    {
      "session_id": "session_abc123",
      "overall_score": 62,
      "view_type": "dtl",
      "club_type": "driver",
      "analyzed_at": "2026-05-01T09:00:00Z",
      "thumbnail_url": "string | null"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

## 5.6 `GET /module1/sessions/{session_id}`

### Response `200`
`GET /module1/result/{session_id}` 와 동일 구조 사용

## 5.7 점수 계산 규칙

```txt
score = max(0, round(100 - |user_value - pro_mean| / pro_std * 20))
```

### 페이즈 가중치
| phase | weight |
|-------|--------|
| address | 15% |
| top | 25% |
| impact | 45% |
| finish | 15% |

---

# 6. Module 2 — AI 코칭 챗봇 API

## 6.1 구조 요약

| 기능 | 엔드포인트 | 핵심 응답 |
|------|------------|----------|
| 스트리밍 채팅 | `POST /module2/chat/stream` | SSE token stream |
| 이력 조회 | `GET /module2/history/{session_id}` | messages[] |
| 대화 초기화 | `DELETE /module2/history/{session_id}` | 204 |

## 6.2 `POST /module2/chat/stream`

### Request
```json
{
  "message": "스윙 힙 회전을 개선하려면 어떻게 해야 하나요?",
  "session_id": "string | null",
  "current_session_id": "string | null",
  "experience_level": "beginner"
}
```

### Request 필드 설명
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `message` | string | 예 | 사용자 질문 |
| `session_id` | string \| null | 예 | 기존 채팅 세션 ID, 신규면 `null` |
| `current_session_id` | string \| null | 아니오 | 연결된 스윙 분석 세션 |
| `experience_level` | string | 예 | `beginner` \| `experienced` |

### Response Headers
```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### SSE 이벤트 예시

#### token 이벤트
```txt
data: {"type":"token","content":"스윙 "}
```

```txt
data: {"type":"token","content":"힙 회전은 "}
```

#### done 이벤트
```txt
data: {"type":"done","chat_session_id":"chat_123","message_id":"msg_456"}
```

#### error 이벤트
```txt
data: {"type":"error","message":"LLM 응답 생성 중 오류가 발생했습니다."}
```

## 6.3 `GET /module2/history/{session_id}`

### Response 구조 요약
```txt
ChatHistoryResponse
├── chat_session_id
├── swing_session_id
├── created_at
└── messages[]
    ├── message_id
    ├── role
    ├── content
    └── created_at
```

### Response `200`
```json
{
  "chat_session_id": "chat_123",
  "swing_session_id": "session_abc123",
  "created_at": "2026-05-01T09:00:00Z",
  "messages": [
    {
      "message_id": "msg_1",
      "role": "user",
      "content": "힙 회전을 어떻게 개선하나요?",
      "created_at": "2026-05-01T09:00:00Z"
    },
    {
      "message_id": "msg_2",
      "role": "assistant",
      "content": "현재 임팩트 시 힙 회전이 부족합니다.",
      "created_at": "2026-05-01T09:00:03Z"
    }
  ]
}
```

## 6.4 `DELETE /module2/history/{session_id}`

### Response `204`
본문 없음

---

# 7. Module 3 — 3D 랜드마크 API

## 7.1 구조 요약

| 기능 | 엔드포인트 | 핵심 응답 |
|------|------------|----------|
| 사용자 랜드마크 조회 | `GET /module3/landmarks/{session_id}` | `frames[]` |
| 프로 랜드마크 조회 | `GET /module3/pro/{player_id}` | `frames[]` |

## 7.2 `GET /module3/landmarks/{session_id}`

### Response 구조 요약
```txt
LandmarkResponse
├── session_id
├── fps
├── total_frames
└── frames[]
    ├── frame_index
    ├── timestamp_ms
    ├── phase
    └── landmarks
        ├── nose
        ├── left_shoulder
        ├── right_shoulder
        └── ...
```

### Response `200`
```json
{
  "session_id": "session_abc123",
  "fps": 30,
  "total_frames": 90,
  "frames": [
    {
      "frame_index": 0,
      "timestamp_ms": 0,
      "phase": "address",
      "landmarks": {
        "nose": { "x": 0.51, "y": 0.22, "z": 0.01, "visibility": 0.99 },
        "left_shoulder": { "x": 0.44, "y": 0.33, "z": -0.05, "visibility": 0.98 },
        "right_shoulder": { "x": 0.58, "y": 0.33, "z": 0.05, "visibility": 0.97 },
        "left_elbow": { "x": 0.40, "y": 0.47, "z": -0.08, "visibility": 0.96 },
        "right_elbow": { "x": 0.62, "y": 0.47, "z": 0.08, "visibility": 0.95 },
        "left_wrist": { "x": 0.37, "y": 0.60, "z": -0.10, "visibility": 0.94 },
        "right_wrist": { "x": 0.65, "y": 0.60, "z": 0.10, "visibility": 0.93 },
        "left_hip": { "x": 0.46, "y": 0.60, "z": -0.04, "visibility": 0.99 },
        "right_hip": { "x": 0.56, "y": 0.60, "z": 0.04, "visibility": 0.99 },
        "left_knee": { "x": 0.45, "y": 0.76, "z": -0.03, "visibility": 0.98 },
        "right_knee": { "x": 0.57, "y": 0.76, "z": 0.03, "visibility": 0.97 },
        "left_ankle": { "x": 0.44, "y": 0.92, "z": -0.02, "visibility": 0.96 },
        "right_ankle": { "x": 0.58, "y": 0.92, "z": 0.02, "visibility": 0.95 }
      }
    }
  ]
}
```

## 7.3 `GET /module3/pro/{player_id}`

### Response `200`
`GET /module3/landmarks/{session_id}` 와 동일 구조 사용

## 7.4 좌표 규칙

| 필드 | 의미 |
|------|------|
| `x` | 정규화된 가로 좌표 (`0.0 ~ 1.0`) |
| `y` | 정규화된 세로 좌표 (`0.0 ~ 1.0`) |
| `z` | 상대 깊이 값 |
| `visibility` | 관절 신뢰도 (`0.0 ~ 1.0`) |

---

# 8. JSON 구조 모음

## 8.1 Auth 응답 구조

```txt
AuthResponse
├── access_token
├── token_type
└── user
    ├── id
    ├── name
    ├── email
    ├── handicap
    ├── experience_level
    └── avatar_url
```

## 8.2 분석 상태 구조

```txt
AnalysisStatus
├── status
├── session_id?   # done일 때만
└── message?      # error일 때만
```

## 8.3 분석 결과 구조

```txt
AnalysisResult
├── session_id
├── view_type
├── club_type
├── overall_score
├── analyzed_at
├── phase_scores
│   ├── address
│   ├── top
│   ├── impact
│   └── finish
├── metrics
│   ├── STANCE_RATIO
│   ├── SHOULDER_ROT
│   ├── X_FACTOR
│   ├── BACKSWING_MAX
│   ├── HIP_ROTATION
│   ├── WRIST_ANGLE
│   └── SPINE_TILT
└── recommendations[]
```

## 8.4 채팅 이력 구조

```txt
ChatHistoryResponse
├── chat_session_id
├── swing_session_id
├── created_at
└── messages[]
    ├── message_id
    ├── role
    ├── content
    └── created_at
```

## 8.5 랜드마크 구조

```txt
LandmarkResponse
├── session_id
├── fps
├── total_frames
└── frames[]
    ├── frame_index
    ├── timestamp_ms
    ├── phase
    └── landmarks
        └── joint_name
            ├── x
            ├── y
            ├── z
            └── visibility
```

---

# 9. Firestore / 저장 구조 요약

```txt
Firestore
├── users/{uid}
│   ├── profile
│   └── sessions/{session_id}
│       ├── status
│       ├── view_type
│       ├── club_type
│       ├── analysis_result
│       ├── pose_frames/{frame_idx}
│       └── highlighted_issues
│
├── chat_sessions/{chat_session_id}
│   ├── uid
│   ├── current_session_id
│   ├── session_summary
│   ├── summary_updated_at
│   ├── messages/{msg_id}
│   └── context_links/{link_id}
│
├── reference_stats/{version}
│   └── metrics_by_phase
│
└── pro_swings/{player_id}
    └── landmarks_3d_path
```

---

# 10. .env 구성

## 10.1 Backend `.env.example`

```env
# =========================
# App
# =========================
APP_NAME=Golf Swing Coach API
APP_ENV=local
APP_DEBUG=true
APP_HOST=0.0.0.0
APP_PORT=8000
API_PREFIX=/api
SECRET_KEY=change-this-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# =========================
# CORS
# =========================
CORS_ALLOW_ORIGINS=http://localhost:3000,http://10.0.2.2:19006,http://127.0.0.1:19006
CORS_ALLOW_CREDENTIALS=true

# =========================
# Firebase
# =========================
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CREDENTIALS_PATH=./firebase-adminsdk.json
FIREBASE_STORAGE_BUCKET=your-project.appspot.com

# =========================
# Redis / Celery
# =========================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# =========================
# Ollama / LLM
# =========================
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
OLLAMA_FALLBACK_MODEL=gemma2:2b
OLLAMA_TIMEOUT_SECONDS=120

# =========================
# Model Paths
# =========================
SWINGNET_MODEL_PATH=./models/swingnet_1800.pth.tar
RCNN_MODEL_PATH=./models/keypointrcnn_resnet50_fpn.pth
REFERENCE_STATS_PATH=./data/reference_stats_v1.json

# =========================
# File Upload
# =========================
MAX_UPLOAD_MB=200
TEMP_UPLOAD_DIR=./tmp/uploads
RESULT_IMAGE_DIR=./tmp/results

# =========================
# Analysis Config
# =========================
DEFAULT_POLLING_INTERVAL_SEC=2
MAX_VIDEO_DURATION_SEC=180
POSE_VISIBILITY_THRESHOLD=0.5
SESSION_COMPARE_LIMIT=3
CHAT_RECENT_MESSAGES_LIMIT=10
CHAT_SUMMARY_TRIGGER_COUNT=20

# =========================
# Optional Social Auth
# =========================
KAKAO_REST_API_KEY=your-kakao-rest-key
GOOGLE_CLIENT_ID=your-google-client-id

# =========================
# Logging
# =========================
LOG_LEVEL=INFO
```

## 10.2 Frontend `.env.example`

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/api
EXPO_PUBLIC_API_TIMEOUT_MS=30000

EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id

EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=your-kakao-native-app-key
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
```

## 10.3 환경 변수 설명 표

| 변수명 | 용도 |
|--------|------|
| `API_PREFIX` | FastAPI 공통 prefix (`/api`) |
| `SECRET_KEY` | JWT 또는 서버 내부 서명용 키 |
| `FIREBASE_CREDENTIALS_PATH` | Firebase Admin SDK 인증 파일 경로 |
| `FIREBASE_STORAGE_BUCKET` | 영상/결과 파일 저장 버킷 |
| `CELERY_BROKER_URL` | 비동기 작업 큐 브로커 |
| `CELERY_RESULT_BACKEND` | Celery 결과 저장소 |
| `OLLAMA_BASE_URL` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | 기본 LLM 모델 |
| `OLLAMA_FALLBACK_MODEL` | 대체 경량 모델 |
| `SWINGNET_MODEL_PATH` | SwingNet 모델 파일 경로 |
| `RCNN_MODEL_PATH` | R-CNN 보정 모델 파일 경로 |
| `REFERENCE_STATS_PATH` | 프로 기준값 JSON 파일 경로 |
| `MAX_UPLOAD_MB` | 업로드 최대 용량 제한 |
| `POSE_VISIBILITY_THRESHOLD` | 보정 필요 landmark 판단 기준 |
| `CHAT_RECENT_MESSAGES_LIMIT` | 최근 메시지 슬라이딩 윈도우 개수 |
| `CHAT_SUMMARY_TRIGGER_COUNT` | 세션 요약 갱신 임계치 |
| `EXPO_PUBLIC_API_BASE_URL` | 프론트 API 기본 주소 |

---

# 11. 구현 메모

## 11.1 아키텍처 문서 대비 반영된 변경점

- 인증 라우트는 `POST /auth/verify`가 아니라 프론트 명세 기준 `GET /auth/verify` 사용
- Auth는 Firebase 기반 검증 구조를 유지하되, 프론트 연동을 위해 이메일/소셜 로그인 엔드포인트를 명시적으로 추가
- `POST /module1/analyze` 에 `club_type`, `trim_start`, `trim_end` 필드 추가
- Module 2는 동기 `/module2/chat` 보다 스트리밍 `/module2/chat/stream` 중심으로 사용
- Module 3 랜드마크는 숫자 인덱스 배열보다 프론트 사용성이 높은 `joint_name` 기반 JSON으로 통일
- 세션 목록 API는 `page`, `limit`, `total` 포함 페이지네이션 구조 사용

## 11.2 프론트 구현 포인트

- React Native에서는 SSE를 `EventSource` 대신 `fetch + ReadableStream` 으로 처리
- 분석 상태 폴링은 2초 간격 기본값 유지
- 경험 수준은 UI 3단계지만 API 전송값은 2단계로 매핑
- Module 3는 `phase`와 `timestamp_ms` 기반으로 타임라인 UI를 구성