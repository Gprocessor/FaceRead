import { type ReactNode } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import type { FaceBox } from '@/hooks/useFaceDetect';
export function CameraCapture({ videoRef, ready, error, overlay, faceBox, className = '' }: { videoRef: React.RefObject<HTMLVideoElement>; ready: boolean; error?: string | null; overlay?: ReactNode; faceBox?: FaceBox | null; className?: string }) {
  const v = videoRef.current; const vw = v?.videoWidth || 640, vh = v?.videoHeight || 480;
  let boxStyle: React.CSSProperties | null = null;
  if (faceBox && vw && vh) { const leftPct = ((vw - faceBox.x - faceBox.width) / vw) * 100; boxStyle = { left: `${leftPct}%`, top: `${(faceBox.y / vh) * 100}%`, width: `${(faceBox.width / vw) * 100}%`, height: `${(faceBox.height / vh) * 100}%` }; }
  return (
    <div className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-background border border-border ${ready ? 'scan-glow' : ''} ${className}`}>
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
      {ready && boxStyle && (<div className="absolute rounded-lg border-2 border-primary transition-all duration-100" style={boxStyle}><span className="absolute -top-6 left-0 rounded bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5">Face</span></div>)}
      {ready && overlay}
      {!ready && (<div className="absolute inset-0 grid-blueprint flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background/80">{error ? (<><CameraOff className="w-10 h-10 text-destructive" /><p className="text-sm text-destructive text-center px-6">{error}</p></>) : (<><Camera className="w-10 h-10 text-primary" /><p className="text-sm">Camera is off</p><p className="text-xs">Starting…</p></>)}</div>)}
    </div>
  );
}
