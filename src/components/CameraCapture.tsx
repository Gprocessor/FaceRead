import { useEffect, useRef, type ReactNode } from 'react';
import { Camera, CameraOff } from 'lucide-react';

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
  const containerRef = useRef<HTMLDivElement>(null);

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
      className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      {overlay}
    </div>
  );
}

export function CameraPlaceholder({ error }: { error?: string | null }) {
  return (
    <div className="w-full aspect-[4/3] rounded-xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-3 text-slate-500">
      {error ? (
        <>
          <CameraOff className="w-10 h-10 text-rose-400" />
          <p className="text-sm text-rose-400 text-center px-6">{error}</p>
        </>
      ) : (
        <>
          <Camera className="w-10 h-10" />
          <p className="text-sm">Camera is off</p>
          <p className="text-xs text-slate-600">Click "Start Camera" to begin</p>
        </>
      )}
    </div>
  );
}
