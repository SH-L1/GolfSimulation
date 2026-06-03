import type { AnalysisResult } from '../types/module1';

type Listener<T> = (value: T) => void;

function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => state,
    set: (next: T) => { state = next; listeners.forEach(l => l(next)); },
    subscribe: (l: Listener<T>) => { listeners.add(l); return () => listeners.delete(l); },
  };
}

const resultStore    = createStore<AnalysisResult | null>(null);
const sessionIdStore = createStore<string | null>(null);

export const getAnalysisResult   = resultStore.get;
export const getCurrentSessionId = sessionIdStore.get;

export function setAnalysisResult(result: AnalysisResult | null): void {
  resultStore.set(result);
  sessionIdStore.set(result?.sessionId ?? null);
}
