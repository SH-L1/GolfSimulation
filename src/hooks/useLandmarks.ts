import { useState, useEffect } from 'react';
import { getLandmarks, getProLandmarks } from '../api/module3';
import type { LandmarkResponse } from '../types/module3';

export function useLandmarks(sessionId: string | null) {
  const [userFrames, setUserFrames] = useState<LandmarkResponse | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) { return; }
    setLoading(true);
    setError(null);
    getLandmarks(sessionId)
      .then(setUserFrames)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const fetchPro = async (playerId: string): Promise<LandmarkResponse | null> => {
    try {
      return await getProLandmarks(playerId);
    } catch {
      return null;
    }
  };

  return { userFrames, loading, error, fetchPro };
}
