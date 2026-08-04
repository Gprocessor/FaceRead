import { useCallback, useEffect, useState } from 'react';
import { ScanFace, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { CameraCapture } from './CameraCapture';
import { getDeviceInfo } from '@/utils/deviceInfo';

interface FaceScannerProps {
  onCapture: (imageBlob: Blob) => Promise<void>;
  title: string; subtitle?: string; buttonText: string;
  successMessage?: string; errorMessage?: string | null;
}

export function FaceScanner({ onCapture, title, subtitle, buttonText, successMessage, errorMessage }: FaceScannerProps) {
  const camera = useCamera();
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { camera.startCamera(); return () => camera.stopCamera(); /* eslint-disable-next-line */ }, []);

  const handleCapture = useCallback(async () => {
    setProcessing(true); setError(null);
    try {
      const blob = await camera.captureFrame();
      if (!blob) { setError('Failed to capture frame. Make sure the camera preview is visible.'); setProcessing(false); return; }
      await onCapture(blob);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed');
    } finally { setProcessing(false); }
  }, [camera, onCapture]);

  const overlay = (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-40 h-52 border-2 border-sky-400/60 rounded-[50%]" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      <CameraCapture videoRef={camera.videoRef} ready={camera.ready} error={camera.error} overlay={overlay} />
      {done && successMessage && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg p-3"><CheckCircle2 className="w-4 h-4" />{successMessage}</div>
      )}
      {(error || errorMessage) && (
        <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 rounded-lg p-3"><XCircle className="w-4 h-4" />{error || errorMessage}</div>
      )}
      <div className="flex gap-2">
        {!camera.ready && !camera.error && (
          <button onClick={() => camera.startCamera()} className="px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 transition-colors flex items-center gap-2"><ScanFace className="w-4 h-4" />Start Camera</button>
        )}
        {camera.ready && !done && (
          <button onClick={handleCapture} disabled={processing} className="px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 disabled:opacity-50 transition-colors flex items-center gap-2">
            {processing ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</> : <><ScanFace className="w-4 h-4" />{buttonText}</>}
          </button>
        )}
        {done && (
          <button onClick={() => { setDone(false); setError(null); }} className="px-5 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-medium text-sm hover:bg-slate-700 transition-colors">Try Again</button>
        )}
      </div>
      <p className="text-[11px] text-slate-600">Device fingerprint: {JSON.stringify(getDeviceInfo()).slice(0, 40)}…</p>
    </div>
  );
}
