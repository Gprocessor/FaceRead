import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, CheckCircle2, XCircle, Loader2, KeyRound, ScanFace, ShieldCheck, UserCheck } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetect } from '@/hooks/useFaceDetect';
import { CameraCapture } from '@/components/CameraCapture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDeviceInfo, getLocation } from '@/utils/deviceInfo';
import { getKioskKey, setKioskKey } from '@/services/apiClient';
import { requestKioskLivenessChallenge, submitKioskLivenessCheck } from '@/services/faceService';
import { kioskCheckIn, kioskCheckOut, type CheckInOutResponse } from '@/services/attendanceService';

type Phase = 'idle' | 'liveness' | 'recognizing' | 'success' | 'error' | 'wait-exit';

const RESULT_MS = 3000;          // how long the result card stays up
const STABLE_MS = 600;           // face must be held this long before scanning
const COOLDOWN_MS = 3000;        // minimum gap between scans
const WAIT_EXIT_MAX_MS = 12000;  // give up waiting for the face to leave

/**
 * Frames captured per liveness challenge.
 *
 * A blink lasts roughly 150ms, so a few widely spaced frames miss it entirely -
 * that was the main cause of liveness failures. Blink is now sampled densely.
 * Frames are downscaled, so this is still cheaper than the old 5 full-size ones.
 */
const CAPTURE_PROFILE: Record<string, { frames: number; gapMs: number }> = {
  BLINK: { frames: 6, gapMs: 140 },
  TURN_HEAD_LEFT: { frames: 5, gapMs: 260 },
  TURN_HEAD_RIGHT: { frames: 5, gapMs: 260 },
  LOOK_STRAIGHT: { frames: 4, gapMs: 200 },
  SMILE: { frames: 5, gapMs: 220 },
};
const DEFAULT_PROFILE = { frames: 5, gapMs: 220 };

const CHALLENGE_UI: Record<string, { emoji: string; text: string }> = {
  BLINK: { emoji: '\u{1F441}\uFE0F', text: 'Blink now' },
  TURN_HEAD_LEFT: { emoji: '\u2B05\uFE0F', text: 'Turn your head slightly left' },
  TURN_HEAD_RIGHT: { emoji: '\u27A1\uFE0F', text: 'Turn your head slightly right' },
  LOOK_STRAIGHT: { emoji: '\u{1F642}', text: 'Look straight \u2014 hold still' },
  SMILE: { emoji: '\u{1F60A}', text: 'Give a small smile' },
};

