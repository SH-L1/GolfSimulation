import { apiFetch, apiFetchMultipart, ENDPOINTS } from './client';
import type {
  ViewType, ClubType, MetricId,
  MetricValue, AnalysisResult,
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

// ── API Response Types (snake_case, 내부 전용) ────────────────────
interface ApiMetricValue {
  user_value:  number;
  pro_mean:    number;
  pro_std:     number;
  ideal_range: [number, number] | null;
  unit:        string;
  score:       number;
}

interface ApiRecommendation {
  metric_id:         string;
  title:             string;
  body:              string;
  drill_title:       string;
  drill_preview_url: string | null;
}

interface ApiAnalysisResult {
  session_id:      string;
  view_type:       string;
  club_type:       string;
  overall_score:   number;
  analyzed_at:     string;
  phase_scores:    { address: number; top: number; impact: number; finish: number };
  metrics:         Record<string, ApiMetricValue>;
  recommendations: ApiRecommendation[];
}

interface ApiSessionSummary {
  session_id:    string;
  overall_score: number;
  view_type:     string;
  club_type:     string;
  analyzed_at:   string;
  thumbnail_url: string | null;
}

// ── Mapper: snake_case → camelCase ────────────────────────────────
function mapMetric(api: ApiMetricValue): MetricValue {
  return {
    userValue:  api.user_value,
    proMean:    api.pro_mean,
    proStd:     api.pro_std,
    idealRange: api.ideal_range,
    unit:       api.unit,
    score:      api.score,
  };
}

function mapAnalysisResult(api: ApiAnalysisResult): AnalysisResult {
  const metrics = {} as Record<MetricId, MetricValue>;
  for (const [key, val] of Object.entries(api.metrics)) {
    metrics[key as MetricId] = mapMetric(val);
  }
  return {
    sessionId:    api.session_id,
    viewType:     api.view_type as ViewType,
    clubType:     api.club_type as ClubType,
    overallScore: api.overall_score,
    analyzedAt:   api.analyzed_at,
    phaseScores:  api.phase_scores,
    metrics,
    recommendations: api.recommendations.map(r => ({
      metricId:        r.metric_id,
      title:           r.title,
      body:            r.body,
      drillTitle:      r.drill_title,
      drillPreviewUrl: r.drill_preview_url,
    })),
  };
}

function mapSessionSummary(api: ApiSessionSummary): SessionSummary {
  return {
    sessionId:    api.session_id,
    overallScore: api.overall_score,
    viewType:     api.view_type,
    clubType:     api.club_type,
    analyzedAt:   api.analyzed_at,
    thumbnailUrl: api.thumbnail_url,
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
  form.append('view_type', params.viewType);
  form.append('club_type', params.clubType);
  if (params.trimStart !== undefined) { form.append('trim_start', String(params.trimStart)); }
  if (params.trimEnd   !== undefined) { form.append('trim_end',   String(params.trimEnd)); }
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
    sessions: ApiSessionSummary[];
    total: number; page: number; limit: number;
  }>(`${ENDPOINTS.module1.sessions}?page=${page}&limit=${limit}`);
  return {
    sessions: api.sessions.map(mapSessionSummary),
    total:    api.total,
    page:     api.page,
    limit:    api.limit,
  };
}

export async function getSession(sessionId: string): Promise<AnalysisResult> {
  const api = await apiFetch<ApiAnalysisResult>(ENDPOINTS.module1.session(sessionId));
  return mapAnalysisResult(api);
}
