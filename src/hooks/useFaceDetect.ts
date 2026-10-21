import { useCallback, useEffect, useRef, useState } from 'react';

export interface FaceBox { x: number; y: number; width: number; height: number; }
export type DetectorStatus = 'loading' | 'ready' | 'unsupported';

const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

// ~15 detections/sec. Faster wastes CPU and starves the camera encoder,
// slower makes the box feel laggy.
const DETECT_INTERVAL_MS = 66;

export interface FaceDetectOptions {
  /** When false the box still draws, but onReady never fires. */
  active: boolean;
  /** Fires once a face has been held steady for `stableMs`. */
  onReady: () => void;
  stableMs?: number;
  cooldownMs?: number;
  /** Face width as a fraction of frame width. Ignores people standing too far back. */
  minFaceRatio?: number;
}

/**
 * Cross-browser face detection (MediaPipe Tasks Vision / WASM).
 *
 * The detector is created ONCE and the loop never stops; `active` only gates
 * the auto-trigger. Previously the effect depended on `enabled`, so every scan
 * tore the detector down and the next scan re-initialised the WASM runtime and
 * re-fetched the model - that was the main source of the slow-to-scan feel.
 */
export function useFaceDetect(
  videoRef: React.RefObject<HTMLVideoElement>,
  opts: FaceDetectOptions,
) {
  const { active, onReady, stableMs = 600, cooldownMs = 3000, minFaceRatio = 0.12 } = opts;

  const [box, setBox] = useState<FaceBox | null>(null);
  const [status, setStatus] = useState<DetectorStatus>('loading');
  const [faceVisible, setFaceVisible] = useState(false);

  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectRef = useRef(0);
  const firstSeenRef = useRef<number | null>(null);
  const lastFireRef = useRef(0);
  const boxRef = useRef<FaceBox | null>(null);
  const visibleRef = useRef(false);

  // Loop reads the latest values without being restarted.
  const activeRef = useRef(active); activeRef.current = active;
  const onReadyRef = useRef(onReady); onReadyRef.current = onReady;
  const stableRef = useRef(stableMs); stableRef.current = stableMs;
  const cooldownRef = useRef(cooldownMs); cooldownRef.current = cooldownMs;
  const ratioRef = useRef(minFaceRatio); ratioRef.current = minFaceRatio;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
        const detector = await vision.FaceDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          // MediaPipe's default. Deliberately lower than the recognition
          // threshold: this only answers "is somebody there?" - identity is
          // still decided by InsightFace on the backend.
          minDetectionConfidence: 0.5,
          minSuppressionThreshold: 0.3,
        });
        if (cancelled) { try { detector.close?.(); } catch { /* ignore */ } return; }
        detectorRef.current = detector;
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('unsupported');
      }
    })();

    const publishBox = (next: FaceBox | null) => {
      const prev = boxRef.current;
      if (!next && !prev) return;
      if (next && prev
        && Math.abs(next.x - prev.x) < 3
        && Math.abs(next.y - prev.y) < 3
        && Math.abs(next.width - prev.width) < 3
        && Math.abs(next.height - prev.height) < 3) return;
      boxRef.current = next;
      setBox(next);
    };

    const publishVisible = (v: boolean) => {
      if (visibleRef.current === v) return;
      visibleRef.current = v;
      setFaceVisible(v);
    };

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);

      const now = performance.now();
      if (now - lastDetectRef.current < DETECT_INTERVAL_MS) return;
      lastDetectRef.current = now;

      const video = videoRef.current;
      if (!video || !video.videoWidth || video.readyState < 2) return;

      const detector = detectorRef.current;

      // No detector (offline / blocked CDN): keep the kiosk usable with a slow
      // fixed cadence, just without a visible box.
      if (!detector) {
        if (activeRef.current && now - lastFireRef.current >= cooldownRef.current + stableRef.current) {
          lastFireRef.current = now;
          onReadyRef.current();
        }
        return;
      }

      let found: FaceBox | null = null;
      try {
        const result = detector.detectForVideo(video, now);
        const bb = result?.detections?.[0]?.boundingBox;
        if (bb) found = { x: bb.originX, y: bb.originY, width: bb.width, height: bb.height };
      } catch { /* frame not ready for this timestamp */ }

      publishBox(found);
      publishVisible(!!found);

      if (!found) { firstSeenRef.current = null; return; }

      if (found.width / video.videoWidth < ratioRef.current) {
        firstSeenRef.current = null;   // too far from the camera
        return;
      }

      if (firstSeenRef.current === null) firstSeenRef.current = now;
      if (!activeRef.current) return;
      if (now - firstSeenRef.current < stableRef.current) return;
      if (now - lastFireRef.current < cooldownRef.current) return;

      lastFireRef.current = now;
      firstSeenRef.current = null;
      onReadyRef.current();
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try { detectorRef.current?.close?.(); } catch { /* ignore */ }
      detectorRef.current = null;
    };
  }, [videoRef]);

  /** Restart the cooldown/stability timers after a scan finishes. */
  const armCooldown = useCallback(() => {
    lastFireRef.current = performance.now();
    firstSeenRef.current = null;
  }, []);

  return { box, status, faceVisible, armCooldown };
}
