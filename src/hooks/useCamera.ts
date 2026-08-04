import { useCallback, useEffect, useRef, useState } from 'react';

export interface CameraState {
  stream: MediaStream | null;
  error: string | null;
  ready: boolean;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85));
}

/**
 * FIX: The <video> element (in CameraCapture) is ALWAYS mounted. We attach the
 * stream via a useEffect keyed on `stream`, so srcObject is never set on an
 * element that hasn't rendered yet — the previous cause of the black feed.
 */
export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (stream) {
      v.srcObject = stream;
      const tryPlay = () => v.play().then(() => setReady(true)).catch(() => setReady(true));
      if (v.readyState >= 1) tryPlay();
      else v.onloadedmetadata = tryPlay;
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
      setStream(s);
      return s;
    } catch (err) {
      const msg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access in your browser settings.'
        : 'Failed to access camera. Make sure no other app is using it.';
      setError(msg);
      setReady(false);
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    setStream((prev) => { prev?.getTracks().forEach((t) => t.stop()); return null; });
  }, []);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvasToBlob(canvas);
  }, []);

  const captureFrames = useCallback(async (count: number, intervalMs = 250): Promise<Blob[]> => {
    const frames: Blob[] = [];
    for (let i = 0; i < count; i++) {
      const blob = await captureFrame();
      if (blob) frames.push(blob);
      if (i < count - 1) await new Promise((r) => setTimeout(r, intervalMs));
    }
    return frames;
  }, [captureFrame]);

  useEffect(() => () => { stream?.getTracks().forEach((t) => t.stop()); }, []); // eslint-disable-line

  const state: CameraState = { stream, error, ready };
  return { ...state, videoRef, startCamera, stopCamera, captureFrame, captureFrames };
}
