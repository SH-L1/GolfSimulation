import { useState } from 'react';

// 아키텍처 7.2절 — Phase 1 지표 7종
export type MetricId =
  | 'STANCE_RATIO'
  | 'SHOULDER_ROT'
  | 'X_FACTOR'
  | 'BACKSWING_MAX'
  | 'HIP_ROTATION'
  | 'WRIST_ANGLE'
  | 'SPINE_TILT';

export type SwingPhase = 'address' | 'top' | 'impact' | 'finish';

export type ViewType = 'dtl' | 'face_on' | 'other';

export interface MetricValue {
  userValue: number;
  proMean: number;
  proStd: number;
  idealRange: [number, number];
  unit: string;
  // score = max(0, 100 - |userValue - proMean| / proStd * 20)
  score: number;
}

export interface AnalysisResult {
  sessionId: string;
  viewType: ViewType;
  overallScore: number;
  // 페이즈별 가중 점수 (Address 15% / Top 25% / Impact 45% / Finish 15%)
  phaseScores: Record<SwingPhase, number>;
  metrics: Record<MetricId, MetricValue>;
  analyzedAt: string;
}

// 아키텍처 6.5절 — 문헌 기반 레퍼런스 통계
const PRO_REFERENCE: Record<MetricId, Pick<MetricValue, 'proMean' | 'proStd' | 'idealRange' | 'unit'>> = {
  STANCE_RATIO:  { proMean: 1.05, proStd: 0.08, idealRange: [0.97, 1.13], unit: 'ratio' },
  SHOULDER_ROT:  { proMean: 100.0, proStd: 7.0,  idealRange: [93, 107],   unit: '°' },
  X_FACTOR:      { proMean: 45.0,  proStd: 5.2,  idealRange: [41, 49],    unit: '°' },
  BACKSWING_MAX: { proMean: 92.0,  proStd: 7.1,  idealRange: [86, 98],    unit: '°' },
  HIP_ROTATION:  { proMean: 40.0,  proStd: 4.8,  idealRange: [36, 44],    unit: '°' },
  WRIST_ANGLE:   { proMean: 148.0, proStd: 6.3,  idealRange: [143, 153],  unit: '°' },
  SPINE_TILT:    { proMean: 35.0,  proStd: 5.0,  idealRange: [30, 40],    unit: '°' },
};

function calcScore(userValue: number, proMean: number, proStd: number): number {
  return Math.max(0, Math.round(100 - (Math.abs(userValue - proMean) / proStd) * 20));
}

function buildMetric(id: MetricId, userValue: number): MetricValue {
  const ref = PRO_REFERENCE[id];
  return {
    ...ref,
    userValue,
    score: calcScore(userValue, ref.proMean, ref.proStd),
  };
}

// 목업 분석 결과 — Figma 디자인 수치 기반
function buildMockResult(sessionId: string, viewType: ViewType): AnalysisResult {
  const metrics: Record<MetricId, MetricValue> = {
    STANCE_RATIO:  buildMetric('STANCE_RATIO',  1.02),
    SHOULDER_ROT:  buildMetric('SHOULDER_ROT',  95.0),
    X_FACTOR:      buildMetric('X_FACTOR',      38.2),  // Figma: 38.2° vs 45°
    BACKSWING_MAX: buildMetric('BACKSWING_MAX', 88.0),
    HIP_ROTATION:  buildMetric('HIP_ROTATION',  29.1),  // Figma: 29.1° vs 40°
    WRIST_ANGLE:   buildMetric('WRIST_ANGLE',  145.0),
    SPINE_TILT:    buildMetric('SPINE_TILT',    33.0),
  };

  const phaseScores: Record<SwingPhase, number> = {
    address: 78,
    top: 62,
    impact: 55,
    finish: 65,
  };

  // 아키텍처 7.4절 — 페이즈 가중치
  const overallScore = Math.round(
    phaseScores.address * 0.15 +
    phaseScores.top     * 0.25 +
    phaseScores.impact  * 0.45 +
    phaseScores.finish  * 0.15,
  );

  return {
    sessionId,
    viewType,
    overallScore,
    phaseScores,
    metrics,
    analyzedAt: new Date().toISOString(),
  };
}

const initialState: AnalysisResult | null = null;

export function useSwingAnalysis() {
  const [result, setResult] = useState<AnalysisResult | null>(initialState);
  const [loading, setLoading] = useState(false);

  const analyze = async (videoUri: string, viewType: ViewType = 'dtl'): Promise<string> => {
    setLoading(true);
    // TODO: POST /module1/analyze + GET /module1/status/{job_id} 폴링으로 교체
    await new Promise<void>(res => setTimeout(() => res(), 1500));
    const sessionId = `session-${Date.now()}`;
    void videoUri;
    const analysisResult = buildMockResult(sessionId, viewType);
    setResult(analysisResult);
    setLoading(false);
    return sessionId;
  };

  const reset = () => setResult(null);

  return { result, loading, analyze, reset };
}
