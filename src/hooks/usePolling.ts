import { useEffect, useRef, useState } from 'react';
import { getJobStatus } from '../api/module1';

export type JobStatus = 'queued' | 'processing' | 'done' | 'error' | 'idle';

/**
 * Module 1 분석 작업 상태를 2초 간격으로 폴링한다.
 * - jobId가 null이면 폴링하지 않음
 * - status가 'done' | 'error'가 되면 자동 중단
 */
export function usePolling(jobId: string | null) {
  const [status, setStatus]       = useState<JobStatus>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;

    if (!jobId) {
      setStatus('idle');
      setSessionId(null);
      setError(null);
      return;
    }

    setStatus('queued');
    setSessionId(null);
    setError(null);

    const poll = async () => {
      if (stoppedRef.current) { return; }
      try {
        const data = await getJobStatus(jobId);
        if (stoppedRef.current) { return; }

        setStatus(data.status);

        if (data.status === 'done') {
          setSessionId(data.session_id ?? null);
        } else if (data.status === 'error') {
          setError(data.message ?? '분석 중 오류가 발생했습니다.');
        } else {
          // queued | processing — 2초 후 재시도
          timerRef.current = setTimeout(poll, 2000);
        }
      } catch (e) {
        if (!stoppedRef.current) {
          setError(String(e));
          setStatus('error');
        }
      }
    };

    timerRef.current = setTimeout(poll, 2000);

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) { clearTimeout(timerRef.current); }
    };
  }, [jobId]);

  return { status, sessionId, error };
}
