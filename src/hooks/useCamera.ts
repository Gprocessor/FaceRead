import { useCallback, useEffect, useRef, useState } from 'react';

export interface CameraState { stream: MediaStream | null; error: string | null; ready: boolean; }

/**
 * Captured frames are downscaled before upload. A kiosk user stands close to
 * the camera, so 640px is plenty for both liveness and recognition, and it cuts
 * JPEG encode time and request size considerably.
 */
const MAX_CAPTURE_WIDTH = 640;
const JPEG_QUALITY = 0.85;

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // One reusable canvas instead of allocating a new one per frame.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream) {
      v.srcObject = stream;
      const play = () => v.play().then(() => setReady(true)).catch(() => setReady(true));
      if (v.readyState >= 1) play(); else v.onloadedmetadata = play;
    } else {
      v.srcObject = null;
      setReady(false);
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
      return s;
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Camera permission denied. Allow camera access in your browser settings.'
        : 'Failed to access camera. Make sure no other app is using it.');
      setReady(false);
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setReady(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return null;

    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const canvas = canvasRef.current;

    const scale = Math.min(1, MAX_CAPTURE_WIDTH / v.videoWidth);
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);

    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY));
  }, []);

  const captureFrames = useCallback(async (n: number, gapMs = 250): Promise<Blob[]> => {
    const out: Blob[] = [];
    for (let i = 0; i < n; i++) {
      const b = await captureFrame();
      if (b) out.push(b);
      if (i < n - 1) await new Promise((r) => setTimeout(r, gapMs));
    }
    return out;
  }, [captureFrame]);

  useEffect(() => () => {
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const state: CameraState = { stream, error, ready };
  return { ...state, videoRef, streamRef, startCamera, stopCamera, captureFrame, captureFrames };
}
