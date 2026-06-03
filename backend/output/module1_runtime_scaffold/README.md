# Module1 Runtime Scaffold

포함 파일:
- app/module1/router.py
- app/module1/schemas.py
- app/module1/service.py
- app/storage/temp_file_store.py
- app/workers/analysis_task.py

적용 순서:
1. 기존 backend/app 경로에 파일 복사
2. main.py에서 module1 router include 확인
3. celery worker 설정 후 run_analysis task 실행
4. analyzer.py 내부 구현을 실제 추출 코드로 교체
