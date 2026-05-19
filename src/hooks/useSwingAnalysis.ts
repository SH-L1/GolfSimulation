import { useState } from 'react';
import { getAnalysisResult, analyzeSwing } from '../api/module1';

// Re-export types so screens can import from here (기존 import 경로 유지)
export type {
  ViewType,
  ClubType,
  SwingPhase,
  MetricId,
  MetricValue,
  Recommendation,
  AnalysisResult,
  SessionSummary,
  SessionListResponse,
} from '../api/module1';

/**
 * 단일 분석 결과를 sessionId로 조회하는 훅.
 * SwingFeedback 화면에서 navigation params의 sessionId로 호출한다.
 */
export function useAnalysisResult() {
  const [result, setResult]   = useState<Awaited<ReturnType<typeof getAnalysisResult>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const fetch = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnalysisResult(id);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // sessionId가 바뀌면 자동 fetch
  // (화면에서 useEffect로 직접 호출해도 되고, fetch()를 수동으로 호출해도 됨)
  return { result, loading, error, fetch };
}

/**
 * 영상 업로드 → job_id 반환만 담당.
 * 폴링은 usePolling 훅이 담당한다.
 */
export function useSwingAnalysis() {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const analyze = async (params: Parameters<typeof analyzeSwing>[0]): Promise<string | null> => {
    setUploading(true);
    setUploadError(null);
    try {
      const { job_id } = await analyzeSwing(params);
      return job_id;
    } catch (e) {
      setUploadError(String(e));
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, uploadError, analyze };
}
