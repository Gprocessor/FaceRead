import { useEffect, useState } from 'react';
import { LogIn, LogOut, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase.from('employees').select('id').eq('user_id', user.id).maybeSingle();
      if (data) setEmployeeId(data.id);
      else {
        const { data: allEmps } = await supabase.from('employees').select('id').limit(1);
        if (allEmps && allEmps.length > 0) setEmployeeId(allEmps[0].id);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleLivenessComplete = (sessionId: string) => { setLivenessSessionId(sessionId); setStep('face'); };

  const handleFaceCapture = async (imageBlob: Blob) => {
    if (!employeeId || !livenessSessionId) return;
    setError(null);
    const location = await getLocation();
    const fn = checkType === 'check_in' ? checkIn : checkOut;
    const res = await fn(employeeId, imageBlob, livenessSessionId, getDeviceInfo(), location ?? undefined);
    setResult(res);
    setStep('result');
  };

  const pill = (label: string, active: boolean, done: boolean) => (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${done ? 'bg-emerald-500/10 text-emerald-400' : active ? 'bg-sky-500/10 text-sky-400' : 'bg-slate-800 text-slate-500'}`}>{label}</span>
  );

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Attendance Check</h1>
        <p className="text-sm text-slate-400 mt-1">Verify your identity with liveness detection and face recognition.</p>
      </div>
      <div className="flex items-center gap-2">
        {pill('Liveness', step === 'liveness', step === 'face' || step === 'result')}
        {pill('Face Verify', step === 'face', step === 'result')}
        {pill('Result', step === 'result', false)}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Choose an action:</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setCheckType('check_in'); setStep('liveness'); }} className="flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-sky-500 hover:bg-sky-500/5 transition-colors">
                <LogIn className="w-8 h-8 text-sky-400" /><span className="text-sm font-medium text-slate-200">Check In</span>
              </button>
              <button onClick={() => { setCheckType('check_out'); setStep('liveness'); }} className="flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-emerald-500 hover:bg-emerald-500/5 transition-colors">
                <LogOut className="w-8 h-8 text-emerald-400" /><span className="text-sm font-medium text-slate-200">Check Out</span>
              </button>
            </div>
          </div>
        )}

        {step === 'liveness' && <LivenessChallenge onComplete={handleLivenessComplete} />}

        {step === 'face' && (
          <FaceScanner onCapture={handleFaceCapture} title="Face Verification" subtitle="Look at the camera and capture to confirm your identity." buttonText="Verify & Submit" errorMessage={error} />
        )}

        {step === 'result' && result && (
          <div className="space-y-4 text-center">
            {result.success ? <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-400" /> : <XCircle className="w-14 h-14 mx-auto text-rose-400" />}
            <h3 className="text-lg font-semibold text-slate-100">
              {result.success ? `${checkType === 'check_in' ? 'Check-In' : 'Check-Out'} Successful` : 'Verification Failed'}
            </h3>
            {result.duplicate && <div className="text-sm text-amber-400 bg-amber-500/10 rounded-lg p-3">You have already checked in today.</div>}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-slate-800/50 rounded-lg p-3"><p className="text-xs text-slate-500">Face Match</p><p className="text-lg font-semibold text-slate-100">{((result.face_match_score ?? 0) * 100).toFixed(1)}%</p></div>
              <div className="bg-slate-800/50 rounded-lg p-3"><p className="text-xs text-slate-500">Liveness</p><p className="text-lg font-semibold text-slate-100">{((result.liveness_score ?? 0) * 100).toFixed(1)}%</p></div>
              <div className="bg-slate-800/50 rounded-lg p-3"><p className="text-xs text-slate-500">Status</p><p className="text-sm font-medium text-slate-200 capitalize">{result.status}</p></div>
              <div className="bg-slate-800/50 rounded-lg p-3"><p className="text-xs text-slate-500">Verification</p><p className="text-sm font-medium text-slate-200 capitalize">{result.verification_status}</p></div>
            </div>
            <button onClick={() => { setStep('select'); setResult(null); setLivenessSessionId(null); setError(null); }} className="w-full mt-4 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium text-sm hover:bg-slate-700 transition-colors">Done</button>
          </div>
        )}
      </div>
      <p className="text-xs text-slate-600">{new Date().toLocaleString()}</p>
    </div>
  );
}
