import { useEffect, useState } from 'react';
import { ScanFace, ShieldCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { FaceScanner } from '@/components/FaceScanner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabaseClient';
import { enrollFace } from '@/services/faceService';
import { getDeviceInfo } from '@/utils/deviceInfo';

export function FaceEnrollment() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<
    Array<{ id: string; full_name: string; employee_code: string; face_enrolled: boolean }>
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentId, setConsentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('employees')
          .select('id, full_name, employee_code')
          .order('full_name');
        const withFace = await Promise.all(
          (data ?? []).map(async (e) => {
            const { count } = await supabase
              .from('face_profiles')
              .select('id', { count: 'exact', head: true })
              .eq('employee_id', e.id)
              .eq('is_active', true);
            return { ...e, face_enrolled: (count ?? 0) > 0 };
          })
        );
        setEmployees(withFace);
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleConsent = async () => {
    if (!selectedId || !user?.organizationId) return;
    try {
      const { data, error: err } = await supabase
        .from('consent_records')
        .insert({
          organization_id: user.organizationId,
          employee_id: selectedId,
          consent_type: 'biometric_face',
          status: 'granted',
          granted_at: new Date().toISOString(),
          device_info: getDeviceInfo(),
          consent_text:
            'I consent to the collection and processing of my facial biometric data for attendance verification purposes.',
          created_by: user.id,
        })
        .select('id')
        .single();
      if (err) throw err;
      setConsentId(data.id);
      setConsentGiven(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record consent');
    }
  };

  const handleEnroll = async (imageBlob: Blob) => {
    if (!selectedId || !consentId) return;
    setError(null);
    setSuccess(null);
    const result = await enrollFace(selectedId, imageBlob, consentId, getDeviceInfo());
    if (result.success) {
      setSuccess(
        `Face enrolled successfully for ${result.employee_id}. Status: ${result.enrollment_status}`
      );
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === selectedId ? { ...e, face_enrolled: true } : e
        )
      );
    } else {
      throw new Error(result.message || 'Enrollment failed');
    }
  };

  const selected = employees.find((e) => e.id === selectedId);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Face Enrollment</h1>
        <p className="text-sm text-slate-400 mt-1">
          Enroll employee faces for biometric attendance verification. Consent is required.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Select Employee
            </label>
            <select
              value={selectedId ?? ''}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setConsentGiven(false);
                setConsentId(null);
                setSuccess(null);
                setError(null);
              }}
              className="w-full max-w-md px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="">— Select an employee —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_code}){e.face_enrolled ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              {selected.face_enrolled && (
                <div className="flex items-center gap-2 text-sm text-emerald-400 mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                  This employee is already face-enrolled. Re-enrolling will update the profile.
                </div>
              )}

              {!consentGiven ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 bg-sky-500/5 border border-sky-500/20 rounded-lg p-4">
                    <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-200 font-medium mb-1">
                        Biometric Consent Required
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        The selected employee must consent to having their facial
                        biometric data collected and processed for attendance
                        verification. This data will be stored as an encrypted
                        mathematical embedding — not as a photograph — and can
                        be revoked at any time.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleConsent}
                    className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 transition-colors flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Record Consent & Continue
                  </button>
                </div>
              ) : (
                <FaceScanner
                  onCapture={handleEnroll}
                  title="Face Enrollment"
                  subtitle="Position the face within the oval and capture."
                  buttonText="Enroll Face"
                  successMessage={success ?? undefined}
                  errorMessage={error}
                />
              )}

              {error && (
                <div className="mt-4 flex items-center gap-2 text-sm text-rose-400">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {!selected && (
            <div className="flex flex-col items-center py-12 text-slate-500">
              <ScanFace className="w-12 h-12 mb-3" />
              <p className="text-sm">Select an employee to begin face enrollment</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
