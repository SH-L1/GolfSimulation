export const DEFAULT_POLL_INTERVAL_MS = 2000;

export function waitMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
