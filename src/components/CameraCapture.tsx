import { useEffect, useRef, type ReactNode } from 'react';
import { Camera, CameraOff, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onReady?: () => void;
  overlay?: ReactNode;
  className?: string;
}

export function CameraCapture({
  videoRef,
  onReady,
  overlay,
  className = '',
}: CameraCaptureProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleLoaded = () => onReady?.();
    v.addEventListener('loadedmetadata', handleLoaded);
    return () => v.removeEventListener('loadedmetadata', handleLoaded);
  }, [videoRef, onReady]);

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video w-full max-w-md mx-auto rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover -scale-x-100"
      />
      {overlay}
    </div>
  );
}

export function CameraPlaceholder({ error }: { error?: string | null }) {
  return (
    <div className="aspect-video w-full max-w-md mx-auto rounded-2xl bg-slate-900 border border-slate-700 flex flex-col items-center justify-center text-slate-500">
      {error ? (
        <>
          <AlertCircle className="w-10 h-10 mb-3 text-rose-400" />
          <p className="text-sm text-rose-400 text-center px-4">{error}</p>
        </>
      ) : (
        <>
          <CameraOff className="w-10 h-10 mb-3" />
          <p className="text-sm">Camera is off</p>
          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
            <Camera className="w-3 h-3" /> Click "Start Camera" to begin
          </p>
        </>
      )}
    </div>
  );
}
