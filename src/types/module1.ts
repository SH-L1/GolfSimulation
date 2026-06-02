export type ViewType  = 'faceon' | 'downtheline';
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
  userValue:   number;
  score:       number;
  proMean?:    number;
  proStd?:     number;
  idealRange?: [number, number] | null;
  unit?:       string;
}

export interface Recommendation {
  metricId:         string;
  title?:           string;
  body?:            string;
  drillTitle?:      string;
  drillPreviewUrl?: string | null;
}

export interface AnalysisResult {
  sessionId:       string;
  viewType:        ViewType;
  clubType:        ClubType;
  overallScore:    number;
  analyzedAt:      string;
  phaseScores:     Record<string, number>;
  metrics:         Record<string, MetricValue>;
  recommendations: Recommendation[];
  chartUrl?:       string | null;
}

export interface SessionSummary {
  sessionId:  string;
  viewType:   string;
  clubType:   string;
  analyzedAt: string | null;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total:    number;
  page:     number;
  limit:    number;
}

export interface AnalyzeJobResponse {
  jobid:  string;
  status: 'queued' | 'processing' | 'done' | 'error';
}

export interface JobStatusResponse {
  status:     'queued' | 'processing' | 'done' | 'error';
  sessionid?: string;
  message?:   string;
}
