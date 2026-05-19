import { apiFetch, clearToken, getToken, API_BASE, ENDPOINTS } from './client';
import { navigationRef } from '../navigation/navigationRef';
import type { ChatStreamRequest, ChatHistoryResponse } from '../types/module2';
import { parseSSELine, splitSSEBuffer } from '../utils/sseParser';

export type { ChatStreamRequest, ChatMessage, ChatHistoryResponse, SSEEvent } from '../types/module2';

// React Native(Hermes)는 TextDecoder를 전역 제공하지만 TS lib에 dom이 없어 선언 필요
declare const TextDecoder: new () => {
  decode(input?: ArrayBuffer | ArrayBufferView, options?: { stream?: boolean }): string;
};

// ── SSE Streaming Chat ────────────────────────────────────────────
export function streamChat(
  req: ChatStreamRequest,
  onToken:  (content: string) => void,
  onDone:   (chatSessionId: string, messageId: string) => void,
  onError:  (message: string) => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept':       'text/event-stream',
      };
      if (token) { headers['Authorization'] = `Bearer ${token}`; }

      const res = await fetch(`${API_BASE}${ENDPOINTS.module2.stream}`, {
        method: 'POST',
        headers,
        body:   JSON.stringify(req),
        signal: controller.signal,
      });

      if (res.status === 401) {
        await clearToken();
        if (navigationRef.isReady()) { navigationRef.navigate('Login'); }
        onError('인증이 만료되었습니다. 다시 로그인해 주세요.');
        return;
      }
      if (!res.ok) { onError(`서버 오류 (${res.status})`); return; }

      type ChunkReader = { read(): Promise<{ done: boolean; value: Uint8Array | undefined }> };
      type StreamResponse = { body: { getReader(): ChunkReader } | null };
      const reader = (res as unknown as StreamResponse).body?.getReader();
      if (!reader) { onError('스트리밍을 지원하지 않는 환경입니다.'); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) { break; }

        buffer += decoder.decode(value, { stream: true });
        const { lines, nextBuffer } = splitSSEBuffer(buffer);
        buffer = nextBuffer;

        for (const line of lines) {
          const event = parseSSELine(line);
          if (!event) { continue; }
          if (event.type === 'token') {
            onToken(event.content);
          } else if (event.type === 'done') {
            onDone(event.chat_session_id, event.message_id);
          } else if (event.type === 'error') {
            onError(event.message);
          }
        }
      }
    } catch (e: unknown) {
      const err = e as { name?: string; message?: string };
      if (err?.name !== 'AbortError') { onError(err?.message ?? '알 수 없는 오류'); }
    }
  })();

  return controller;
}

// ── History ───────────────────────────────────────────────────────
export async function getChatHistory(sessionId: string): Promise<ChatHistoryResponse> {
  return apiFetch<ChatHistoryResponse>(ENDPOINTS.module2.history(sessionId));
}

export async function deleteChatHistory(sessionId: string): Promise<void> {
  await apiFetch<void>(ENDPOINTS.module2.history(sessionId), { method: 'DELETE' });
}
