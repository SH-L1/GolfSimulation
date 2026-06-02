import { http, HttpResponse } from 'msw';
import { API_BASE } from '../../api/client';
import {
  MOCK_ANALYZE_JOB,
  MOCK_ANALYSIS_RESULT,
  MOCK_SESSIONS,
  MOCK_SESSION_ID,
} from '../data/module1';

// 폴링 시뮬레이션: jobId별 호출 횟수를 추적해 3번째부터 done 반환
const pollCountMap = new Map<string, number>();

export const module1Handlers = [
  // 분석 요청
  http.post(`${API_BASE}/module1/analyze`, () => {
    pollCountMap.set(MOCK_ANALYZE_JOB.jobid, 0);
    return HttpResponse.json(MOCK_ANALYZE_JOB);
  }),

  // 상태 폴링 — 처음 2회: processing, 3번째~: done
  http.get(`${API_BASE}/module1/status/:jobId`, ({ params }) => {
    const jobId = params.jobId as string;
    const count = (pollCountMap.get(jobId) ?? 0) + 1;
    pollCountMap.set(jobId, count);

    if (count < 3) {
      return HttpResponse.json({ status: 'processing' });
    }
    pollCountMap.delete(jobId);
    return HttpResponse.json({ status: 'done', sessionid: MOCK_SESSION_ID });
  }),

  // 분석 결과 조회
  http.get(`${API_BASE}/module1/result/:sessionId`, () =>
    HttpResponse.json(MOCK_ANALYSIS_RESULT),
  ),

  // 세션 목록
  http.get(`${API_BASE}/module1/sessions`, () =>
    HttpResponse.json({
      sessions: MOCK_SESSIONS,
      total:    MOCK_SESSIONS.length,
      page:     1,
      limit:    20,
    }),
  ),

  // 단일 세션 조회
  http.get(`${API_BASE}/module1/sessions/:sessionId`, () =>
    HttpResponse.json(MOCK_ANALYSIS_RESULT),
  ),
];
