import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, CheckCircle2, XCircle, Loader2, KeyRound, ScanFace, ShieldCheck } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetect } from '@/hooks/useFaceDetect';
import { CameraCapture, type FrameState } from '@/components/CameraCapture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDeviceInfo, getLocation } from '@/utils/deviceInfo';
import { getKioskKey, setKioskKey } from '@/services/apiClient';
import { requestKioskLivenessChallenge, submitKioskLivenessCheck } from '@/services/faceService';
import { kioskCheckIn, kioskCheckOut, type CheckInOutResponse } from '@/services/attendanceService';

type Phase = 'idle' | 'liveness' | 'recognizing' | 'success' | 'error' | 'wait-exit';

const RESULT_MS = 3000;
const STABLE_MS = 600;
const COOLDOWN_MS = 3000;
const WAIT_EXIT_MAX_MS = 12000;
// Time to read the instruction before frames are captured. Before this,
// capture started instantly, so frames were taken before the person moved.
const LEAD_IN_MS = 900;
// One automatic retry with a new challenge before showing an error.
const MAX_LIVENESS_ATTEMPTS = 2;

// Turns are captured over ~1.6s so the whole movement (out and back) is recorded.
const CAPTURE_PROFILE: Record<string, { frames: number; gapMs: number }> = {
  BLINK: { frames: 8, gapMs: 120 },
  TURN_HEAD_LEFT: { frames: 8, gapMs: 200 },
  TURN_HEAD_RIGHT: { frames: 8, gapMs: 200 },
  LOOK_STRAIGHT: { frames: 4, gapMs: 200 },
  SMILE: { frames: 6, gapMs: 200 },
};
const DEFAULT_PROFILE = { frames: 6, gapMs: 200 };

