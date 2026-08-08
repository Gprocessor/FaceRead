import { useCallback, useEffect, useState } from 'react';
import { Eye, ArrowLeft, ArrowRight, Smile, ScanFace, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useLiveness } from '@/hooks/useLiveness';
import { CameraCapture } from './CameraCapture';
import { getDeviceInfo } from '@/utils/deviceInfo';
import { Button } from '@/components/ui/button';
const META: Record<string, { icon: typeof Eye; instruction: string; description: string }> = {
  BLINK: { icon: Eye, instruction: 'Blink your eyes', description: 'Blink naturally 2-3 times for the camera' },
  TURN_HEAD_LEFT: { icon: ArrowLeft, instruction: 'Turn your head left', description: 'Slowly turn your head to the left, then back to center' },
  TURN_HEAD_RIGHT: { icon: ArrowRight, instruction: 'Turn your head right', description: 'Slowly turn your head to the right, then back to center' },
  LOOK_STRAIGHT: { icon: ScanFace, instruction: 'Look straight ahead', description: 'Keep your face centered and look directly at the camera' },
  SMILE: { icon: Smile, instruction: 'Smile', description: 'Give the camera a natural smile' },
};
export function LivenessChallenge({ onComplete }: { onComplete: (sessionId: string) => void }) {
  const { phase, challenge, result, error, camera, startChallenge, submitFrames } = useLiveness();
  const [capturing, setCapturing] = useState(false);
  useEffect(() => { startChallenge(); camera.startCamera(); return () => camera.stopCamera(); /* eslint-disable-next-line */ }, []);
  const handleCaptureAndSubmit = useCallback(async () => { setCapturing(true); const frames = await camera.captureFrames(5, 300); await submitFrames(frames, getDeviceInfo()); setCapturing(false); }, [camera, submitFrames]);
  const handleDone = useCallback(() => { if (result?.passed && challenge) onComplete(challenge.session_id); }, [result, challenge, onComplete]);
  if (phase === 'done' && result) { const Icon = result.passed ? CheckCircle2 : XCircle; return (<div className="space-y-4 text-center"><Icon className={`w-14 h-14 mx-auto ${result.passed ? 'text-success' : 'text-destructive'}`} /><h3 className="text-lg font-semibold text-display">{result.passed ? 'Liveness Verified' : 'Verification Failed'}</h3><p className="text-sm text-muted-foreground">Score: {(result.liveness_score * 100).toFixed(1)}%</p>{result.failure_reason && <p className="text-sm text-destructive">{result.failure_reason}</p>}{result.passed ? <Button onClick={handleDone}>Continue</Button> : <Button variant="secondary" onClick={startChallenge}>Try Again</Button>}</div>); }
  const meta = challenge ? META[challenge.challenge_type] : null; const Icon = meta?.icon ?? ScanFace;
  return (<div className="space-y-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Liveness Check</p><h3 className="text-lg font-semibold text-display">{meta?.instruction ?? 'Preparing challenge…'}</h3></div></div><p className="text-sm text-muted-foreground">{meta?.description}</p>
    <CameraCapture videoRef={camera.videoRef} ready={camera.ready} error={camera.error} overlay={<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-40 h-52 border-2 border-primary/70 rounded-[50%]" /></div>} />
    {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><XCircle className="w-4 h-4" />{error}</div>}
    <div className="flex gap-2">{!camera.ready && !camera.error && <Button onClick={() => camera.startCamera()}><ScanFace className="w-4 h-4" />Start Camera</Button>}{camera.ready && challenge && <Button onClick={handleCaptureAndSubmit} disabled={capturing || phase === 'analyzing'}>{capturing || phase === 'analyzing' ? <><Loader2 className="w-4 h-4 animate-spin" />{capturing ? 'Capturing…' : 'Analyzing…'}</> : <><ScanFace className="w-4 h-4" />Capture &amp; Verify</>}</Button>}</div></div>);
}
