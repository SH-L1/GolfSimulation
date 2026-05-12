# Handy — 백엔드 API 명세서

> **작성일:** 2026-05-01  
> **작성자:** 프론트엔드팀  
> **대상:** 백엔드 개발팀  
> **버전:** v0.1 (초안)

---

## 목차

1. [공통 사항](#1-공통-사항)
2. [인증 (Auth)](#2-인증-auth)
3. [Module 1 — 스윙 분석](#3-module-1--스윙-분석)
4. [Module 2 — AI 코칭 챗봇](#4-module-2--ai-코칭-챗봇)
5. [Module 3 — 3D 랜드마크](#5-module-3--3d-랜드마크)
6. [공통 에러 형식](#6-공통-에러-형식)
7. [확인 필요 사항](#7-확인-필요-사항)

---

## 1. 공통 사항

### Base URL

| 환경 | URL |
|------|-----|
| 로컬 (Android 에뮬레이터) | `http://10.0.2.2:8000/api` |
| 개발 서버 | 미정 |
| 운영 서버 | 미정 |

> Android 에뮬레이터에서 `localhost` = `10.0.2.2`

### 공통 Request Headers

```
Content-Type: application/json
Authorization: Bearer {access_token}   // 인증 필요 엔드포인트
```

### 날짜 형식

모든 날짜/시간은 **ISO 8601 UTC** 형식 사용: `2026-05-01T09:00:00Z`

---

## 2. 인증 (Auth)

### 2-1. 이메일 로그인

```
POST /auth/login
```

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "string"
}
```

**Response `200`**
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

---

### 2-2. 소셜 로그인

```
POST /auth/login/kakao
POST /auth/login/google
```

**Request Body**
```json
{
  "oauth_token": "string"   // 클라이언트에서 OAuth 후 받은 토큰
}
```

**Response**: `2-1`과 동일

---

### 2-3. 현재 유저 정보 조회

```
GET /auth/me
Authorization: Bearer {access_token}
```

**Response `200`**
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

---

### 2-4. 토큰 검증

```
GET /auth/verify
Authorization: Bearer {access_token}
```

**Response `200`**
```json
{ "valid": true }
```

**Response `401`**
```json
{ "valid": false }
```

---

### 경험 수준 (Experience Level) 매핑

프론트 UI는 3단계, API는 2단계로 전달합니다.

| UI 표시 | API 전달값 |
|---------|-----------|
| 입문자 (beginner) | `"beginner"` |
| 중급자 (intermediate) | `"experienced"` |
| 고급자 (advanced) | `"experienced"` |

---

## 3. Module 1 — 스윙 분석

### 플로우 요약

```
[프론트] 영상 선택
    ↓
POST /module1/analyze  →  { job_id }
    ↓
GET /module1/status/{job_id}  (2초 간격 폴링)
    ↓  status: "done"
    → { session_id }
    ↓
GET /module1/result/{session_id}
    ↓
[프론트] SwingFeedback 화면 표시
```

---

### 3-1. 스윙 분석 요청

```
POST /module1/analyze
Content-Type: multipart/form-data
Authorization: Bearer {access_token}
```

**Form Fields**

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `video` | File | ✅ | 영상 파일 (mp4, mov 등) |
| `view_type` | string | ✅ | `"dtl"` \| `"face_on"` \| `"other"` |
| `club_type` | string | ✅ | `"driver"` \| `"iron"` |
| `trim_start` | float | ❌ | 트림 시작 시간 (초), 기본값 0 |
| `trim_end` | float | ❌ | 트림 종료 시간 (초), 기본값 영상 전체 길이 |

> `view_type` 설명  
> - `dtl` — Down The Line (측면)  
> - `face_on` — 정면  
> - `other` — 기타

**Response `202`**
```json
{
  "job_id": "string",
  "status": "queued"
}
```

---

### 3-2. 분석 상태 폴링

```
GET /module1/status/{job_id}
Authorization: Bearer {access_token}
```

**Response `200`**
```json
{
  "status": "queued" | "processing" | "done" | "error",
  "session_id": "string",   // status가 "done"일 때만 포함
  "message": "string"       // status가 "error"일 때 에러 메시지
}
```

> 프론트는 **2초 간격**으로 폴링합니다. `status`가 `"done"` 또는 `"error"`가 되면 폴링을 중단합니다.

---

### 3-3. 분석 결과 조회

```
GET /module1/result/{session_id}
Authorization: Bearer {access_token}
```

**Response `200`**
```json
{
  "session_id": "string",
  "view_type": "dtl" | "face_on" | "other",
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
      "ideal_range": [93, 107],
      "unit": "°",
      "score": 86
    },
    "X_FACTOR": {
      "user_value": 38.2,
      "pro_mean": 45.0,
      "pro_std": 5.2,
      "ideal_range": [41, 49],
      "unit": "°",
      "score": 74
    },
    "BACKSWING_MAX": {
      "user_value": 88.0,
      "pro_mean": 92.0,
      "pro_std": 7.1,
      "ideal_range": [86, 98],
      "unit": "°",
      "score": 89
    },
    "HIP_ROTATION": {
      "user_value": 29.1,
      "pro_mean": 40.0,
      "pro_std": 4.8,
      "ideal_range": [36, 44],
      "unit": "°",
      "score": 55
    },
    "WRIST_ANGLE": {
      "user_value": 145.0,
      "pro_mean": 148.0,
      "pro_std": 6.3,
      "ideal_range": [143, 153],
      "unit": "°",
      "score": 91
    },
    "SPINE_TILT": {
      "user_value": 33.0,
      "pro_mean": 35.0,
      "pro_std": 5.0,
      "ideal_range": [30, 40],
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

#### 점수 산정 공식 (프론트 참고용)

```
score = max(0, round(100 - |user_value - pro_mean| / pro_std * 20))
```

#### 페이즈 가중치

| 페이즈 | 가중치 |
|--------|--------|
| address | 15% |
| top | 25% |
| impact | 45% |
| finish | 15% |

---

### 3-4. 세션 목록 조회

```
GET /module1/sessions
Authorization: Bearer {access_token}
```

**Query Parameters**

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| `page` | int | 1 | 페이지 번호 |
| `limit` | int | 20 | 페이지당 항목 수 |

**Response `200`**
```json
{
  "sessions": [
    {
      "session_id": "string",
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

---

### 3-5. 세션 단건 조회

```
GET /module1/sessions/{session_id}
Authorization: Bearer {access_token}
```

**Response**: `3-3`과 동일

---

## 4. Module 2 — AI 코칭 챗봇

### 플로우 요약

```
[프론트] 유저 메시지 입력
    ↓
POST /module2/chat/stream  (SSE)
    ↓  text/event-stream
각 토큰 수신 → 화면에 실시간 렌더링
    ↓  [DONE] 이벤트
스트리밍 종료
```

---

### 4-1. AI 채팅 스트리밍 (SSE)

```
POST /module2/chat/stream
Content-Type: application/json
Authorization: Bearer {access_token}
```

**Request Body**
```json
{
  "message": "스윙 힙 회전을 개선하려면 어떻게 해야 하나요?",
  "session_id": "string",           // 현재 챗 세션 ID (신규 시 null)
  "current_session_id": "string",   // 연결된 스윙 분석 세션 ID (선택)
  "experience_level": "beginner" | "experienced"
}
```

**Response Headers**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**SSE 이벤트 형식**

```
// 토큰 단위 스트리밍
data: {"type": "token", "content": "스윙"}

data: {"type": "token", "content": " 힙"}

data: {"type": "token", "content": " 회전을"}

// 스트리밍 완료
data: {"type": "done", "chat_session_id": "string", "message_id": "string"}

// 에러
data: {"type": "error", "message": "string"}
```

> **중요**: 프론트는 `fetch` + `ReadableStream` 방식으로 SSE를 구현합니다 (React Native는 `EventSource` 미지원). `\n\n`으로 이벤트를 구분해 주세요.

---

### 4-2. 채팅 이력 조회

```
GET /module2/history/{session_id}
Authorization: Bearer {access_token}
```

**Response `200`**
```json
{
  "chat_session_id": "string",
  "swing_session_id": "string | null",
  "created_at": "2026-05-01T09:00:00Z",
  "messages": [
    {
      "message_id": "string",
      "role": "user" | "assistant",
      "content": "string",
      "created_at": "2026-05-01T09:00:00Z"
    }
  ]
}
```

---

## 5. Module 3 — 3D 랜드마크

### 5-1. 스윙 랜드마크 조회

```
GET /module3/landmarks/{session_id}
Authorization: Bearer {access_token}
```

**Response `200`**
```json
{
  "session_id": "string",
  "fps": 30,
  "total_frames": 90,
  "frames": [
    {
      "frame_index": 0,
      "timestamp_ms": 0,
      "phase": "address" | "backswing" | "top" | "downswing" | "impact" | "finish",
      "landmarks": {
        "nose":            { "x": 0.51, "y": 0.22, "z": 0.01, "visibility": 0.99 },
        "left_shoulder":   { "x": 0.44, "y": 0.33, "z": -0.05, "visibility": 0.98 },
        "right_shoulder":  { "x": 0.58, "y": 0.33, "z": 0.05, "visibility": 0.97 },
        "left_elbow":      { "x": 0.40, "y": 0.47, "z": -0.08, "visibility": 0.96 },
        "right_elbow":     { "x": 0.62, "y": 0.47, "z": 0.08, "visibility": 0.95 },
        "left_wrist":      { "x": 0.37, "y": 0.60, "z": -0.10, "visibility": 0.94 },
        "right_wrist":     { "x": 0.65, "y": 0.60, "z": 0.10, "visibility": 0.93 },
        "left_hip":        { "x": 0.46, "y": 0.60, "z": -0.04, "visibility": 0.99 },
        "right_hip":       { "x": 0.56, "y": 0.60, "z": 0.04, "visibility": 0.99 },
        "left_knee":       { "x": 0.45, "y": 0.76, "z": -0.03, "visibility": 0.98 },
        "right_knee":      { "x": 0.57, "y": 0.76, "z": 0.03, "visibility": 0.97 },
        "left_ankle":      { "x": 0.44, "y": 0.92, "z": -0.02, "visibility": 0.96 },
        "right_ankle":     { "x": 0.58, "y": 0.92, "z": 0.02, "visibility": 0.95 }
      }
    }
  ]
}
```

> 좌표 범위: `x`, `y`는 `[0.0, 1.0]` (정규화), `z`는 상대 깊이 (단위 없음)  
> `visibility`는 `[0.0, 1.0]` — 0.5 미만은 신뢰도 낮음

---

### 5-2. 프로 선수 레퍼런스 조회

```
GET /module3/pro/{player_id}
Authorization: Bearer {access_token}
```

**Response**: `5-1`과 동일한 구조

> 현재 프론트에서 사용하는 `player_id` 후보: 추후 협의

---

## 6. 공통 에러 형식

모든 에러 응답은 아래 형식을 따릅니다.

```json
{
  "code": "UNAUTHORIZED",
  "message": "인증이 필요합니다."
}
```

| HTTP 상태 | code 예시 | 설명 |
|-----------|-----------|------|
| `400` | `INVALID_REQUEST` | 잘못된 요청 파라미터 |
| `401` | `UNAUTHORIZED` | 인증 토큰 없음 또는 만료 |
| `403` | `FORBIDDEN` | 권한 없음 |
| `404` | `NOT_FOUND` | 리소스 없음 |
| `422` | `VALIDATION_ERROR` | 유효성 검사 실패 |
| `500` | `INTERNAL_ERROR` | 서버 내부 오류 |
| `503` | `ANALYSIS_FAILED` | 스윙 분석 실패 (영상 품질 등) |

---

## 7. 확인 필요 사항

백엔드팀과 협의가 필요한 항목입니다.

| # | 항목 | 현재 가정 | 확인 필요 내용 |
|---|------|-----------|---------------|
| 1 | 인증 방식 | JWT Bearer | 토큰 만료 시간, Refresh Token 여부 |
| 2 | 소셜 로그인 | 카카오, 구글 | 각 OAuth App Key 공유 필요 |
| 3 | 파일 업로드 크기 제한 | 미정 | 최대 업로드 용량 (MB) |
| 4 | SSE 이벤트 구분자 | `\n\n` | 실제 구분 방식 확인 |
| 5 | SSE `session_id` 신규 생성 | `null` 전달 시 서버가 생성 | 신규 세션 처리 방식 |
| 6 | 랜드마크 좌표 기준 | 정규화 [0,1] | 원본 픽셀 vs 정규화 확인 |
| 7 | 페이즈 분류 기준 | 6단계 | address/backswing/top/downswing/impact/finish |
| 8 | 분석 예상 소요 시간 | 미정 | 폴링 간격 (2초) 적합성 확인 |
| 9 | CORS | 개발 중 전체 허용 요청 | `http://10.0.2.2:*` 허용 필요 |
| 10 | 프로 선수 ID 목록 | 미정 | `GET /module3/pro/{player_id}` 에 쓸 ID 목록 |
