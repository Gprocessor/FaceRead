import { type ReactNode } from 'react';
import { Camera, CameraOff } from 'lucide-react';

/** The <video> is ALWAYS mounted; placeholder is an overlay so the stream always binds. */
export function CameraCapture({ videoRef, ready, error, overlay, className = '' }: {
  videoRef: React.RefObject<HTMLVideoElement>; ready: boolean; error?: string | null; overlay?: ReactNode; className?: string;
}) {
  return (
    <div className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-background border border-border ${ready ? 'scan-glow' : ''} ${className}`}>
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
      {ready && overlay}
      {!ready && (
        <div className="absolute inset-0 grid-blueprint flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background/80">
          {error ? (
            <><CameraOff className="w-10 h-10 text-destructive" /><p className="text-sm text-destructive text-center px-6">{error}</p></>
          ) : (
            <><Camera className="w-10 h-10 text-primary" /><p className="text-sm">Camera is off</p><p className="text-xs">Click "Start Camera" to begin</p></>
          )}
        </div>
      )}
    </div>
  );
}
