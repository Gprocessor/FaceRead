import { useCallback, useEffect, useState } from 'react';
import { ScanFace, CheckCircle2, XCircle, Loader2, UserCheck } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetect } from '@/hooks/useFaceDetect';
import { CameraCapture } from './CameraCapture';
import { Button } from '@/components/ui/button';

export function FaceScanner({ onCapture, title, subtitle, buttonText, successMessage, errorMessage }: {
  onCapture: (b: Blob) => Promise<void>;
  title: string;
  subtitle?: string;
  buttonText: string;
  successMessage?: string;
  errorMessage?: string | null;
}) {
  const camera = useCamera();
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    camera.startCamera();
    return () => camera.stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Box only - enrollment is always a deliberate click, never auto-triggered.
  const { box, faceVisible } = useFaceDetect(camera.videoRef, { active: false, onReady: () => { /* manual capture */ } });

  const handleCapture = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      const blob = await camera.captureFrame();
      if (!blob) { setError('Failed to capture frame.'); setProcessing(false); return; }
      await onCapture(blob);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setProcessing(false);
    }
  }, [camera, onCapture]);

  const overlay = (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className={`h-52 w-40 rounded-[50%] border-2 transition-colors ${faceVisible ? 'border-primary' : 'border-primary/40'}`} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-display text-lg font-semibold">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <CameraCapture videoRef={camera.videoRef} ready={camera.ready} error={camera.error} overlay={overlay} faceBox={box} />

      {camera.ready && !done && (
        <div className="min-h-5 text-sm">
          {faceVisible
            ? <span className="inline-flex items-center gap-2 text-primary"><UserCheck className="size-4" />Face detected &mdash; ready to capture</span>
            : <span className="text-muted-foreground">Position the face inside the oval&hellip;</span>}
        </div>
      )}

      {done && successMessage && <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="size-4" />{successMessage}</div>}
      {(error || errorMessage) && <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><XCircle className="size-4" />{error || errorMessage}</div>}

      <div className="flex gap-2">
        {!camera.ready && !camera.error && <Button onClick={() => camera.startCamera()}><ScanFace className="size-4" />Start Camera</Button>}
        {camera.ready && !done && (
          <Button onClick={handleCapture} disabled={processing || !faceVisible}>
            {processing ? <><Loader2 className="size-4 animate-spin" />Processing&hellip;</> : <><ScanFace className="size-4" />{buttonText}</>}
          </Button>
        )}
        {done && <Button variant="secondary" onClick={() => { setDone(false); setError(null); }}>Try Again</Button>}
      </div>
    </div>
  );
}
