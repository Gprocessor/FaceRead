import { useEffect, useState } from 'react';
import { ScanFace, ShieldCheck, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { FaceScanner } from '@/components/FaceScanner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabaseClient';
import { enrollFace } from '@/services/faceService';
import { getDeviceInfo } from '@/utils/deviceInfo';
import { PageHeader } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function FaceEnrollment() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string; employee_code: string; face_enrolled: boolean }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentId, setConsentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('employees').select('id, full_name, employee_code').order('full_name');
        const withFace = await Promise.all((data ?? []).map(async (e) => {
          const { data: fp } = await supabase.from('face_profiles').select('id').eq('employee_id', e.id).eq('is_active', true).limit(1);
          return { ...e, face_enrolled: (fp?.length ?? 0) > 0 };
        }));
        setEmployees(withFace);
      } finally { setLoading(false); }
    })();
  }, []);

  const handleConsent = async () => {
    if (!selectedId || !user?.organizationId) { setError('Your account has no organization assigned yet.'); return; }
    try {
      const { data, error: err } = await supabase.from('consent_records').insert({
        organization_id: user.organizationId,
        employee_id: selectedId,
        consent_type: 'biometric_face',
        status: 'granted',
        granted_at: new Date().toISOString(),
        device_info: getDeviceInfo(),
        consent_text: 'I consent to the collection and processing of my facial biometric data for attendance verification purposes.',
        created_by: user.id,
      }).select('id').single();
      if (err) throw err;
      setConsentId(data.id);
      setConsentGiven(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to record consent'); }
  };

  const handleEnroll = async (imageBlob: Blob) => {
    if (!selectedId || !consentId) return;
    setError(null); setSuccess(null);
    const result = await enrollFace(selectedId, imageBlob, consentId, getDeviceInfo());
    if (result.success) {
      setSuccess('Face enrolled successfully.');
      setEmployees((prev) => prev.map((e) => (e.id === selectedId ? { ...e, face_enrolled: true } : e)));
    } else {
      throw new Error(result.message || 'Enrollment failed');
    }
  };

  const selected = employees.find((e) => e.id === selectedId);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Face Enrollment" description="Enrol employee faces for biometric attendance. Consent is required first." />
      {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : (
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Select Employee</label>
            <select value={selectedId ?? ''} onChange={(e) => { setSelectedId(e.target.value); setConsentGiven(false); setConsentId(null); setSuccess(null); setError(null); }}
              className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">&mdash; Select an employee &mdash;</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code}){e.face_enrolled ? ' \u2713' : ''}</option>)}
            </select>
          </div>

          {selected && (
            <Card className="space-y-4 p-5">
              {selected.face_enrolled && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="size-5" />Already enrolled &mdash; re-enrolling updates the profile. <Badge variant="success">Enrolled</Badge>
                </div>
              )}

              {!consentGiven ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-accent/40 p-4">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <p className="mb-1 text-sm font-medium">Biometric Consent Required</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">Data is stored as an encrypted mathematical embedding &mdash; not a photograph &mdash; and can be revoked at any time.</p>
                    </div>
                  </div>
                  <Button onClick={handleConsent}><ShieldCheck className="size-4" />Record Consent &amp; Continue</Button>
                </div>
              ) : (
                <FaceScanner onCapture={handleEnroll} title="Capture face"
                  subtitle="Align the face - the box turns on when a face is detected - then capture."
                  buttonText="Enroll Face" successMessage={success ?? undefined} errorMessage={error} />
              )}

              {error && <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="size-4" />{error}</div>}
            </Card>
          )}

          {!selected && (
            <Card className="p-12 text-center text-muted-foreground"><ScanFace className="mx-auto mb-3 size-12" />Select an employee to begin face enrollment</Card>
          )}
        </div>
      )}
    </div>
  );
}