const CHALLENGE_UI: Record<string, { emoji: string; text: string; hint: string }> = {
  BLINK: { emoji: '\u{1F441}\uFE0F', text: 'Blink your eyes', hint: 'One or two natural blinks' },
  TURN_HEAD_LEFT: { emoji: '\u2B05\uFE0F', text: 'Turn your head left', hint: 'Turn, then come back to the centre' },
  TURN_HEAD_RIGHT: { emoji: '\u27A1\uFE0F', text: 'Turn your head right', hint: 'Turn, then come back to the centre' },
  LOOK_STRAIGHT: { emoji: '\u{1F642}', text: 'Look straight at the camera', hint: 'Hold still' },
  SMILE: { emoji: '\u{1F60A}', text: 'Give a small smile', hint: 'Keep looking at the camera' },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Kiosk() {
  const [paired, setPaired] = useState(!!getKioskKey());
  const [keyInput, setKeyInput] = useState('');
  const [pairing, setPairing] = useState(false);
  const [checkType, setCheckType] = useState<'check_in' | 'check_out'>('check_in');
  const [phase, setPhase] = useState<Phase>('idle');
  const [challenge, setChallenge] = useState<{ emoji: string; text: string; hint: string } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [attemptNote, setAttemptNote] = useState<string | null>(null);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { clearTimers(); camera.stopCamera(); }, []);

  /** Runs one liveness challenge; returns the passed session id or throws. */
  const passLiveness = useCallback(async (): Promise<string> => {
    let lastReason = 'Liveness check failed';
    for (let attempt = 1; attempt <= MAX_LIVENESS_ATTEMPTS; attempt++) {
      setAttemptNote(attempt > 1 ? "Let's try once more" : null);
      const ch = await requestKioskLivenessChallenge();
      setChallenge(CHALLENGE_UI[ch.challenge_type] ?? { emoji: '\u{1F642}', text: ch.instruction, hint: '' });
      setCapturing(false);
      await sleep(LEAD_IN_MS);
      setCapturing(true);
      const profile = CAPTURE_PROFILE[ch.challenge_type] ?? DEFAULT_PROFILE;
      const frames = await camera.captureFrames(profile.frames, profile.gapMs);
      setCapturing(false);
      if (!frames.length) throw new Error('Could not read from the camera');
      const res = await submitKioskLivenessCheck(ch.session_id, ch.challenge_type, frames, getDeviceInfo());
      if (res.passed) return ch.session_id;
      lastReason = res.failure_reason || lastReason;
    }
    throw new Error(lastReason);
  }, [camera]);

  const runScan = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    clearTimers();
    setError(null);
    setResult(null);
    try {
      setPhase('liveness');
      const sessionId = await passLiveness();

      setPhase('recognizing');
      setChallenge(null);
      setAttemptNote(null);
      const faceBlob = await camera.captureFrame();
      if (!faceBlob) throw new Error('Could not capture image');
      const location = await getLocation();
      const submit = checkTypeRef.current === 'check_in' ? kioskCheckIn : kioskCheckOut;
      const res = await submit(faceBlob, sessionId, getDeviceInfo(), location ?? undefined);
      setResult(res);
      setPhase(res.success || res.duplicate ? 'success' : 'error');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setResult(null);
      setPhase('error');
    } finally {
      setChallenge(null);
      setCapturing(false);
      setAttemptNote(null);
      resultTimer.current = setTimeout(() => setPhase('wait-exit'), RESULT_MS);
      busyRef.current = false;
    }
  }, [camera, passLiveness]);

  const { box, status, faceVisible, armCooldown } = useFaceDetect(camera.videoRef, {
    active: paired && camera.ready && phase === 'idle',
    onReady: runScan,
    stableMs: STABLE_MS,
    cooldownMs: COOLDOWN_MS,
  });

  // Wait for the person to step away before re-arming.
  useEffect(() => {
    if (phase !== 'wait-exit') return;
    const reset = () => { armCooldown(); setResult(null); setError(null); setPhase('idle'); };
    if (!faceVisible) { reset(); return; }
    exitTimer.current = setTimeout(reset, WAIT_EXIT_MAX_MS);
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
    <Link to="/login" title="Admin" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
      <ShieldCheck className="size-3.5" /> Admin
    </Link>
  );

  if (!paired) {
    return (
      <div className="grid-blueprint min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-6 py-4">
          <span className="inline-flex items-center gap-2 text-display font-bold"><span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg"><ScanFace className="size-4" /></span>FaceAttend</span>
          {AdminLink}
        </header>
        <div className="flex-1 flex items-center justify-center px-4 pb-16">
          <div className="surface-panel w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /><h1 className="text-display text-lg font-bold">Pair this kiosk</h1></div>
            <p className="text-sm text-muted-foreground">Enter the kiosk key from an admin&rsquo;s <strong>Settings &rarr; Kiosk</strong> page. Needed once per device.</p>
            <div className="space-y-1.5"><Label htmlFor="kk">Kiosk key</Label><Input id="kk" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Paste kiosk key" /></div>
            {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><XCircle className="size-4" />{error}</div>}
            <Button onClick={handlePair} disabled={pairing} className="w-full">{pairing ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Pair device</Button>
          </div>
        </div>
      </div>
    );
  }

  const frameState: FrameState = phase === 'liveness' ? 'liveness'
    : phase === 'recognizing' ? 'recognizing'
      : phase === 'success' ? 'success'
        : phase === 'error' ? 'error'
          : faceVisible ? 'detected' : 'idle';

  // Instructions live INSIDE the camera box, where the person is looking.
  let banner: ReactNode = null;
  if (phase === 'liveness' && challenge) {
    banner = (
      <div className="animate-fade-in space-y-1">
        {attemptNote && <p className="text-xs font-medium text-amber-200">{attemptNote}</p>}
        <p className="text-4xl leading-none">{challenge.emoji}</p>
        <p className="text-display text-2xl font-bold">{challenge.text}</p>
        <p className="text-sm opacity-90">{capturing ? 'Now!' : challenge.hint || 'Get ready\u2026'}</p>
      </div>
    );
  } else if (phase === 'liveness') {
    banner = <p className="inline-flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Getting ready&hellip;</p>;
  } else if (phase === 'recognizing') {
    banner = <p className="inline-flex items-center gap-2 text-base font-medium"><Loader2 className="size-4 animate-spin" /> Identifying you&hellip;</p>;
  } else if (phase === 'wait-exit') {
    banner = <p className="text-sm">Ready for the next person &mdash; please step away</p>;
  } else if (phase === 'idle') {
    banner = status === 'loading'
      ? <p className="inline-flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Starting face detector&hellip;</p>
      : <p className="text-base font-medium">{faceVisible ? 'Face detected \u2014 hold still' : `Look at the camera to ${checkType === 'check_in' ? 'check in' : 'check out'}`}</p>;
  }

  const showResult = phase === 'success' || phase === 'error';
  const succeeded = phase === 'success' && !!result?.success;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="inline-flex items-center gap-2 text-display font-bold"><span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg"><ScanFace className="size-4" /></span>Attendance Kiosk</span>
        {AdminLink}
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl space-y-5">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button onClick={() => setCheckType('check_in')} disabled={phase !== 'idle'} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors disabled:opacity-60 ${checkType === 'check_in' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><LogIn className="size-4" /> Check In</button>
            <button onClick={() => setCheckType('check_out')} disabled={phase !== 'idle'} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors disabled:opacity-60 ${checkType === 'check_out' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><LogOut className="size-4" /> Check Out</button>
          </div>

          <CameraCapture videoRef={camera.videoRef} ready={camera.ready} error={camera.error} faceBox={box} frameState={frameState} banner={showResult ? null : banner} />

          {showResult && (
            <div className="surface-panel p-5 text-center space-y-2 animate-fade-in">
              {succeeded ? <CheckCircle2 className="size-12 mx-auto text-success" /> : <XCircle className="size-12 mx-auto text-destructive" />}
              <h2 className="text-display text-xl font-bold">
                {succeeded
                  ? `${result?.employee_name ?? 'Verified'} \u2014 ${checkType === 'check_in' ? 'Checked in' : 'Checked out'}`
                  : result?.duplicate ? `Already ${checkType === 'check_in' ? 'checked in' : 'checked out'} today` : (error || result?.message || 'Not recognised')}
              </h2>
              {result?.employee_code && <p className="text-sm text-muted-foreground tnum">{result.id_label ?? 'ID'} {result.employee_code}</p>}
              {succeeded && <p className="text-sm text-muted-foreground tnum">{new Date().toLocaleTimeString()}</p>}
            </div>
          )}
        </div>
      </main>
      <footer className="text-muted-foreground text-center text-xs px-6 py-3">{new Date().toLocaleString()} &middot; Biometric data is processed under your organization&rsquo;s consent records.</footer>
    </div>
  );
}
