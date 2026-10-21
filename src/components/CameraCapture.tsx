import { type ReactNode } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import type { FaceBox } from '@/hooks/useFaceDetect';

export function CameraCapture({ videoRef, ready, error, overlay, faceBox, className = '' }: {
  videoRef: React.RefObject<HTMLVideoElement>;
  ready: boolean;
  error?: string | null;
  overlay?: ReactNode;
  faceBox?: FaceBox | null;
  className?: string;
}) {
  const v = videoRef.current;
  const vw = v?.videoWidth || 640;
  const vh = v?.videoHeight || 480;

  let boxStyle: React.CSSProperties | null = null;
  if (faceBox && vw && vh) {
    // The preview is mirrored, so mirror the box horizontally too.
    const leftPct = ((vw - faceBox.x - faceBox.width) / vw) * 100;
    boxStyle = {
      left: `${leftPct}%`,
      top: `${(faceBox.y / vh) * 100}%`,
      width: `${(faceBox.width / vw) * 100}%`,
      height: `${(faceBox.height / vh) * 100}%`,
    };
  }

  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black ${className}`}>
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
      {ready && boxStyle && (
        <div className="pointer-events-none absolute rounded-md border-2 border-success transition-all duration-100" style={boxStyle}>
          <span className="absolute -top-5 left-0 rounded bg-success px-1.5 py-0.5 text-[10px] font-semibold text-success-foreground">Face</span>
        </div>
      )}
      {ready && overlay}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/70">
          {error ? (<><CameraOff className="size-8" />{error}</>) : (<><Camera className="size-8" />Starting camera&hellip;</>)}
        </div>
      )}
    </div>
  );
}
