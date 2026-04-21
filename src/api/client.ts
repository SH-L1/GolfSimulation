// TODO: 백엔드 완성 후 실제 서버 주소로 교체
export const API_BASE = 'http://10.0.2.2:8000/api'; // Android 에뮬레이터 → localhost

export const ENDPOINTS = {
  auth: {
    verify: '/auth/verify',
    me:     '/auth/me',
  },
  module1: {
    analyze:  '/module1/analyze',
    status:   (jobId: string)     => `/module1/status/${jobId}`,
    result:   (sessionId: string) => `/module1/result/${sessionId}`,
    sessions: '/module1/sessions',
    session:  (sessionId: string) => `/module1/sessions/${sessionId}`,
  },
  module2: {
    chat:    '/module2/chat',
    stream:  '/module2/chat/stream',
    history: (sessionId: string) => `/module2/history/${sessionId}`,
  },
  module3: {
    landmarks: (sessionId: string) => `/module3/landmarks/${sessionId}`,
    pro:       (playerId: string)  => `/module3/pro/${playerId}`,
  },
} as const;

// Module 2 chat/stream 요청 바디 타입 (아키텍처 8.3절)
export interface ChatStreamRequest {
  message:          string;
  session_id:       string;       // ChatSession ID
  current_session_id?: string;    // 연결된 스윙 분석 세션 (Module 1)
  experience_level: 'beginner' | 'experienced';
}

// Module 1 분석 요청 응답
export interface AnalyzeJobResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'done' | 'error';
}

// Module 1 상태 폴링 응답
export interface JobStatusResponse {
  status:     'queued' | 'processing' | 'done' | 'error';
  session_id?: string;
  message?:   string;
}
