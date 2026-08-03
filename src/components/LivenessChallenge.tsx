import { useCallback, useEffect, useState } from 'react';
import {
  Eye,
  ArrowLeft,
  ArrowRight,
  Smile,
  ScanFace,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { useLiveness } from '@/hooks/useLiveness';
import { CameraCapture, CameraPlaceholder } from './CameraCapture';
import { getDeviceInfo } from '@/utils/deviceInfo';

interface LivenessChallengeProps {
  onComplete: (sessionId: string) => void;
}

const CHALLENGE_META: Record<
  string,
  { icon: typeof Eye; instruction: string; description: string }
> = {
  BLINK: {
    icon: Eye,
    instruction: 'Blink your eyes',
    description: 'Blink naturally 2-3 times for the camera',
  },
  TURN_HEAD_LEFT: {
    icon: ArrowLeft,
    instruction: 'Turn your head left',
    description: 'Slowly turn your head to the left, then back to center',
  },
  TURN_HEAD_RIGHT: {
    icon: ArrowRight,
    instruction: 'Turn your head right',
    description: 'Slowly turn your head to the right, then back to center',
  },
  LOOK_STRAIGHT: {
    icon: ScanFace,
    instruction: 'Look straight ahead',
    description: 'Keep your face centered and look directly at the camera',
  },
  SMILE: {
    icon: Smile,
    instruction: 'Smile',
    description: 'Give the camera a natural smile',
  },
};

export function LivenessChallenge({ onComplete }: LivenessChallengeProps) {
  const { phase, challenge, result, error, camera, startChallenge, submitFrames, reset } =
    useLiveness();
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    startChallenge();
    return () => camera.stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCaptureAndSubmit = useCallback(async () => {
    setCapturing(true);
    const frames = await camera.captureFrames(5, 300);
    await submitFrames(frames, getDeviceInfo());
    setCapturing(false);
  }, [camera, submitFrames]);

  const handleDone = useCallback(() => {
    if (result?.passed && challenge) {
      onComplete(challenge.session_id);
    }
  }, [result, challenge, onComplete]);

  if (phase === 'done' && result) {
    const Icon = result.passed ? CheckCircle2 : XCircle;
    const color = result.passed ? 'text-emerald-400' : 'text-rose-400';
    return (
      <div className="space-y-4">
        <div className={`flex flex-col items-center gap-3 py-8 ${color}`}>
          <Icon className="w-14 h-14" />
          <p className="text-lg font-semibold">
            {result.passed ? 'Liveness Verified' : 'Verification Failed'}
          </p>
          <p className="text-sm text-slate-400">
            Score: {(result.liveness_score * 100).toFixed(1)}%
          </p>
          {result.failure_reason && (
            <p className="text-sm text-rose-400">{result.failure_reason}</p>
          )}
          <p className="text-xs text-slate-500">
            {result.frame_count} frames analyzed in {result.processing_time_ms}ms
          </p>
        </div>
        <div className="flex justify-center gap-3">
          {result.passed ? (
            <button
              onClick={handleDone}
              className="px-5 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-medium text-sm hover:bg-emerald-400 transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  const meta = challenge ? CHALLENGE_META[challenge.challenge_type] : null;
  const ChallengeIcon = meta?.icon ?? ScanFace;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-medium mb-3">
          <Info className="w-3.5 h-3.5" />
          Liveness Check
        </div>
        <h2 className="text-xl font-semibold text-slate-100">
          {meta?.instruction ?? 'Preparing challenge…'}
        </h2>
        <p className="text-sm text-slate-400 mt-1">{meta?.description}</p>
      </div>

      {camera.ready ? (
        <CameraCapture videoRef={camera.videoRef} />
      ) : (
        <CameraPlaceholder error={camera.error} />
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-400 justify-center">
          <XCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {!camera.ready && !camera.error && (
          <button
            onClick={camera.startCamera}
            className="px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 transition-colors"
          >
            Start Camera
          </button>
        )}

        {camera.ready && challenge && (
          <button
            onClick={handleCaptureAndSubmit}
            disabled={capturing}
            className="px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {capturing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Capturing…
              </>
            ) : (
              <>
                <ChallengeIcon className="w-4 h-4" />
                Capture & Verify
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
