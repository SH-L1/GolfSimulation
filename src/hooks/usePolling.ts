import { useEffect, useRef, useState } from 'react';
import { API_BASE, ENDPOINTS, JobStatusResponse } from '../api/client';

export type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'idle';

/**
 * Module 1 분석 작업 상태를 2초 간격으로 폴링한다.
 * - jobId가 null이면 폴링하지 않음
 * - status가 'done' | 'error'가 되면 자동 중단
 * TODO: 백엔드 완성 후 fetch 주석 해제, mock 블록 제거
 */
export function usePolling(jobId: string | null) {
  const [status, setStatus]       = useState<JobStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setStatus('idle');
      return;
    }

    setStatus('queued');

    const poll = async () => {
      try {
        // TODO: 실제 API 호출로 교체
        // const res = await fetch(`${API_BASE}${ENDPOINTS.module1.status(jobId)}`);
        // const data: JobStatusResponse = await res.json();
        void API_BASE;

        // ── 목업 폴링 (2단계: queued → processing → done) ──────────
        setStatus(prev => {
          if (prev === 'queued')      return 'processing';
          if (prev === 'processing')  return 'done';
          return prev;
        });
        // ────────────────────────────────────────────────────────────
      } catch (e) {
        setError(String(e));
        setStatus('error');
      }
    };

    const schedule = () => {
      timerRef.current = setTimeout(async () => {
        await poll();
        setStatus(cur => {
          if (cur !== 'done' && cur !== 'error') schedule();
          else if (cur === 'done') setSessionId(`session-${jobId}`);
          return cur;
        });
      }, 2000);
    };

    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [jobId]);

  return { status, sessionId, error };
}
