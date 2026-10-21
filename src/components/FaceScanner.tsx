import { useCallback, useEffect, useState } from 'react';
import { ScanFace, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetect } from '@/hooks/useFaceDetect';
import { CameraCapture } from './CameraCapture';
import { Button } from '@/components/ui/button';

export function FaceScanner({ onCapture, title, subtitle, buttonText, successMessage, errorMessage }: {
  onCapture: (b: Blob) => Promise<void>; title: string; subtitle?: string; buttonText: string;
  successMessage?: string; errorMessage?: string | null;
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

  const { box, faceVisible } = useFaceDetect(camera.videoRef, { active: false, onReady: () => { /* manual capture */ } });

  const handleCapture = useCallback(async () => {
    setProcessing(true); setError(null);
    try {
      const blob = await camera.captureFrame();
      if (!blob) { setError('Failed to capture frame.'); return; }
      await onCapture(blob);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setProcessing(false);
    }
  }, [camera, onCapture]);

  const frameState = done ? 'success' : (error || errorMessage) ? 'error' : processing ? 'recognizing' : faceVisible ? 'detected' : 'idle';
  const banner = done ? null
    : processing ? <p className="inline-flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Processing&hellip;</p>
      : <p className="text-sm font-medium">{faceVisible ? 'Face detected \u2014 ready to capture' : 'Look straight at the camera'}</p>;

  return (
    <div className="space-y-4">
      <div><h3 className="text-lg font-semibold text-display">{title}</h3>{subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}</div>
      <CameraCapture videoRef={camera.videoRef} ready={camera.ready} error={camera.error} faceBox={box} frameState={frameState} banner={banner} />
      {done && successMessage && <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg p-3"><CheckCircle2 className="w-4 h-4" />{successMessage}</div>}
      {(error || errorMessage) && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><XCircle className="w-4 h-4" />{error || errorMessage}</div>}
      <div className="flex gap-2">
        {!camera.ready && !camera.error && <Button onClick={() => camera.startCamera()}><ScanFace className="w-4 h-4" />Start Camera</Button>}
        {camera.ready && !done && (
          <Button onClick={handleCapture} disabled={processing || !faceVisible}>
            {processing ? <><Loader2 className="w-4 h-4 animate-spin" />Processing&hellip;</> : <><ScanFace className="w-4 h-4" />{buttonText}</>}
          </Button>
        )}
        {done && <Button variant="secondary" onClick={() => { setDone(false); setError(null); }}>Try Again</Button>}
      </div>
    </div>
  );
}
