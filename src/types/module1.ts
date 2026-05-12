export type ViewType  = 'dtl' | 'face_on' | 'other';
export type ClubType  = 'driver' | 'iron';
export type SwingPhase = 'address' | 'top' | 'impact' | 'finish';
export type MetricId  =
  | 'STANCE_RATIO'
  | 'SHOULDER_ROT'
  | 'X_FACTOR'
  | 'BACKSWING_MAX'
  | 'HIP_ROTATION'
  | 'WRIST_ANGLE'
  | 'SPINE_TILT';

export interface MetricValue {
  userValue:  number;
  proMean:    number;
  proStd:     number;
  idealRange: [number, number] | null;
  unit:       string;
  score:      number;
}

export interface Recommendation {
  metricId:        string;
  title:           string;
  body:            string;
  drillTitle:      string;
  drillPreviewUrl: string | null;
}

export interface AnalysisResult {
  sessionId:       string;
  viewType:        ViewType;
  clubType:        ClubType;
  overallScore:    number;
  analyzedAt:      string;
  phaseScores:     Record<SwingPhase, number>;
  metrics:         Record<MetricId, MetricValue>;
  recommendations: Recommendation[];
}

export interface SessionSummary {
  sessionId:    string;
  overallScore: number;
  viewType:     string;
  clubType:     string;
  analyzedAt:   string;
  thumbnailUrl: string | null;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total:    number;
  page:     number;
  limit:    number;
}

export interface AnalyzeJobResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'done' | 'error';
}

export interface JobStatusResponse {
  status:      'queued' | 'processing' | 'done' | 'error';
  session_id?: string;
  message?:    string;
}
