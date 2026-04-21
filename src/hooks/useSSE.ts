import { useCallback, useRef, useState } from 'react';
import { API_BASE, ENDPOINTS, ChatStreamRequest } from '../api/client';

export type SSEStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error';

/**
 * Module 2 /module2/chat/stream SSE 스트리밍 훅
 * - send() 호출 시 SSE 연결을 열고 토큰 단위로 onToken 콜백 호출
 * - React Native에서 EventSource 미지원 → fetch + ReadableStream 방식 사용
 * TODO: 백엔드 완성 후 실제 SSE fetch 구현으로 교체
 */
export function useSSE(onToken: (token: string) => void, onDone: () => void) {
  const [sseStatus, setSSEStatus] = useState<SSEStatus>('idle');
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (req: ChatStreamRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSSEStatus('connecting');

    try {
      // TODO: 실제 SSE 연결로 교체
      // const res = await fetch(`${API_BASE}${ENDPOINTS.module2.stream}`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(req),
      //   signal: controller.signal,
      // });
      // for await (const chunk of res.body) { onToken(decode(chunk)); }
      void API_BASE; void req;

      // ── 목업 SSE (단어 단위 토큰 흉내) ────────────────────────────
      setSSEStatus('streaming');
      const MOCK = '분석 결과를 바탕으로 개선 방향을 안내해드립니다. 잠시 후 상세 피드백이 이어집니다.';
      const words = MOCK.split(' ');
      for (let i = 0; i < words.length; i++) {
        await new Promise(r => setTimeout(r, 80));
        if (controller.signal.aborted) return;
        onToken(i === 0 ? words[i] : ' ' + words[i]);
      }
      // ─────────────────────────────────────────────────────────────

      setSSEStatus('done');
      onDone();
    } catch (e: any) {
      if (e?.name !== 'AbortError') setSSEStatus('error');
    }
  }, [onToken, onDone]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setSSEStatus('idle');
  }, []);

  return { sseStatus, send, cancel };
}
