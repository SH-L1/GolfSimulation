import { useState, useEffect } from 'react';
import { getLandmarks } from '../api/module3';
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

  return { userFrames, loading, error };
}
