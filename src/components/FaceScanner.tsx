import { useCallback, useEffect, useState } from 'react';
import { ScanFace, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { CameraCapture, CameraPlaceholder } from './CameraCapture';
import { getDeviceInfo } from '@/utils/deviceInfo';

interface FaceScannerProps {
  onCapture: (imageBlob: Blob) => Promise<void>;
  title: string;
  subtitle?: string;
  buttonText: string;
  successMessage?: string;
  errorMessage?: string | null;
}

export function FaceScanner({
  onCapture,
  title,
  subtitle,
  buttonText,
  successMessage,
  errorMessage,
}: FaceScannerProps) {
  const camera = useCamera();
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => camera.stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = useCallback(async () => {
    setProcessing(true);
    setError(null);
    try {
      const blob = await camera.captureFrame();
      if (!blob) {
        setError('Failed to capture frame from camera');
        setProcessing(false);
        return;
      }
      await onCapture(blob);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture failed');
    } finally {
      setProcessing(false);
    }
  }, [camera, onCapture]);

  const faceOverlay = (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-48 h-56 rounded-[50%] border-2 border-sky-400/60 shadow-[0_0_30px_rgba(56,189,248,0.2)]" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>

      {camera.ready ? (
        <CameraCapture videoRef={camera.videoRef} overlay={faceOverlay} />
      ) : (
        <CameraPlaceholder error={camera.error} />
      )}

      {done && successMessage && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 justify-center">
          <CheckCircle2 className="w-5 h-5" />
          {successMessage}
        </div>
      )}

      {(error || errorMessage) && (
        <div className="flex items-center gap-2 text-sm text-rose-400 justify-center">
          <XCircle className="w-5 h-5" />
          {error || errorMessage}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {!camera.ready && !camera.error && (
          <button
            onClick={camera.startCamera}
            className="px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 transition-colors"
          >
            Start Camera
          </button>
        )}

        {camera.ready && !done && (
          <button
            onClick={handleCapture}
            disabled={processing}
            className="px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <ScanFace className="w-4 h-4" />
                {buttonText}
              </>
            )}
          </button>
        )}

        {done && (
          <button
            onClick={() => {
              setDone(false);
              setError(null);
            }}
            className="px-5 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-medium text-sm hover:bg-slate-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Device fingerprint: {JSON.stringify(getDeviceInfo()).slice(0, 40)}…
      </p>
    </div>
  );
}
