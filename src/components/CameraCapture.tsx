import { type CSSProperties, type ReactNode, type RefObject } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import type { FaceBox } from '@/hooks/useFaceDetect';

export type FrameState = 'idle' | 'detected' | 'liveness' | 'recognizing' | 'success' | 'error';

const FRAME_COLOR: Record<FrameState, string> = {
  idle: 'var(--border)',
  detected: 'var(--primary)',
  liveness: 'var(--warning)',
  recognizing: 'var(--primary)',
  success: 'var(--success)',
  error: 'var(--destructive)',
};

/**
 * The whole camera box is the detection area: no oval to line up with.
 * State is shown by the colour of the frame border and its corner brackets.
 */
export function CameraCapture({
  videoRef, ready, error, faceBox, frameState = 'idle', banner, overlay, className = '',
}: {
  videoRef: RefObject<HTMLVideoElement>;
  ready: boolean;
  error?: string | null;
  faceBox?: FaceBox | null;
  frameState?: FrameState;
  banner?: ReactNode;
  overlay?: ReactNode;
  className?: string;
}) {
  const v = videoRef.current;
  const vw = v?.videoWidth || 640;
  const vh = v?.videoHeight || 480;

  let boxStyle: CSSProperties | null = null;
  if (faceBox && vw && vh) {
    boxStyle = {
      left: `${((vw - faceBox.x - faceBox.width) / vw) * 100}%`, // mirrored
      top: `${(faceBox.y / vh) * 100}%`,
      width: `${(faceBox.width / vw) * 100}%`,
      height: `${(faceBox.height / vh) * 100}%`,
    };
  }

  const color = FRAME_COLOR[frameState];
  const pulsing = frameState === 'liveness' || frameState === 'recognizing';
  const corner = 'absolute w-10 h-10 border-[5px] transition-colors duration-200';

  return (
    <div
      className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-background transition-colors duration-200 select-none ${className}`}
      style={{ border: `4px solid ${color}` }}
    >
      {/* pointer-events-none + disablePictureInPicture stop the browser's video hover controls appearing */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
        className="w-full h-full object-cover pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />
      {/* transparent shield above the video so nothing on hover reaches it */}
      <div className="absolute inset-0" />

      {ready && (
        <>
          <span className={`${corner} top-2 left-2 border-r-0 border-b-0 rounded-tl-lg ${pulsing ? 'animate-pulse' : ''}`} style={{ borderColor: color }} />
          <span className={`${corner} top-2 right-2 border-l-0 border-b-0 rounded-tr-lg ${pulsing ? 'animate-pulse' : ''}`} style={{ borderColor: color }} />
          <span className={`${corner} bottom-2 left-2 border-r-0 border-t-0 rounded-bl-lg ${pulsing ? 'animate-pulse' : ''}`} style={{ borderColor: color }} />
          <span className={`${corner} bottom-2 right-2 border-l-0 border-t-0 rounded-br-lg ${pulsing ? 'animate-pulse' : ''}`} style={{ borderColor: color }} />
        </>
      )}

      {ready && boxStyle && (
        <div className="absolute rounded-lg border-2 transition-all duration-100 pointer-events-none" style={{ ...boxStyle, borderColor: color }} />
      )}

      {ready && overlay}

      {ready && banner && (
        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 via-black/45 to-transparent text-white text-center pointer-events-none">
          {banner}
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 grid-blueprint flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background/80">
          {error ? (
            <><CameraOff className="w-10 h-10 text-destructive" /><p className="text-sm text-destructive text-center px-6">{error}</p></>
          ) : (
            <><Camera className="w-10 h-10 text-primary" /><p className="text-sm">Camera is off</p><p className="text-xs">Starting&hellip;</p></>
          )}
        </div>
      )}
    </div>
  );
}
