import { useCallback, useRef, useState } from 'react';

export interface CameraState {
  stream: MediaStream | null;
  error: string | null;
  ready: boolean;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
  });
}

export function useCamera() {
  const [state, setState] = useState<CameraState>({
    stream: null,
    error: null,
    ready: false,
  });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState({ stream, error: null, ready: true });
      return stream;
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Failed to access camera. Make sure no other app is using it.';
      setState({ stream: null, error: msg, ready: false });
      return null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    setState((prev) => {
      prev.stream?.getTracks().forEach((t) => t.stop());
      return { stream: null, error: null, ready: false };
    });
  }, []);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !state.ready) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvasToBlob(canvas);
  }, [state.ready]);

  const captureFrames = useCallback(
    async (count: number, intervalMs: number = 250): Promise<Blob[]> => {
      const frames: Blob[] = [];
      for (let i = 0; i < count; i++) {
        const blob = await captureFrame();
        if (blob) frames.push(blob);
        if (i < count - 1) {
          await new Promise((r) => setTimeout(r, intervalMs));
        }
      }
      return frames;
    },
    [captureFrame]
  );

  return { ...state, videoRef, startCamera, stopCamera, captureFrame, captureFrames };
}
