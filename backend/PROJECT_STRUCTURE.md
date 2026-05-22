# Project Structure

Generated at: 2026-05-21T10:36:57.847151

## Overview

- Root path: `D:\jongP\GolfSimulation\backend`
- Total directories: 29
- Total files: 94
- Detected stack: Python backend, Docker, Markdown documentation

## Root Items

- `app` (DIR)
- `extrenal` (DIR)
- `models` (DIR)
- `output` (DIR)
- `tests` (DIR)
- `.env` (FILE)
- `.env.example` (FILE)
- `Dockerfile` (FILE)
- `makedir.py` (FILE)
- `mkfile.py` (FILE)
- `README.md` (FILE)
- `requirements.txt` (FILE)

## Backend Summary

- `backend/` 없음

## Frontend Summary

- `frontend/` 없음

## Extension Stats

| Extension | Count |
|---|---|
| `.py` | 85 |
| `.md` | 2 |
| `[no extension hidden]` | 1 |
| `.example` | 1 |
| `[no extension]` | 1 |
| `.txt` | 1 |
| `.bin` | 1 |
| `.task` | 1 |
| `.pth` | 1 |

## Important Files

- `.env`
- `.env.example`
- `app/__init__.py`
- `app/api/__init__.py`
- `app/api/auth.py`
- `app/api/deps.py`
- `app/api/module1.py`
- `app/api/module2.py`
- `app/api/module3.py`
- `app/auth/__init__.py`
- `app/auth/router.py`
- `app/auth/schemas.py`
- `app/auth/service.py`
- `app/core/__init__.py`
- `app/core/celery_app.py`
- `app/core/config.py`
- `app/core/firebase.py`
- `app/core/security.py`
- `app/db/__init__.py`
- `app/db/mongodb.py`
- `app/main.py`
- `app/models/__init__.py`
- `app/models/analysis.py`
- `app/models/chat.py`
- `app/models/common.py`
- `app/models/pose.py`
- `app/models/session.py`
- `app/models/user.py`
- `app/module1/__init__.py`
- `app/module1/analyzer.py`
- `app/module1/eventdetector.py`
- `app/module1/poseextractor.py`
- `app/module1/referenceloader.py`
- `app/module1/router.py`
- `app/module1/runner.py`
- `app/module1/schemas.py`
- `app/module1/scorer.py`
- `app/module1/service.py`
- `app/module1/step1.py`
- `app/module1/step2.py`
- `app/module1/step3.py`
- `app/module1/step4.py`
- `app/module1/step5.py`
- `app/module1/step6.py`
- `app/module1/step7.py`
- `app/module1/visualizer.py`
- `app/module2/__init__.py`
- `app/module2/router.py`
- `app/module2/schemas.py`
- `app/module2/service.py`
- `app/module3/__init__.py`
- `app/module3/router.py`
- `app/module3/schemas.py`
- `app/module3/service.py`
- `app/repositories/__init__.py`
- `app/repositories/analysis_repository.py`
- `app/repositories/chat_repository.py`
- `app/repositories/pose_repository.py`
- `app/repositories/reference_repository.py`
- `app/repositories/session_repository.py`
- `app/repositories/user_repository.py`
- `app/services/__init__.py`
- `app/services/analysis_service.py`
- `app/services/auth_service.py`
- `app/services/landmark_service.py`
- `app/services/module2/context_manager.py`
- `app/services/module2/ollama_client.py`
- `app/services/module2/priority_selector.py`
- `app/services/module2/prompt_builder.py`
- `app/services/upload_service.py`
- `app/storage/__init__.py`
- `app/storage/temp_file_store.py`
- `app/workers/__init__.py`
- `app/workers/analysis_task.py`
- `Dockerfile`
- `makedir.py`
- `mkfile.py`
- `models/model.py`
- `output/module1_runtime_scaffold/app/module1/router.py`
- `output/module1_runtime_scaffold/app/module1/schemas.py`
- `output/module1_runtime_scaffold/app/module1/service.py`
- `output/module1_runtime_scaffold/app/storage/temp_file_store.py`
- `output/module1_runtime_scaffold/app/workers/analysis_task.py`
- `output/module1_runtime_scaffold/README.md`
- `README.md`
- `requirements.txt`
- `tests/__init__.py`
- `tests/test_auth.py`
- `tests/test_module1.py`
- `tests/test_module2.py`
- `tests/test_module3.py`

## Full Tree

```text
backend/
├── app
│   ├── api
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── deps.py
│   │   ├── module1.py
│   │   ├── module2.py
│   │   └── module3.py
│   ├── auth
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── core
│   │   ├── __init__.py
│   │   ├── celery_app.py
│   │   ├── config.py
│   │   ├── firebase.py
│   │   └── security.py
│   ├── db
│   │   ├── __init__.py
│   │   └── mongodb.py
│   ├── models
│   │   ├── __init__.py
│   │   ├── analysis.py
│   │   ├── chat.py
│   │   ├── common.py
│   │   ├── pose.py
│   │   ├── session.py
│   │   └── user.py
│   ├── module1
│   │   ├── __init__.py
│   │   ├── analyzer.py
│   │   ├── eventdetector.py
│   │   ├── poseextractor.py
│   │   ├── referenceloader.py
│   │   ├── router.py
│   │   ├── runner.py
│   │   ├── schemas.py
│   │   ├── scorer.py
│   │   ├── service.py
│   │   ├── step1.py
│   │   ├── step2.py
│   │   ├── step3.py
│   │   ├── step4.py
│   │   ├── step5.py
│   │   ├── step6.py
│   │   ├── step7.py
│   │   └── visualizer.py
│   ├── module2
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── module3
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── repositories
│   │   ├── __init__.py
│   │   ├── analysis_repository.py
│   │   ├── chat_repository.py
│   │   ├── pose_repository.py
│   │   ├── reference_repository.py
│   │   ├── session_repository.py
│   │   └── user_repository.py
│   ├── services
│   │   ├── module2
│   │   │   ├── context_manager.py
│   │   │   ├── ollama_client.py
│   │   │   ├── priority_selector.py
│   │   │   └── prompt_builder.py
│   │   ├── __init__.py
│   │   ├── analysis_service.py
│   │   ├── auth_service.py
│   │   ├── landmark_service.py
│   │   └── upload_service.py
│   ├── storage
│   │   ├── __init__.py
│   │   └── temp_file_store.py
│   ├── workers
│   │   ├── __init__.py
│   │   └── analysis_task.py
│   ├── __init__.py
│   └── main.py
├── extrenal
│   ├── golfdb
│   └── MotionBERT
├── models
│   ├── model.py
│   ├── MotionBERT-Base.bin
│   ├── pose_landmarker_heavy.task
│   └── swingnet_1800.pth
├── output
│   └── module1_runtime_scaffold
│       ├── app
│       │   ├── module1
│       │   │   ├── router.py
│       │   │   ├── schemas.py
│       │   │   └── service.py
│       │   ├── storage
│       │   │   └── temp_file_store.py
│       │   └── workers
│       │       └── analysis_task.py
│       └── README.md
├── tests
│   ├── __init__.py
│   ├── test_auth.py
│   ├── test_module1.py
│   ├── test_module2.py
│   └── test_module3.py
├── .env
├── .env.example
├── Dockerfile
├── makedir.py
├── mkfile.py
├── README.md
└── requirements.txt
```
