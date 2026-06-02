import { apiFetch, clearToken, getToken, API_BASE, ENDPOINTS } from './client';
import { navigationRef } from '../navigation/navigationRef';
import type { ChatStreamRequest, ChatHistoryResponse } from '../types/module2';
import { parseSSELine, splitSSEBuffer } from '../utils/sseParser';

export type { ChatStreamRequest, ChatMessage, ChatHistoryResponse, SSEEvent } from '../types/module2';

// ── SSE Streaming Chat (XMLHttpRequest — React Native은 fetch Streams 미지원) ──
export function streamChat(
  req: ChatStreamRequest,
  onToken:  (content: string) => void,
  onDone:   (chatSessionId: string, messageId: string) => void,
  onError:  (message: string) => void,
): AbortController {
  const controller = new AbortController();
  let aborted = false;

  const xhr = new XMLHttpRequest();
  controller.signal.addEventListener('abort', () => { aborted = true; xhr.abort(); });
  let processedLen = 0;
  let buffer = '';

  xhr.open('POST', `${API_BASE}${ENDPOINTS.module2.stream}`, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Accept', 'text/event-stream');
  xhr.setRequestHeader('ngrok-skip-browser-warning', '1');

  getToken().then(token => {
    if (aborted) { return; }
    if (token) { xhr.setRequestHeader('Authorization', `Bearer ${token}`); }

    xhr.onprogress = () => {
      if (aborted) { return; }
      const newText = xhr.responseText.slice(processedLen);
      processedLen = xhr.responseText.length;

      buffer += newText;
      const { lines, nextBuffer } = splitSSEBuffer(buffer);
      buffer = nextBuffer;

      for (const line of lines) {
        const event = parseSSELine(line);
        if (!event) { continue; }
        if (event.type === 'token') {
          onToken(event.content);
        } else if (event.type === 'done') {
          onDone(event.chatSessionId, '');
        } else if (event.type === 'error') {
          onError(event.message);
        }
      }
    };

    xhr.onload = () => {
      if (aborted) { return; }
      if (xhr.status === 401) {
        clearToken().then(() => {
          if (navigationRef.isReady()) { navigationRef.navigate('Login'); }
          onError('인증이 만료되었습니다. 다시 로그인해 주세요.');
        });
        return;
      }
      if (xhr.status >= 400) {
        onError(`서버 오류 (${xhr.status})`);
        return;
      }
      // onprogress가 트리거되지 않은 경우 (응답이 한번에 도착) — 남은 버퍼 처리
      const remaining = xhr.responseText.slice(processedLen);
      if (remaining) {
        buffer += remaining;
      }
      if (buffer) {
        const { lines } = splitSSEBuffer(buffer + '\n');
        for (const line of lines) {
          const event = parseSSELine(line);
          if (!event) { continue; }
          if (event.type === 'token') { onToken(event.content); }
          else if (event.type === 'done') { onDone(event.chatSessionId, ''); }
          else if (event.type === 'error') { onError(event.message); }
        }
      }
    };

    xhr.onerror = () => {
      if (!aborted) { onError('네트워크 오류가 발생했습니다.'); }
    };

    xhr.send(JSON.stringify(req));
  });

  return controller;
}

// ── History ───────────────────────────────────────────────────────
export async function getChatHistory(sessionId: string): Promise<ChatHistoryResponse> {
  return apiFetch<ChatHistoryResponse>(ENDPOINTS.module2.history(sessionId));
}

export async function deleteChatHistory(sessionId: string): Promise<void> {
  await apiFetch<void>(ENDPOINTS.module2.history(sessionId), { method: 'DELETE' });
}
