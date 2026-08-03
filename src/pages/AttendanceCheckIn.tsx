import { useState } from 'react';
import { CalendarCheck, LogIn, LogOut, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { LivenessChallenge } from '@/components/LivenessChallenge';
import { FaceScanner } from '@/components/FaceScanner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabaseClient';
import { checkIn, checkOut, type CheckInOutResponse } from '@/services/attendanceService';
import { getDeviceInfo, getLocation } from '@/utils/deviceInfo';

type Step = 'select' | 'liveness' | 'face' | 'result';

export function AttendanceCheckIn() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('select');
  const [checkType, setCheckType] = useState<'check_in' | 'check_out'>('check_in');
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInOutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Find the current user's employee record
  useState(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from('employees')
        .select('id, full_name, employee_code')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setEmployeeId(data.id);
      } else {
        // fallback: allow picking any employee for demo
        const { data: allEmps } = await supabase
          .from('employees')
          .select('id, full_name, employee_code')
          .limit(1);
        if (allEmps && allEmps.length > 0) {
          setEmployeeId(allEmps[0].id);
        }
      }
      setLoading(false);
    })();
  });

  const handleLivenessComplete = (sessionId: string) => {
    setLivenessSessionId(sessionId);
    setStep('face');
  };

  const handleFaceCapture = async (imageBlob: Blob) => {
    if (!employeeId || !livenessSessionId) return;
    setError(null);
    const location = await getLocation();
    const fn = checkType === 'check_in' ? checkIn : checkOut;
    const res = await fn(employeeId, imageBlob, livenessSessionId, getDeviceInfo(), location ?? undefined);
    setResult(res);
    setStep('result');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Attendance Check</h1>
        <p className="text-sm text-slate-400 mt-1">
          Verify your identity with liveness detection and face recognition.
        </p>
      </div>

      {step === 'select' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <p className="text-sm text-slate-400">Choose an action:</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                setCheckType('check_in');
                setStep('liveness');
              }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-sky-500 hover:bg-sky-500/5 transition-colors"
            >
              <LogIn className="w-8 h-8 text-sky-400" />
              <span className="text-sm font-medium text-slate-200">Check In</span>
            </button>
            <button
              onClick={() => {
                setCheckType('check_out');
                setStep('liveness');
              }}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-emerald-500 hover:bg-emerald-500/5 transition-colors"
            >
              <LogOut className="w-8 h-8 text-emerald-400" />
              <span className="text-sm font-medium text-slate-200">Check Out</span>
            </button>
          </div>
        </div>
      )}

      {step === 'liveness' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" /> Liveness
            </span>
            <span className="flex items-center gap-1.5 opacity-40">
              <span className="w-2 h-2 rounded-full bg-slate-600" /> Face Verify
            </span>
            <span className="flex items-center gap-1.5 opacity-40">
              <span className="w-2 h-2 rounded-full bg-slate-600" /> Result
            </span>
          </div>
          <LivenessChallenge onComplete={handleLivenessComplete} />
        </div>
      )}

      {step === 'face' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Liveness
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" /> Face Verify
            </span>
            <span className="flex items-center gap-1.5 opacity-40">
              <span className="w-2 h-2 rounded-full bg-slate-600" /> Result
            </span>
          </div>
          <FaceScanner
            onCapture={handleFaceCapture}
            title="Face Verification"
            subtitle="Look at the camera for identity verification."
            buttonText="Verify & Submit"
            errorMessage={error}
          />
        </div>
      )}

      {step === 'result' && result && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Liveness
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Face Verify
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500" /> Result
            </span>
          </div>

          <div
            className={`flex flex-col items-center gap-3 py-6 ${
              result.success ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="w-14 h-14" />
            ) : (
              <XCircle className="w-14 h-14" />
            )}
            <p className="text-lg font-semibold">
              {result.success
                ? `${checkType === 'check_in' ? 'Check-In' : 'Check-Out'} Successful`
                : 'Verification Failed'}
            </p>
            {result.duplicate && (
              <p className="text-sm text-amber-400">
                You have already checked in today.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm text-slate-400">
              <div>
                <p className="text-xs text-slate-500">Face Match</p>
                <p className="text-slate-200">
                  {((result.face_match_score ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Liveness</p>
                <p className="text-slate-200">
                  {((result.liveness_score ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p className="text-slate-200 capitalize">{result.status}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Verification</p>
                <p className="text-slate-200 capitalize">
                  {result.verification_status}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setStep('select');
              setResult(null);
              setLivenessSessionId(null);
              setError(null);
            }}
            className="w-full mt-4 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium text-sm hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
        <CalendarCheck className="w-3.5 h-3.5" />
        {new Date().toLocaleString()}
      </div>
    </div>
  );
}
