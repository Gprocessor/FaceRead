import { useCallback, useEffect, useState } from 'react';
import { Eye, ArrowLeft, ArrowRight, Smile, ScanFace, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useLiveness } from '@/hooks/useLiveness';
import { CameraCapture } from './CameraCapture';
import { getDeviceInfo } from '@/utils/deviceInfo';

interface LivenessChallengeProps {
  onComplete: (sessionId: string) => void;
}

const CHALLENGE_META: Record<string, { icon: typeof Eye; instruction: string; description: string }> = {
  BLINK: { icon: Eye, instruction: 'Blink your eyes', description: 'Blink naturally 2-3 times for the camera' },
  TURN_HEAD_LEFT: { icon: ArrowLeft, instruction: 'Turn your head left', description: 'Slowly turn your head to the left, then back to center' },
  TURN_HEAD_RIGHT: { icon: ArrowRight, instruction: 'Turn your head right', description: 'Slowly turn your head to the right, then back to center' },
  LOOK_STRAIGHT: { icon: ScanFace, instruction: 'Look straight ahead', description: 'Keep your face centered and look directly at the camera' },
  SMILE: { icon: Smile, instruction: 'Smile', description: 'Give the camera a natural smile' },
};

export function LivenessChallenge({ onComplete }: LivenessChallengeProps) {
  const { phase, challenge, result, error, camera, startChallenge, submitFrames } = useLiveness();
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    startChallenge();
    camera.startCamera();
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
    if (result?.passed && challenge) onComplete(challenge.session_id);
  }, [result, challenge, onComplete]);

  if (phase === 'done' && result) {
    const Icon = result.passed ? CheckCircle2 : XCircle;
    const color = result.passed ? 'text-emerald-400' : 'text-rose-400';
    return (
      <div className="space-y-4 text-center">
        <Icon className={`w-14 h-14 mx-auto ${color}`} />
        <h3 className="text-lg font-semibold text-slate-100">
          {result.passed ? 'Liveness Verified' : 'Verification Failed'}
        </h3>
        <p className="text-sm text-slate-400">Score: {(result.liveness_score * 100).toFixed(1)}%</p>
        {result.failure_reason && <p className="text-sm text-rose-400">{result.failure_reason}</p>}
        <p className="text-xs text-slate-600">
          {result.frame_count} frames analyzed in {result.processing_time_ms}ms
        </p>
        {result.passed ? (
          <button onClick={handleDone} className="px-5 py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-medium text-sm hover:bg-emerald-400 transition-colors">
            Continue
          </button>
        ) : (
          <button onClick={startChallenge} className="px-5 py-2.5 rounded-lg bg-slate-800 text-slate-300 font-medium text-sm hover:bg-slate-700 transition-colors">
            Try Again
          </button>
        )}
      </div>
    );
  }

  const meta = challenge ? CHALLENGE_META[challenge.challenge_type] : null;
  const ChallengeIcon = meta?.icon ?? ScanFace;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
          <ChallengeIcon className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Liveness Check</p>
          <h3 className="text-lg font-semibold text-slate-100">{meta?.instruction ?? 'Preparing challenge…'}</h3>
        </div>
      </div>
      <p className="text-sm text-slate-400">{meta?.description}</p>

      <CameraCapture
        videoRef={camera.videoRef}
        ready={camera.ready}
        error={camera.error}
        overlay={
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-40 h-52 border-2 border-sky-400/60 rounded-[50%]" />
          </div>
        }
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 rounded-lg p-3">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {!camera.ready && !camera.error && (
          <button onClick={() => camera.startCamera()} className="px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 transition-colors flex items-center gap-2">
            <ScanFace className="w-4 h-4" /> Start Camera
          </button>
        )}
        {camera.ready && challenge && (
          <button
            onClick={handleCaptureAndSubmit}
            disabled={capturing || phase === 'analyzing'}
            className="px-5 py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {capturing || phase === 'analyzing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> {capturing ? 'Capturing…' : 'Analyzing…'}
              </>
            ) : (
              <>
                <ScanFace className="w-4 h-4" /> Capture &amp; Verify
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
