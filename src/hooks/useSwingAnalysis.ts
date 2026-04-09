import { useState } from 'react';

export interface SwingAnalysisResult {
  score: number;
  feedback: string[];
  videoUri: string | null;
  analyzedAt: string | null;
}

const initialState: SwingAnalysisResult = {
  score: 0,
  feedback: [],
  videoUri: null,
  analyzedAt: null,
};

// Mock hook — API 연동 전 목업 데이터로 동작
export function useSwingAnalysis() {
  const [result, setResult] = useState<SwingAnalysisResult>(initialState);
  const [loading, setLoading] = useState(false);

  const analyze = async (videoUri: string) => {
    setLoading(true);
    // TODO: 실제 분석 API 호출로 교체
    await new Promise(res => setTimeout(res, 1500));
    setResult({
      score: 78,
      feedback: [
        '백스윙 회전각이 약간 부족합니다.',
        '임팩트 시 체중 이동이 양호합니다.',
        '팔로우스루 자세가 자연스럽습니다.',
      ],
      videoUri,
      analyzedAt: new Date().toISOString(),
    });
    setLoading(false);
  };

  const reset = () => setResult(initialState);

  return { result, loading, analyze, reset };
}
