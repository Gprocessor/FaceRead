import { useEffect, useRef, useState } from 'react';
export interface FaceBox { x: number; y: number; width: number; height: number; }

/**
 * Cross-browser face detection using MediaPipe Tasks Vision (WebAssembly).
 * Draws a live bounding box and provides a hands-free "face is ready" trigger
 * used by the kiosk to AUTO-SCAN (no click). Works in Chrome, Safari & Firefox
 * because it ships its own WASM runtime + model (loaded from a CDN once).
 *
 * Fallbacks: if the WASM model can't load (offline/CSP), it degrades to a fixed
 * auto-scan cadence so the kiosk still works — just without the visible box.
 */
const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export function useFaceDetect(
  videoRef: React.RefObject<HTMLVideoElement>,
  opts: { enabled: boolean; onReady: () => void; cooldownMs?: number; stableMs?: number },
) {
  const { enabled, onReady, cooldownMs = 5000, stableMs = 700 } = opts;
  const [box, setBox] = useState<FaceBox | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unsupported'>('loading');
  const raf = useRef<number | null>(null);
  const detectorRef = useRef<any>(null);
  const firstSeen = useRef<number | null>(null);
  const lastFire = useRef<number>(0);
  const onReadyRef = useRef(onReady); onReadyRef.current = onReady;

  useEffect(() => {
    if (!enabled) { setBox(null); firstSeen.current = null; return; }
    let cancelled = false;

    (async () => {
      // Try to load the WASM face detector.
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
        detectorRef.current = await vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO', minDetectionConfidence: 0.5,
        });
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) setStatus('unsupported');
      }

      const tick = () => {
        const v = videoRef.current;
        if (v && v.videoWidth) {
          const det = detectorRef.current;
          if (det) {
            try {
              const res = det.detectForVideo(v, performance.now());
              const d = res?.detections?.[0]?.boundingBox;
              if (d) {
                setBox({ x: d.originX, y: d.originY, width: d.width, height: d.height });
                if (firstSeen.current === null) firstSeen.current = performance.now();
                const stable = performance.now() - firstSeen.current >= stableMs;
                const cooled = performance.now() - lastFire.current >= cooldownMs;
                if (stable && cooled) { lastFire.current = performance.now(); onReadyRef.current(); }
              } else { setBox(null); firstSeen.current = null; }
            } catch { /* frame not ready */ }
          } else {
            // Fallback: fire on a fixed cadence.
            const cooled = performance.now() - lastFire.current >= cooldownMs;
            if (cooled) { lastFire.current = performance.now(); onReadyRef.current(); }
          }
        }
        if (!cancelled) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    })();

    return () => { cancelled = true; if (raf.current) cancelAnimationFrame(raf.current); try { detectorRef.current?.close?.(); } catch { /* */ } detectorRef.current = null; setBox(null); firstSeen.current = null; };
  }, [enabled, videoRef, cooldownMs, stableMs]);

  const armCooldown = () => { lastFire.current = performance.now(); firstSeen.current = null; };
  return { box, status, armCooldown };
}
