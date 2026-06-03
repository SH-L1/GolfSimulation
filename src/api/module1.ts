import { apiFetch, apiFetchMultipart, ENDPOINTS } from './client';
import type {
  ViewType, ClubType, MetricValue, Recommendation, AnalysisResult,
  SessionSummary, SessionListResponse,
  AnalyzeJobResponse, JobStatusResponse,
} from '../types/module1';

// Re-export UI types so hooks/screens can import from here
export type {
  ViewType, ClubType, SwingPhase, MetricId,
  MetricValue, Recommendation, AnalysisResult,
  SessionSummary, SessionListResponse,
  AnalyzeJobResponse, JobStatusResponse,
} from '../types/module1';

// ── API Response Types (backend snake_case / no-separator) ────────
interface ApiScoreBundle {
  metrics: Record<string, number>;
  phases:  Record<string, number>;
  overall: number | null;
}

interface ApiPriorityCoaching {
  metric_id: string;
  score:     number;
  phase:     string;
}

interface ApiMetricDetail {
  proMean:    number;
  proStd:     number;
  idealRange: [number, number];
  unit:       string;
}

interface ApiAnalysisResult {
  sessionid:         string;
  status:            string;
  viewtype:          string;
  clubtype:          string;
  inputfilename?:    string | null;
  analyzedat?:       string | null;
  events:            Record<string, { frame: number; confidence?: number; timestamp?: number }>;
  metrics:           Record<string, number>;
  scores:            ApiScoreBundle;
  priority_coaching: ApiPriorityCoaching[];
  charturl?:         string | null;
  message?:          string | null;
  p1_raw_metrics?:   Record<string, number>;
  metric_details?:   Record<string, ApiMetricDetail>;
}

interface ApiSessionListItem {
  sessionid:      string;
  status:         string;
  viewtype:       string;
  clubtype:       string;
  inputfilename?: string | null;
  analyzedat?:    string | null;
  createdat:      string;
}

// ── 추천 텍스트 생성용 로컬 매핑 ─────────────────────────────────
const METRIC_LABEL_KO: Record<string, string> = {
  STANCE_RATIO:  '발 너비',
  SHOULDER_ROT:  '어깨 회전',
  X_FACTOR:      '상하체 분리',
  BACKSWING_MAX: '백스윙 각도',
  HIP_ROTATION:  '골반 회전',
  WRIST_ANGLE:   '손목 각도',
  SPINE_TILT:    '척추 기울기',
};

const PHASE_LABEL_KO: Record<string, string> = {
  address: '준비 자세',
  top:     '백스윙',
  impact:  '공 맞는 순간',
  finish:  '마무리',
};

function buildRecommendation(item: ApiPriorityCoaching): Recommendation {
  const label = METRIC_LABEL_KO[item.metric_id] ?? item.metric_id;
  const phase = PHASE_LABEL_KO[item.phase] ?? item.phase;
  const score = Math.round(item.score);
  return {
    metricId:        item.metric_id,
    title:           `${label} 개선이 필요해요`,
    body:            `${phase} 구간에서 ${label} 점수가 ${score}점입니다. 꾸준한 연습으로 개선해보세요.`,
    drillTitle:      `${label} 드릴 연습`,
    drillPreviewUrl: null,
  };
}

// ── Mappers ───────────────────────────────────────────────────────
function mapAnalysisResult(api: ApiAnalysisResult): AnalysisResult {
  const metricScores = api.scores?.metrics ?? {};
  const rawMetrics   = api.metrics ?? {};
  const p1Raw        = api.p1_raw_metrics ?? {};

  const metrics: Record<string, MetricValue> = {};
  const allKeys = new Set([...Object.keys(rawMetrics), ...Object.keys(metricScores)]);
  for (const key of allKeys) {
    const detail = api.metric_details?.[key];
    metrics[key] = {
      userValue:  p1Raw[key] ?? rawMetrics[key] ?? 0,
      score:      metricScores[key] ?? 0,
      proMean:    detail?.proMean,
      proStd:     detail?.proStd,
      idealRange: detail?.idealRange,
      unit:       detail?.unit,
    };
  }

  const recommendations = (api.priority_coaching ?? []).map(buildRecommendation);

  return {
    sessionId:       api.sessionid,
    viewType:        api.viewtype as ViewType,
    clubType:        api.clubtype as ClubType,
    overallScore:    api.scores?.overall ?? 0,
    analyzedAt:      api.analyzedat ?? new Date().toISOString(),
    phaseScores:     api.scores?.phases ?? {},
    metrics,
    recommendations,
    chartUrl:        api.charturl ?? null,
  };
}

function mapSessionSummary(api: ApiSessionListItem): SessionSummary {
  return {
    sessionId:  api.sessionid,
    viewType:   api.viewtype,
    clubType:   api.clubtype,
    analyzedAt: api.analyzedat ?? api.createdat,
  };
}

// ── API Functions ─────────────────────────────────────────────────
export async function analyzeSwing(params: {
  videoUri:   string;
  viewType:   ViewType;
  clubType:   ClubType;
  trimStart?: number;
  trimEnd?:   number;
}): Promise<AnalyzeJobResponse> {
  const form = new FormData();
  form.append('video', {
    uri:  params.videoUri,
    name: 'swing.mp4',
    type: 'video/mp4',
  } as unknown as Blob);
  form.append('viewtype', params.viewType);
  form.append('clubtype', params.clubType);
  if (params.trimStart !== undefined) { form.append('trimstart', String(params.trimStart)); }
  if (params.trimEnd   !== undefined) { form.append('trimend',   String(params.trimEnd)); }
  return apiFetchMultipart<AnalyzeJobResponse>(ENDPOINTS.module1.analyze, form);
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return apiFetch<JobStatusResponse>(ENDPOINTS.module1.status(jobId));
}

export async function getAnalysisResult(sessionId: string): Promise<AnalysisResult> {
  const api = await apiFetch<ApiAnalysisResult>(ENDPOINTS.module1.result(sessionId));
  return mapAnalysisResult(api);
}

export async function getSessions(page = 1, limit = 20): Promise<SessionListResponse> {
  const api = await apiFetch<{
    sessions: ApiSessionListItem[];
    total: number; page: number; limit: number;
  }>(`${ENDPOINTS.module1.sessions}?page=${page}&limit=${limit}`);
  return {
    sessions: api.sessions.map(mapSessionSummary),
    total:    api.total,
    page:     api.page,
    limit:    api.limit,
  };
}

