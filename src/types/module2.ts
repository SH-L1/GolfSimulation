export interface ChatStreamRequest {
  message:             string;
  session_id:          string | null;
  current_session_id?: string | null;
  experience_level:    'beginner' | 'experienced';
}

export interface ChatMessage {
  message_id: string;
  role:       'user' | 'assistant';
  content:    string;
  created_at: string;
}

export interface ChatHistoryResponse {
  chat_session_id:  string;
  swing_session_id: string;
  created_at:       string;
  messages:         ChatMessage[];
}

// SSE 이벤트 타입
export interface SSETokenEvent {
  type:    'token';
  content: string;
}

export interface SSEDoneEvent {
  type:            'done';
  chat_session_id: string;
  message_id:      string;
}

export interface SSEErrorEvent {
  type:    'error';
  message: string;
}

export type SSEEvent = SSETokenEvent | SSEDoneEvent | SSEErrorEvent;
