import type { SSEEvent } from '../types/module2';

/**
 * SSE 라인 1줄을 파싱해 이벤트 객체로 변환.
 * "data: {...}" 형식이 아니면 null 반환.
 */
export function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) { return null; }
  const raw = line.slice(6).trim();
  if (!raw) { return null; }
  try {
    return JSON.parse(raw) as SSEEvent;
  } catch {
    return null;
  }
}

/**
 * 수신 버퍼를 줄 단위로 분할하고 완성된 줄만 반환.
 * 마지막 불완전 줄은 nextBuffer로 반환한다.
 */
export function splitSSEBuffer(buffer: string): { lines: string[]; nextBuffer: string } {
  const parts = buffer.split('\n');
  const nextBuffer = parts.pop() ?? '';
  return { lines: parts, nextBuffer };
}
