import { apiFetch, ENDPOINTS } from './client';
import type { LandmarkResponse, PoseFrame, ProRecommendResponse } from '../types/module3';

export type {
  Landmark, PoseFrame, LandmarkResponse,
  BodyRatios, ProRecommendNeighbor, ProRecommendResponse,
} from '../types/module3';

// events → 각 프레임에 phase 파생
// events[x].frame은 원본 프레임 번호 → frame_orig와 비교
function derivePhases(frames: PoseFrame[], events: LandmarkResponse['events']): void {
  const sorted = Object.entries(events)
    .map(([phase, { frame }]) => ({ phase, frame }))
    .sort((a, b) => a.frame - b.frame);
  if (sorted.length === 0) { return; }
  // frames가 frame_orig 기준으로 정렬돼 있지 않을 수 있으므로 각 프레임 독립 판단
  for (const f of frames) {
    const orig = f.frame_orig ?? f.frame;
    let phase = sorted[0].phase;
    for (const e of sorted) {
      if (orig >= e.frame) { phase = e.phase; }
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
  viewtype: 'faceon' | 'downtheline' = 'faceon',
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
