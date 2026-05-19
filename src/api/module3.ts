import { apiFetch, ENDPOINTS } from './client';
import type { LandmarkResponse } from '../types/module3';

export type { Landmark, PoseFrame, LandmarkResponse } from '../types/module3';

export async function getLandmarks(sessionId: string): Promise<LandmarkResponse> {
  return apiFetch<LandmarkResponse>(ENDPOINTS.module3.landmarks(sessionId));
}

export async function getProLandmarks(playerId: string): Promise<LandmarkResponse> {
  return apiFetch<LandmarkResponse>(ENDPOINTS.module3.pro(playerId));
}
