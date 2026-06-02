import type { ChatHistoryResponse } from '../../types/module2';

export const MOCK_CHAT_SESSION_ID = 'mock-chat-session-001';

export const MOCK_CHAT_HISTORY: ChatHistoryResponse = {
  chat_session_id:  MOCK_CHAT_SESSION_ID,
  swing_session_id: 'mock-session-001',
  created_at:       new Date().toISOString(),
  messages: [
    {
      message_id: 'msg-001',
      role:       'user',
      content:    '제 스윙에서 가장 중요하게 개선해야 할 부분이 뭔가요?',
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
    {
      message_id: 'msg-002',
      role:       'assistant',
      content:    'X-Factor 향상이 가장 효과적입니다. 백스윙 시 엉덩이를 고정한 채 어깨만 충분히 돌리는 연습을 해보세요. 비거리와 정확도 모두 향상될 거예요.',
      created_at: new Date(Date.now() - 55000).toISOString(),
    },
  ],
};

// SSE 스트리밍 응답으로 내보낼 토큰 청크
export const MOCK_STREAM_TOKENS = [
  '네, 분석 결과를 보면 ',
  'X-Factor 개선이 ',
  '가장 중요한 포인트입니다. ',
  '백스윙 시 엉덩이는 최대한 고정하면서 ',
  '어깨를 충분히 돌려주세요. ',
  '현재 38°에서 ',
  '45° 정도로 늘리는 것을 ',
  '목표로 하시면 좋겠습니다. ',
  '2주 정도 집중 연습하시면 ',
  '분명한 변화를 느끼실 수 있을 거예요.',
];
