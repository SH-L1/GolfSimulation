// 백엔드 실제 응답 포맷과 동일하게 유지 (snake_case / no-separator)
export const MOCK_JOB_ID    = 'mock-job-001';
export const MOCK_SESSION_ID = '507f1f77bcf86cd799439011';

export const MOCK_ANALYZE_JOB = {
  jobid:  MOCK_JOB_ID,
  status: 'queued' as const,
};

export const MOCK_ANALYSIS_RESULT = {
  sessionid:     MOCK_SESSION_ID,
  status:        'done',
  viewtype:      'faceon',
  clubtype:      'driver',
  inputfilename: 'swing.mp4',
  analyzedat:    new Date().toISOString(),
  events: {
    address: 10,
    top:     45,
    impact:  80,
    finish:  120,
  },
  metrics: {
    STANCE_RATIO:  0.52,
    SHOULDER_ROT:  88,
    X_FACTOR:      38,
    BACKSWING_MAX: 210,
    HIP_ROTATION:  42,
    WRIST_ANGLE:   68,
    SPINE_TILT:    22,
  },
  scores: {
    metrics: {
      STANCE_RATIO:  85,
      SHOULDER_ROT:  80,
      X_FACTOR:      72,
      BACKSWING_MAX: 78,
      HIP_ROTATION:  76,
      WRIST_ANGLE:   82,
      SPINE_TILT:    80,
    },
    phases: {
      address: 82,
      top:     75,
      impact:  80,
      finish:  73,
    },
    overall: 78,
  },
  priority_coaching: [
    { metric_id: 'X_FACTOR',      score: 72, phase: 'top' },
    { metric_id: 'BACKSWING_MAX', score: 78, phase: 'top' },
  ],
  charturl:       null,
  message:        null,
  p1_raw_metrics: {},
};

export const MOCK_SESSIONS = [
  {
    sessionid:     MOCK_SESSION_ID,
    status:        'done',
    viewtype:      'faceon',
    clubtype:      'driver',
    inputfilename: 'swing.mp4',
    analyzedat:    new Date().toISOString(),
    createdat:     new Date().toISOString(),
  },
  {
    sessionid:     '507f1f77bcf86cd799439012',
    status:        'done',
    viewtype:      'faceon',
    clubtype:      'iron',
    inputfilename: 'swing2.mp4',
    analyzedat:    new Date(Date.now() - 86400000 * 3).toISOString(),
    createdat:     new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    sessionid:     '507f1f77bcf86cd799439013',
    status:        'done',
    viewtype:      'downtheline',
    clubtype:      'driver',
    inputfilename: 'swing3.mp4',
    analyzedat:    new Date(Date.now() - 86400000 * 7).toISOString(),
    createdat:     new Date(Date.now() - 86400000 * 7).toISOString(),
  },
];