export function Kiosk() {
  const [paired, setPaired] = useState(!!getKioskKey());
  const [keyInput, setKeyInput] = useState('');
  const [pairing, setPairing] = useState(false);

  const [checkType, setCheckType] = useState<'check_in' | 'check_out'>('check_in');
  const [phase, setPhase] = useState<Phase>('idle');
  const [challenge, setChallenge] = useState<{ emoji: string; text: string } | null>(null);
  const [result, setResult] = useState<CheckInOutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const camera = useCamera();
  const busyRef = useRef(false);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkTypeRef = useRef(checkType); checkTypeRef.current = checkType;

  const clearTimers = () => {
    if (resultTimer.current) { clearTimeout(resultTimer.current); resultTimer.current = null; }
    if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null; }
  };

  useEffect(() => {
    if (paired) camera.startCamera();
    return () => camera.stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paired]);

  useEffect(() => () => { clearTimers(); camera.stopCamera(); /* eslint-disable-next-line */ }, []);

  /**
   * One complete scan transaction, locked by busyRef so a second detector tick
   * (or a second face) can never start an overlapping scan - that was what
   * produced the repeated /liveness/challenge calls in the logs.
   */
  const runScan = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    clearTimers();
    setError(null);
    setResult(null);

    try {
      setPhase('liveness');
      const ch = await requestKioskLivenessChallenge();
      setChallenge(CHALLENGE_UI[ch.challenge_type] ?? { emoji: '\u{1F642}', text: ch.instruction });

      const profile = CAPTURE_PROFILE[ch.challenge_type] ?? DEFAULT_PROFILE;
      const frames = await camera.captureFrames(profile.frames, profile.gapMs);
      if (!frames.length) throw new Error('Could not read from the camera');

      const liveness = await submitKioskLivenessCheck(ch.session_id, ch.challenge_type, frames, getDeviceInfo());
      if (!liveness.passed) {
        throw new Error(liveness.failure_reason || 'Liveness check failed \u2014 please try again');
      }

      setPhase('recognizing');
      setChallenge(null);
      const faceBlob = await camera.captureFrame();
      if (!faceBlob) throw new Error('Could not capture image');

      const location = await getLocation();
      const submit = checkTypeRef.current === 'check_in' ? kioskCheckIn : kioskCheckOut;
      const res = await submit(faceBlob, ch.session_id, getDeviceInfo(), location ?? undefined);

      setResult(res);
      setPhase(res.success || res.duplicate ? 'success' : 'error');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setResult(null);
      setPhase('error');
    } finally {
      setChallenge(null);
      resultTimer.current = setTimeout(() => setPhase('wait-exit'), RESULT_MS);
      busyRef.current = false;
    }
  }, [camera]);

  const { box, status, faceVisible, armCooldown } = useFaceDetect(camera.videoRef, {
    active: paired && camera.ready && phase === 'idle',
    onReady: runScan,
    stableMs: STABLE_MS,
    cooldownMs: COOLDOWN_MS,
  });

  // After a result, wait for the person to step away before re-arming so the
  // same face is never scanned twice in a row.
  useEffect(() => {
    if (phase !== 'wait-exit') return;
    if (!faceVisible) {
      armCooldown();
      setResult(null);
      setError(null);
      setPhase('idle');
      return;
    }
    exitTimer.current = setTimeout(() => {
      armCooldown(); setResult(null); setError(null); setPhase('idle');
    }, WAIT_EXIT_MAX_MS);
    return () => { if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null; } };
  }, [phase, faceVisible, armCooldown]);

  const handlePair = async () => {
    setError(null);
    const key = keyInput.trim();
    if (!key) return;
    setPairing(true);
    setKioskKey(key);
    try { await requestKioskLivenessChallenge(); setPaired(true); }
    catch { setError('That key was rejected. Check Settings \u2192 Kiosk in the admin app.'); }
    finally { setPairing(false); }
  };

  const AdminLink = (
    <Link to="/login" title="Admin" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
      <ShieldCheck className="size-3.5" /> Admin
    </Link>
  );

  if (!paired) {
    return (
      <div className="grid-blueprint flex min-h-screen flex-col bg-background">
        <header className="flex items-center justify-between px-6 py-4">
          <span className="text-display inline-flex items-center gap-2 font-bold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ScanFace className="size-4" /></span>FaceAttend
          </span>
          {AdminLink}
        </header>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="surface-panel w-full max-w-md space-y-4 p-6">
            <div className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /><h1 className="text-display text-lg font-bold">Pair this kiosk</h1></div>
            <p className="text-sm text-muted-foreground">Enter the kiosk key from an admin&rsquo;s <strong>Settings &rarr; Kiosk</strong> page. Needed once per device.</p>
            <div className="space-y-1.5">
              <Label htmlFor="kk">Kiosk key</Label>
              <Input id="kk" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Paste kiosk key" />
            </div>
            {error && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><XCircle className="size-4" />{error}</div>}
            <Button onClick={handlePair} disabled={pairing} className="w-full">{pairing ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Pair device</Button>
          </div>
        </div>
      </div>
    );
  }

  const ringClass =
    phase === 'liveness' ? 'border-warning animate-pulse'
      : phase === 'recognizing' ? 'border-primary animate-pulse'
        : phase === 'success' ? 'border-success'
          : phase === 'error' ? 'border-destructive'
            : faceVisible ? 'border-primary' : 'border-primary/30';

  const overlay = (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className={`h-60 w-48 rounded-[50%] border-2 transition-colors ${ringClass}`} />
    </div>
  );

  const statusLine = () => {
    if (phase === 'liveness' && challenge) {
      return (
        <div className="animate-fade-in flex flex-col items-center gap-1">
          <span className="text-3xl leading-none">{challenge.emoji}</span>
          <span className="text-display text-lg font-bold text-warning">{challenge.text}</span>
        </div>
      );
    }
    if (phase === 'recognizing') {
      return <div className="flex items-center justify-center gap-2 text-sm text-primary"><Loader2 className="size-4 animate-spin" /> Identifying you&hellip;</div>;
    }
    if (phase === 'wait-exit') {
      return <p className="text-sm text-muted-foreground">Ready for the next person &mdash; please step away.</p>;
    }
    if (status === 'loading') {
      return <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Starting face detector&hellip;</div>;
    }
    if (faceVisible) {
      return <div className="flex items-center justify-center gap-2 text-sm text-primary"><UserCheck className="size-4" /> Face detected &mdash; hold still</div>;
    }
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        {status === 'ready'
          ? `Look at the camera to ${checkType === 'check_in' ? 'check in' : 'check out'}`
          : 'Auto-scanning\u2026'}
      </div>
    );
  };

  const showResult = phase === 'success' || phase === 'error';
  const succeeded = phase === 'success' && !!result?.success;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-display inline-flex items-center gap-2 font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ScanFace className="size-4" /></span>Attendance Kiosk
        </span>
        {AdminLink}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl space-y-5">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            <button onClick={() => setCheckType('check_in')} disabled={phase !== 'idle'} className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${checkType === 'check_in' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><LogIn className="size-4" /> Check In</button>
            <button onClick={() => setCheckType('check_out')} disabled={phase !== 'idle'} className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${checkType === 'check_out' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><LogOut className="size-4" /> Check Out</button>
          </div>

          <div className="flex min-h-[3.5rem] items-center justify-center text-center">{showResult ? null : statusLine()}</div>

          <CameraCapture videoRef={camera.videoRef} ready={camera.ready} error={camera.error} overlay={overlay} faceBox={box} className="scan-glow" />

          {showResult && (
            <div className="surface-panel animate-fade-in space-y-2 p-5 text-center">
              {succeeded ? <CheckCircle2 className="mx-auto size-12 text-success" /> : <XCircle className="mx-auto size-12 text-destructive" />}
              <h2 className="text-display text-xl font-bold">
                {succeeded
                  ? `${result?.employee_name ?? 'Verified'} \u2014 ${checkType === 'check_in' ? 'Checked in' : 'Checked out'}`
                  : result?.duplicate
                    ? `Already ${checkType === 'check_in' ? 'checked in' : 'checked out'} today`
                    : (error || result?.message || 'Not recognised')}
              </h2>
              {result?.employee_code && <p className="tnum text-sm text-muted-foreground">ID {result.employee_code}</p>}
              {succeeded && <p className="tnum text-sm text-muted-foreground">{new Date().toLocaleTimeString()}</p>}
            </div>
          )}
        </div>
      </main>

      <footer className="px-6 py-3 text-center text-xs text-muted-foreground">
        {new Date().toLocaleString()} &middot; Biometric data is processed under your organization&rsquo;s consent records.
      </footer>
    </div>
  );
}
