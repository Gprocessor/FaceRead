import { useEffect, useState } from 'react';
import { LogIn, LogOut, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { LivenessChallenge } from '@/components/LivenessChallenge';
import { FaceScanner } from '@/components/FaceScanner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabaseClient';
import { checkIn, checkOut, type CheckInOutResponse } from '@/services/attendanceService';
import { getDeviceInfo, getLocation } from '@/utils/deviceInfo';
import { PageHeader } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
      else { const { data: all } = await supabase.from('employees').select('id').limit(1); if (all && all.length > 0) setEmployeeId(all[0].id); }
      setLoading(false);
    })();
  }, [user]);
  const handleLiveness = (sid: string) => { setLivenessSessionId(sid); setStep('face'); };
  const handleFace = async (blob: Blob) => {
    if (!employeeId || !livenessSessionId) return;
    setError(null);
    const location = await getLocation();
    const fn = checkType === 'check_in' ? checkIn : checkOut;
    setResult(await fn(employeeId, blob, livenessSessionId, getDeviceInfo(), location ?? undefined));
    setStep('result');
  };
  const pill = (label: string, active: boolean, done: boolean) => (
    <Badge variant={done ? 'success' : active ? 'default' : 'outline'}>{label}</Badge>
  );
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Attendance Check" description="Verify identity with liveness detection and face recognition." />
      <div className="flex items-center gap-2 mb-4">{pill('Liveness', step === 'liveness', step === 'face' || step === 'result')}{pill('Face Verify', step === 'face', step === 'result')}{pill('Result', step === 'result', false)}</div>
      <Card className="p-5">
        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose an action:</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => { setCheckType('check_in'); setStep('liveness'); }} className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card hover:border-primary hover:bg-accent/40 transition-colors"><LogIn className="w-8 h-8 text-primary" /><span className="text-sm font-medium">Check In</span></button>
              <button onClick={() => { setCheckType('check_out'); setStep('liveness'); }} className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card hover:border-success hover:bg-success/10 transition-colors"><LogOut className="w-8 h-8 text-success" /><span className="text-sm font-medium">Check Out</span></button>
            </div>
          </div>
        )}
        {step === 'liveness' && <LivenessChallenge onComplete={handleLiveness} />}
        {step === 'face' && <FaceScanner onCapture={handleFace} title="Face Verification" subtitle="Look at the camera and capture to confirm your identity." buttonText="Verify & Submit" errorMessage={error} />}
        {step === 'result' && result && (
          <div className="space-y-4 text-center">
            {result.success ? <CheckCircle2 className="w-14 h-14 mx-auto text-success" /> : <XCircle className="w-14 h-14 mx-auto text-destructive" />}
            <h3 className="text-lg font-semibold text-display">{result.success ? `${checkType === 'check_in' ? 'Check-In' : 'Check-Out'} Successful` : 'Verification Failed'}</h3>
            {result.duplicate && <div className="text-sm text-warning bg-warning/10 rounded-lg p-3">You have already checked in today.</div>}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Face Match</p><p className="text-lg font-semibold tnum">{((result.face_match_score ?? 0) * 100).toFixed(1)}%</p></div>
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Liveness</p><p className="text-lg font-semibold tnum">{((result.liveness_score ?? 0) * 100).toFixed(1)}%</p></div>
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Status</p><p className="text-sm font-medium capitalize">{result.status}</p></div>
              <div className="bg-muted/50 rounded-lg p-3"><p className="text-xs text-muted-foreground">Verification</p><p className="text-sm font-medium capitalize">{result.verification_status}</p></div>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => { setStep('select'); setResult(null); setLivenessSessionId(null); setError(null); }}>Done</Button>
          </div>
        )}
      </Card>
      <p className="text-xs text-muted-foreground mt-3">{new Date().toLocaleString()}</p>
    </div>
  );
}
