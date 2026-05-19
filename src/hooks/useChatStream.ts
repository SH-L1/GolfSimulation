import { useCallback, useRef, useState } from 'react';
import { streamChat } from '../api/module2';
import type { ChatStreamRequest } from '../types/module2';

export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'done' | 'error';

export function useChatStream(
  onToken: (token: string) => void,
  onDone:  (chatSessionId: string) => void,
) {
  const [status, setStatus]   = useState<StreamStatus>('idle');
  const [error, setError]     = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const send = useCallback((req: ChatStreamRequest) => {
    controllerRef.current?.abort();
    setStatus('connecting');
    setError(null);

    controllerRef.current = streamChat(
      req,
      (token) => { setStatus('streaming'); onToken(token); },
      (chatSessionId) => { setStatus('done'); onDone(chatSessionId); },
      (msg) => { setStatus('error'); setError(msg); },
    );
  }, [onToken, onDone]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setStatus('idle');
  }, []);

  return { status, error, send, cancel };
}
