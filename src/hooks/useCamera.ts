import { useCallback, useEffect, useRef, useState } from 'react';
export interface CameraState { stream: MediaStream | null; error: string | null; ready: boolean; }
function toBlob(c: HTMLCanvasElement): Promise<Blob | null> { return new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.85)); }
export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => { const v = videoRef.current; if (!v) return; if (stream) { v.srcObject = stream; const p = () => v.play().then(() => setReady(true)).catch(() => setReady(true)); if (v.readyState >= 1) p(); else v.onloadedmetadata = p; } else { v.srcObject = null; setReady(false); } }, [stream]);
  const startCamera = useCallback(async () => { setError(null); try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); setStream(s); return s; } catch (err) { setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access in your browser settings.' : 'Failed to access camera. Make sure no other app is using it.'); setReady(false); return null; } }, []);
  const stopCamera = useCallback(() => { setStream((p) => { p?.getTracks().forEach((t) => t.stop()); return null; }); }, []);
  const captureFrame = useCallback(async (): Promise<Blob | null> => { const v = videoRef.current; if (!v || !v.videoWidth) return null; const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; const ctx = c.getContext('2d'); if (!ctx) return null; ctx.drawImage(v, 0, 0, c.width, c.height); return toBlob(c); }, []);
  const captureFrames = useCallback(async (n: number, ms = 250): Promise<Blob[]> => { const f: Blob[] = []; for (let i = 0; i < n; i++) { const b = await captureFrame(); if (b) f.push(b); if (i < n - 1) await new Promise((r) => setTimeout(r, ms)); } return f; }, [captureFrame]);
  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); }, []); // eslint-disable-line
  const state: CameraState = { stream, error, ready };
  return { ...state, videoRef, startCamera, stopCamera, captureFrame, captureFrames };
}
