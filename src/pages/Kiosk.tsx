import { useCallback, useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, CheckCircle2, XCircle, Loader2, KeyRound, ScanFace } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { CameraCapture } from '@/components/CameraCapture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDeviceInfo, getLocation } from '@/utils/deviceInfo';
import { getKioskKey, setKioskKey } from '@/services/apiClient';
import { requestKioskLivenessChallenge, submitKioskLivenessCheck, type LivenessChallengeResponse } from '@/services/faceService';
import { kioskCheckIn, kioskCheckOut, type CheckInOutResponse } from '@/services/attendanceService';

type Phase = 'pairing' | 'idle' | 'liveness' | 'analyzing_liveness' | 'capturing' | 'result';

const RESULT_DISPLAY_MS = 5000;

/**
 * Public attendance kiosk screen. No login required - this is meant to run
 * on a shared device (tablet/laptop) at the entrance. The device is scoped
 * to one organization via a paired kiosk key (see Settings > Kiosk), and WHO
 * is being checked in/out is determined purely by the face scan itself.
 */
export function Kiosk() {
  const [paired, setPaired] = useState(!!getKioskKey());
  const [keyInput, setKeyInput] = useState('');
  const [checkType, setCheckType] = useState<'check_in' | 'check_out'>('check_in');
  const [phase, setPhase] = useState<Phase>('idle');
  const [challenge, setChallenge] = useState<LivenessChallengeResponse | null>(null);
  const [result, setResult] = useState<CheckInOutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useCamera();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paired) camera.startCamera();
    return () => camera.stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paired]);

  const startScan = useCallback(async () => {
    setError(null); setResult(null);
    try {
      const ch = await requestKioskLivenessChallenge();
      setChallenge(ch);
      setPhase('liveness');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start scan');
    }
  }, []);

  const runLivenessThenCheck = useCallback(async () => {
    if (!challenge) return;
    setPhase('analyzing_liveness');
    try {
      const frames = await camera.captureFrames(5, 300);
      const liveness = await submitKioskLivenessCheck(challenge.session_id, challenge.challenge_type, frames, getDeviceInfo());
      if (!liveness.passed) {
        setError(liveness.failure_reason || 'Liveness check failed, please try again');
        setPhase('idle');
        return;
      }
      setPhase('capturing');
      const faceBlob = await camera.captureFrame();
      if (!faceBlob) { setError('Could not capture image'); setPhase('idle'); return; }
      const location = await getLocation();
      const fn = checkType === 'check_in' ? kioskCheckIn : kioskCheckOut;
      const res = await fn(faceBlob, challenge.session_id, getDeviceInfo(), location ?? undefined);
      setResult(res);
      setPhase('result');
      resetTimer.current = setTimeout(() => { setPhase('idle'); setResult(null); setChallenge(null); }, RESULT_DISPLAY_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong, please try again');
      setPhase('idle');
    }
  }, [camera, challenge, checkType]);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const handlePair = async () => {
    setError(null);
    const key = keyInput.trim();
    if (!key) return;
    setKioskKey(key);
    try {
      // A bad key will fail on the first real kiosk-authenticated call.
      await requestKioskLivenessChallenge();
      setPaired(true);
    } catch {
      setError('That key was rejected. Double-check it in Settings > Kiosk on the admin app.');
    }
  };

  if (!paired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <KeyRound className="w-10 h-10 mx-auto text-primary" />
          <h1 className="text-lg font-semibold text-display">Pair this kiosk</h1>
          <p className="text-sm text-muted-foreground">Enter the kiosk key from an admin's Settings &gt; Kiosk page. This only needs to be done once per device.</p>
          <div className="space-y-1.5 text-left">
            <Label>Kiosk key</Label>
            <Input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Paste kiosk key" type="password" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={handlePair}>Pair device</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-display">Attendance Kiosk</h1>
        <p className="text-sm text-muted-foreground">Look at the camera to {checkType === 'check_in' ? 'check in' : 'check out'}</p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <CameraCapture videoRef={camera.videoRef} ready={camera.ready} error={camera.error}
          overlay={<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-44 h-56 border-2 border-primary/70 rounded-[50%]" /></div>} />

        {phase === 'result' && result && (
          <div className="text-center space-y-2">
            {result.success ? <CheckCircle2 className="w-12 h-12 mx-auto text-success" /> : <XCircle className="w-12 h-12 mx-auto text-destructive" />}
            <h3 className="text-lg font-semibold text-display">{result.success ? `Welcome${result.employee_name ? `, ${result.employee_name}` : ''}!` : 'Not recognized'}</h3>
            <p className="text-sm text-muted-foreground">{result.message}</p>
          </div>
        )}

        {phase === 'liveness' && challenge && (
          <div className="text-center space-y-3">
            <p className="text-sm font-medium">{challenge.instruction}</p>
            <Button onClick={runLivenessThenCheck}><ScanFace className="w-4 h-4" />Ready</Button>
          </div>
        )}

        {(phase === 'analyzing_liveness' || phase === 'capturing') && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />{phase === 'analyzing_liveness' ? 'Verifying liveness…' : 'Capturing…'}</div>
        )}

        {error && phase === 'idle' && <p className="text-sm text-destructive text-center">{error}</p>}

        {phase === 'idle' && (
          <div className="grid grid-cols-2 gap-3">
            <Button variant={checkType === 'check_in' ? 'default' : 'outline'} onClick={() => { setCheckType('check_in'); startScan(); }}><LogIn className="w-4 h-4" />Check In</Button>
            <Button variant={checkType === 'check_out' ? 'default' : 'outline'} onClick={() => { setCheckType('check_out'); startScan(); }}><LogOut className="w-4 h-4" />Check Out</Button>
          </div>
        )}
      </div>
    </div>
  );
}
