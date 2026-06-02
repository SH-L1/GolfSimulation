import { apiFetch, ENDPOINTS } from './client';
import type { LandmarkResponse, PoseFrame, ProRecommendResponse } from '../types/module3';

export type {
  Landmark, PoseFrame, LandmarkResponse,
  BodyRatios, ProRecommendNeighbor, ProRecommendResponse,
} from '../types/module3';

// events → 각 프레임에 phase 파생 (address, top, impact, finish 등)
function derivePhases(frames: PoseFrame[], events: Record<string, { frame: number }>): void {
  const sorted = Object.entries(events)
    .map(([phase, { frame }]) => ({ phase, frame }))
    .sort((a, b) => a.frame - b.frame);
  if (sorted.length === 0) { return; }
  for (const f of frames) {
    let phase = sorted[0].phase;
    for (const e of sorted) {
      if (f.frame >= e.frame) { phase = e.phase; }
      else { break; }
    }
    f.phase = phase;
  }
}

// timestamps(초) → fps 계산
function computeFps(frames: PoseFrame[]): number {
  if (frames.length < 2) { return 30; }
  const dt = frames[frames.length - 1].timestamp - frames[0].timestamp;
  if (dt <= 0) { return 30; }
  return Math.round((frames.length - 1) / dt);
}

function enrichResponse(res: LandmarkResponse): LandmarkResponse {
  derivePhases(res.frames, res.events);
  res.fps = computeFps(res.frames);
  return res;
}

export async function getLandmarks(sessionId: string): Promise<LandmarkResponse> {
  const res = await apiFetch<LandmarkResponse>(ENDPOINTS.module3.landmarks(sessionId));
  return enrichResponse(res);
}

export async function getProLandmarks(
  playerId: string,
  viewtype: 'face_on' | 'down_the_line' = 'face_on',
): Promise<LandmarkResponse> {
  const res = await apiFetch<LandmarkResponse>(`${ENDPOINTS.module3.pro(playerId)}?viewtype=${viewtype}`);
  return enrichResponse(res);
}

export async function getProRecommendations(
  sessionId: string,
  k = 5,
  metric: 'euclidean' | 'cosine' = 'euclidean',
): Promise<ProRecommendResponse> {
  return apiFetch<ProRecommendResponse>(
    `${ENDPOINTS.module3.recommend(sessionId)}?k=${k}&metric=${metric}`,
  );
}
