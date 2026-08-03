import { type ReactNode } from 'react';
import { Camera, CameraOff } from 'lucide-react';

interface CameraCaptureProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  ready: boolean;
  error?: string | null;
  overlay?: ReactNode;
  className?: string;
}

/**
 * The <video> element is ALWAYS rendered (never conditionally unmounted),
 * so the stream attached in useCamera's effect always has a real element to
 * bind to. When the camera isn't ready yet we show a placeholder layer on top.
 */
export function CameraCapture({
  videoRef,
  ready,
  error,
  overlay,
  className = '',
}: CameraCaptureProps) {
  return (
    <div
      className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Face oval / instruction overlay */}
      {ready && overlay}

      {/* Placeholder shown until the stream is live */}
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500 bg-slate-900/80">
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
      )}
    </div>
  );
}
