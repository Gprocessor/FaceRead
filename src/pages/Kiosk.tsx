import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, CheckCircle2, XCircle, Loader2, KeyRound, ScanFace, ShieldCheck } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { CameraCapture } from '@/components/CameraCapture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getDeviceInfo, getLocation } from '@/utils/deviceInfo';
import { getKioskKey, setKioskKey } from '@/services/apiClient';
import { requestKioskLivenessChallenge, type LivenessChallengeResponse } from '@/services/faceService';
import { kioskCheckIn, kioskCheckOut, type CheckInOutResponse } from '@/services/attendanceService';
import { submitKioskLivenessCheck } from '@/services/faceService';
type Phase = 'idle'|'liveness'|'analyzing'|'capturing'|'result';
const RESULT_MS = 5000;
export function Kiosk() {
  const [paired, setPaired] = useState(!!getKioskKey());
  const [keyInput, setKeyInput] = useState(''); const [pairing, setPairing] = useState(false);
  const [checkType, setCheckType] = useState<'check_in'|'check_out'>('check_in');
  const [phase, setPhase] = useState<Phase>('idle');
  const [challenge, setChallenge] = useState<LivenessChallengeResponse | null>(null);
  const [result, setResult] = useState<CheckInOutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useCamera();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (paired) camera.startCamera(); return () => camera.stopCamera(); /* eslint-disable-next-line */ }, [paired]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const startScan = useCallback(async () => { setError(null); setResult(null); try { const ch = await requestKioskLivenessChallenge(); setChallenge(ch); setPhase('liveness'); } catch (err) { setError(err instanceof Error ? err.message : 'Could not start scan'); } }, []);
  const runLivenessThenCheck = useCallback(async () => {
    if (!challenge) return; setPhase('analyzing');
    try {
      const frames = await camera.captureFrames(5, 300);
      const liveness = await submitKioskLivenessCheck(challenge.session_id, challenge.challenge_type, frames, getDeviceInfo());
      if (!liveness.passed) { setError(liveness.failure_reason || 'Liveness check failed, please try again'); setPhase('idle'); return; }
      setPhase('capturing');
      const faceBlob = await camera.captureFrame();
      if (!faceBlob) { setError('Could not capture image'); setPhase('idle'); return; }
      const location = await getLocation();
      const fn = checkType === 'check_in' ? kioskCheckIn : kioskCheckOut;
      const res = await fn(faceBlob, challenge.session_id, getDeviceInfo(), location ?? undefined);
      setResult(res); setPhase('result');
      timer.current = setTimeout(() => { setPhase('idle'); setResult(null); setChallenge(null); }, RESULT_MS);
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong, please try again'); setPhase('idle'); }
  }, [camera, challenge, checkType]);
  const handlePair = async () => { setError(null); const key = keyInput.trim(); if (!key) return; setPairing(true); setKioskKey(key); try { await requestKioskLivenessChallenge(); setPaired(true); } catch { setError('That key was rejected. Check Settings → Kiosk in the admin app.'); } finally { setPairing(false); } };
  const AdminLink = (<Link to="/login" title="Admin login" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><ShieldCheck className="size-3.5" /> Admin</Link>);
  if (!paired) {
    return (<div className="grid-blueprint min-h-screen bg-background flex flex-col"><header className="flex items-center justify-between px-6 py-4"><span className="inline-flex items-center gap-2 text-display font-bold"><span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg"><ScanFace className="size-4" /></span>FaceAttend</span>{AdminLink}</header>
      <div className="flex-1 flex items-center justify-center px-4 pb-16"><div className="surface-panel w-full max-w-md p-6 space-y-4"><div className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /><h1 className="text-display text-lg font-bold">Pair this kiosk</h1></div><p className="text-sm text-muted-foreground">Enter the kiosk key from an admin's <strong>Settings → Kiosk</strong> page. This is only needed once per device.</p><div className="space-y-1.5"><Label htmlFor="kk">Kiosk key</Label><Input id="kk" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Paste kiosk key" /></div>{error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><XCircle className="size-4" />{error}</div>}<Button onClick={handlePair} disabled={pairing} className="w-full">{pairing ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Pair device</Button></div></div></div>);
  }
  const overlay = (<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-48 h-60 border-2 border-primary/70 rounded-[50%]" /></div>);
  const busy = phase === 'liveness' || phase === 'analyzing' || phase === 'capturing';
  return (<div className="min-h-screen bg-background flex flex-col"><header className="flex items-center justify-between px-6 py-4 border-b border-border"><span className="inline-flex items-center gap-2 text-display font-bold"><span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg"><ScanFace className="size-4" /></span>Attendance Kiosk</span>{AdminLink}</header>
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8"><div className="w-full max-w-xl space-y-5">
      <div className="flex gap-1 p-1 bg-muted rounded-lg"><button onClick={() => setCheckType('check_in')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors ${checkType === 'check_in' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><LogIn className="size-4" /> Check In</button><button onClick={() => setCheckType('check_out')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors ${checkType === 'check_out' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><LogOut className="size-4" /> Check Out</button></div>
      <p className="text-center text-sm text-muted-foreground">{phase === 'liveness' ? challenge?.instruction ?? 'Follow the on-screen prompt' : `Look at the camera to ${checkType === 'check_in' ? 'check in' : 'check out'}`}</p>
      <CameraCapture videoRef={camera.videoRef} ready={camera.ready} error={camera.error} overlay={overlay} className="scan-glow" />
      {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><XCircle className="size-4" />{error}</div>}
      {phase === 'result' && result && (<div className="surface-panel p-5 text-center space-y-2">{result.success ? <CheckCircle2 className="size-12 mx-auto text-success" /> : <XCircle className="size-12 mx-auto text-destructive" />}<h2 className="text-display text-xl font-bold">{result.success ? `${result.employee_name ?? 'Verified'} — ${checkType === 'check_in' ? 'Checked in' : 'Checked out'}` : result.duplicate ? 'Already recorded today' : 'Not recognized'}</h2>{result.employee_code && <p className="text-sm text-muted-foreground tnum">ID {result.employee_code}</p>}{!result.success && <p className="text-sm text-muted-foreground">{result.message}</p>}</div>)}
      {phase === 'idle' && <Button size="lg" className="w-full text-base" onClick={startScan} disabled={!camera.ready}><ScanFace className="size-5" /> Scan face</Button>}
      {phase === 'liveness' && <Button size="lg" className="w-full text-base" onClick={runLivenessThenCheck}><ScanFace className="size-5" /> Capture &amp; verify</Button>}
      {busy && phase !== 'liveness' && <Button size="lg" className="w-full text-base" disabled><Loader2 className="size-5 animate-spin" /> {phase === 'analyzing' ? 'Checking liveness…' : 'Verifying…'}</Button>}
      {!camera.ready && !camera.error && <Button variant="secondary" className="w-full" onClick={() => camera.startCamera()}>Start camera</Button>}
    </div></main>
    <footer className="text-muted-foreground text-center text-xs px-6 py-3">{new Date().toLocaleString()} · Biometric data is processed under your organization's consent records.</footer>
  </div>);
}
