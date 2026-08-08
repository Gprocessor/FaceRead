import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, CheckCircle2, XCircle, Loader2, KeyRound, ScanFace, ShieldCheck } from 'lucide-react';
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
type Phase = 'scanning'|'working'|'result';
const RESULT_MS = 4000;
export function Kiosk() {
  const [paired, setPaired] = useState(!!getKioskKey());
  const [keyInput, setKeyInput] = useState(''); const [pairing, setPairing] = useState(false);
  const [checkType, setCheckType] = useState<'check_in'|'check_out'>('check_in');
  const [phase, setPhase] = useState<Phase>('scanning');
  const [result, setResult] = useState<CheckInOutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState('Look at the camera to check in');
  const camera = useCamera();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  useEffect(() => { if (paired) camera.startCamera(); return () => camera.stopCamera(); /* eslint-disable-next-line */ }, [paired]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); camera.stopCamera(); /* eslint-disable-next-line */ }, []);
  const runOnce = useCallback(async () => {
    if (busyRef.current) return; busyRef.current = true; setPhase('working'); setError(null); setHint('Hold still…');
    try {
      const ch = await requestKioskLivenessChallenge(); setHint(ch.instruction);
      const frames = await camera.captureFrames(5, 250);
      const liveness = await submitKioskLivenessCheck(ch.session_id, ch.challenge_type, frames, getDeviceInfo());
      if (!liveness.passed) throw new Error(liveness.failure_reason || 'Liveness failed — please try again');
      const faceBlob = await camera.captureFrame(); if (!faceBlob) throw new Error('Could not capture image');
      const location = await getLocation();
      const fn = checkType === 'check_in' ? kioskCheckIn : kioskCheckOut;
      const res = await fn(faceBlob, ch.session_id, getDeviceInfo(), location ?? undefined);
      setResult(res); setPhase('result');
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong'); setResult(null); setPhase('result'); }
    finally { timer.current = setTimeout(() => { setPhase('scanning'); setResult(null); setError(null); setHint(`Look at the camera to ${checkType === 'check_in' ? 'check in' : 'check out'}`); armCooldown(); busyRef.current = false; }, RESULT_MS); }
  }, [camera, checkType]);
  const { box, status, armCooldown } = useFaceDetect(camera.videoRef, { enabled: paired && camera.ready && phase === 'scanning', onReady: runOnce, cooldownMs: 5000, stableMs: 700 });
  const handlePair = async () => { setError(null); const key = keyInput.trim(); if (!key) return; setPairing(true); setKioskKey(key); try { await requestKioskLivenessChallenge(); setPaired(true); } catch { setError('That key was rejected. Check Settings → Kiosk in the admin app.'); } finally { setPairing(false); } };
  const AdminLink = (<Link to="/login" title="Admin" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><ShieldCheck className="size-3.5" /> Admin</Link>);
  if (!paired) return (<div className="grid-blueprint min-h-screen bg-background flex flex-col"><header className="flex items-center justify-between px-6 py-4"><span className="inline-flex items-center gap-2 text-display font-bold"><span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg"><ScanFace className="size-4" /></span>FaceAttend</span>{AdminLink}</header><div className="flex-1 flex items-center justify-center px-4 pb-16"><div className="surface-panel w-full max-w-md p-6 space-y-4"><div className="flex items-center gap-2"><KeyRound className="size-5 text-primary" /><h1 className="text-display text-lg font-bold">Pair this kiosk</h1></div><p className="text-sm text-muted-foreground">Enter the kiosk key from an admin's <strong>Settings → Kiosk</strong> page. Needed once per device.</p><div className="space-y-1.5"><Label htmlFor="kk">Kiosk key</Label><Input id="kk" type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Paste kiosk key" /></div>{error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><XCircle className="size-4" />{error}</div>}<Button onClick={handlePair} disabled={pairing} className="w-full">{pairing ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Pair device</Button></div></div></div>);
  const overlay = (<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className={`w-48 h-60 rounded-[50%] border-2 ${phase === 'working' ? 'border-primary animate-pulse' : 'border-primary/30'}`} /></div>);
  return (<div className="min-h-screen bg-background flex flex-col">
    <header className="flex items-center justify-between px-6 py-4 border-b border-border"><span className="inline-flex items-center gap-2 text-display font-bold"><span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg"><ScanFace className="size-4" /></span>Attendance Kiosk</span>{AdminLink}</header>
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-8"><div className="w-full max-w-xl space-y-5">
      <div className="flex gap-1 p-1 bg-muted rounded-lg"><button onClick={() => { setCheckType('check_in'); setHint('Look at the camera to check in'); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors ${checkType === 'check_in' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><LogIn className="size-4" /> Check In</button><button onClick={() => { setCheckType('check_out'); setHint('Look at the camera to check out'); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-md transition-colors ${checkType === 'check_out' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}><LogOut className="size-4" /> Check Out</button></div>
      <p className="text-center text-sm text-muted-foreground min-h-5">{phase === 'result' ? '' : hint}</p>
      <CameraCapture videoRef={camera.videoRef} ready={camera.ready} error={camera.error} overlay={overlay} faceBox={box} className="scan-glow" />
      {phase === 'scanning' && (<div className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><span className="relative flex size-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" /><span className="relative inline-flex rounded-full size-2 bg-primary" /></span>{status === 'ready' ? 'Waiting for a face…' : status === 'loading' ? 'Loading face detector…' : 'Auto-scanning…'}</div>)}
      {phase === 'working' && (<div className="flex items-center justify-center gap-2 text-sm text-primary"><Loader2 className="size-4 animate-spin" /> Verifying…</div>)}
      {phase === 'result' && (<div className="surface-panel p-5 text-center space-y-2 animate-fade-in">{result?.success ? <CheckCircle2 className="size-12 mx-auto text-success" /> : <XCircle className="size-12 mx-auto text-destructive" />}<h2 className="text-display text-xl font-bold">{result?.success ? `${result.employee_name ?? 'Verified'} — ${checkType === 'check_in' ? 'Checked in' : 'Checked out'}` : result?.duplicate ? 'Already recorded today' : (error || 'Not recognized')}</h2>{result?.employee_code && <p className="text-sm text-muted-foreground tnum">ID {result.employee_code}</p>}</div>)}
    </div></main>
    <footer className="text-muted-foreground text-center text-xs px-6 py-3">{new Date().toLocaleString()} · Biometric data is processed under your organization's consent records.</footer>
  </div>);
}
