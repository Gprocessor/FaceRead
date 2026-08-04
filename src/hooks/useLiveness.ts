import { useCallback, useState } from 'react';
import { requestLivenessChallenge, submitLivenessCheck, type LivenessChallengeResponse, type LivenessResult } from '@/services/faceService';
import { useCamera } from './useCamera';
export type LivenessPhase = 'idle' | 'challenge' | 'capturing' | 'analyzing' | 'done';
export function useLiveness() {
  const [phase, setPhase] = useState<LivenessPhase>('idle');
  const [challenge, setChallenge] = useState<LivenessChallengeResponse | null>(null);
  const [result, setResult] = useState<LivenessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useCamera();
  const startChallenge = useCallback(async () => {
    try { setError(null); setResult(null); const ch = await requestLivenessChallenge(); setChallenge(ch); setPhase('challenge'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to start liveness challenge'); }
  }, []);
  const submitFrames = useCallback(async (frames: Blob[], deviceInfo: Record<string, unknown>) => {
    if (!challenge) return;
    setPhase('analyzing');
    try { const res = await submitLivenessCheck(challenge.session_id, challenge.challenge_type, frames, deviceInfo); setResult(res); setPhase('done'); return res; }
    catch (err) { setError(err instanceof Error ? err.message : 'Liveness check failed'); setPhase('done'); return null; }
  }, [challenge]);
  const reset = useCallback(() => { setPhase('idle'); setChallenge(null); setResult(null); setError(null); }, []);
  return { phase, challenge, result, error, camera, startChallenge, submitFrames, reset };
}
