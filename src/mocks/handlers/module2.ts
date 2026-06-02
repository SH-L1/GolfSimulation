import { http, HttpResponse } from 'msw';
import { API_BASE } from '../../api/client';
import { MOCK_CHAT_HISTORY, MOCK_CHAT_SESSION_ID, MOCK_STREAM_TOKENS } from '../data/module2';

// React Native(Hermes)와 Node.js 환경 모두에서 사용 가능한 전역 선언
declare const TextEncoder: new () => { encode(input?: string): Uint8Array };
declare const ReadableStream: new (source?: {
  start?: (controller: { enqueue(chunk: Uint8Array): void; close(): void }) => void | Promise<void>;
}) => unknown;

function buildSSEStream(tokens: string[]): unknown {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const token of tokens) {
        await new Promise<void>(r => setTimeout(r, 120));
        const chunk = `data: ${JSON.stringify({ type: 'token', content: token })}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      }
      const done = `data: ${JSON.stringify({
        type:          'done',
        chatSessionId: MOCK_CHAT_SESSION_ID,
      })}\n\n`;
      controller.enqueue(encoder.encode(done));
      controller.close();
    },
  });
}

export const module2Handlers = [
  http.post(`${API_BASE}/module2/chat/stream`, () =>
    new HttpResponse(buildSSEStream(MOCK_STREAM_TOKENS) as any, {
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  ),

  http.get(`${API_BASE}/module2/history/:sessionId`, () =>
    HttpResponse.json(MOCK_CHAT_HISTORY),
  ),

  http.delete(`${API_BASE}/module2/history/:sessionId`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
