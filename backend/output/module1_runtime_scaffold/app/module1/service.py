from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
from bson import ObjectId
from fastapi import HTTPException, UploadFile
from pymongo.errors import PyMongoError
from app.db.mongodb import get_db
from app.module1.schemas import AnalysisResultResponse, SessionListResponse
from app.storage.temp_file_store import TempFileStore
from app.workers.analysis_task import run_analysis


class Module1Service:
    def __init__(self):
        self.file_store = TempFileStore()

    async def enqueue_analysis(
        self,
        video: UploadFile,
        viewtype: str,
        clubtype: str,
        trimstart: float,
        trimend: float | None,
        userid: str = 'dev-user',
    ) -> dict[str, str]:
        self._validate_upload(video, trimstart, trimend)
        db = get_db()
        now = datetime.now(timezone.utc)
        saved_path = await self.file_store.save_upload(video)

        session_id = ObjectId()
        job_id = str(uuid4())

        session_doc = {
            '_id': session_id,
            'jobid': job_id,
            'userid': userid,
            'viewtype': viewtype,
            'clubtype': clubtype,
            'status': 'queued',
            'inputfilename': video.filename,
            'storedfilepath': saved_path,
            'trimstart': trimstart,
            'trimend': trimend,
            'durationsec': None,
            'fps': None,
            'analysisresultid': None,
            'createdat': now,
            'updatedat': now,
        }

        try:
            await db.swingsessions.insert_one(session_doc)
        except PyMongoError as e:
            raise HTTPException(status_code=500, detail=f'Failed to create session: {e}')

        run_analysis.delay(str(session_id), saved_path, viewtype, clubtype)
        return {'jobid': job_id, 'status': 'queued'}

    async def get_status(self, job_id: str) -> dict[str, Any]:
        db = get_db()
        session = await db.swingsessions.find_one({'jobid': job_id})
        if not session:
            raise HTTPException(status_code=404, detail='Analysis job not found.')

        response = {
            'status': session['status'],
            'sessionid': str(session['_id']) if session['status'] == 'done' else None,
            'message': session.get('errormessage'),
        }
        if session['status'] == 'error':
            response['sessionid'] = str(session['_id'])
        return response

    async def get_result(self, session_id: str) -> AnalysisResultResponse:
        db = get_db()
        session = await db.swingsessions.find_one({'_id': self._to_object_id(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail='Session not found.')

        result = None
        if session.get('analysisresultid'):
            result = await db.analysisresults.find_one({'_id': session['analysisresultid']})
        elif session['status'] == 'done':
            result = await db.analysisresults.find_one({'sessionid': session['_id']})

        return AnalysisResultResponse(
            sessionid=str(session['_id']),
            status=session['status'],
            viewtype=session['viewtype'],
            clubtype=session['clubtype'],
            inputfilename=session.get('inputfilename'),
            analyzedat=(result or {}).get('createdat'),
            overallscore=(result or {}).get('overallscore'),
            phasescores=(result or {}).get('phasescores', {}),
            metrics=(result or {}).get('metrics', []),
            recommendations=(result or {}).get('recommendations', []),
            message=session.get('errormessage'),
        )

    async def list_sessions(self, userid: str = 'dev-user', page: int = 1, limit: int = 20) -> SessionListResponse:
        db = get_db()
        skip = max(page - 1, 0) * limit
        cursor = db.swingsessions.find({'userid': userid}).sort('createdat', -1).skip(skip).limit(limit)
        sessions = await cursor.to_list(length=limit)
        total = await db.swingsessions.count_documents({'userid': userid})

        items = [
            {
                'sessionid': str(s['_id']),
                'status': s['status'],
                'viewtype': s['viewtype'],
                'clubtype': s['clubtype'],
                'inputfilename': s.get('inputfilename'),
                'analyzedat': s.get('updatedat'),
                'createdat': s['createdat'],
            }
            for s in sessions
        ]
        return SessionListResponse(sessions=items, total=total, page=page, limit=limit)

    def _validate_upload(self, video: UploadFile, trimstart: float, trimend: float | None) -> None:
        filename = video.filename or ''
        suffix = Path(filename).suffix.lower()
        if suffix not in {'.mp4', '.mov', '.avi'}:
            raise HTTPException(status_code=400, detail='Only mp4/mov/avi uploads are allowed.')
        if trimstart < 0:
            raise HTTPException(status_code=400, detail='trimstart must be >= 0.')
        if trimend is not None and trimend <= trimstart:
            raise HTTPException(status_code=400, detail='trimend must be greater than trimstart.')

    def _to_object_id(self, value: str) -> ObjectId:
        if not ObjectId.is_valid(value):
            raise HTTPException(status_code=400, detail='Invalid session id.')
        return ObjectId(value)
