import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2, KeyRound, Copy, Shapes, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePeopleSchema, setPeopleSchemaCache } from '@/hooks/usePeopleSchema';
import { savePeopleSchema, getPresets, ORG_TYPES, type PresetSummary } from '@/services/peopleService';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { getKioskKeyStatus, rotateKioskKey } from '@/services/attendanceService';
import { PageHeader } from '@/components/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
interface AppSettings { id?: string; late_threshold_minutes: number; work_start_time: string; work_end_time: string; require_liveness: boolean; require_check_out: boolean; allow_multiple_check_in: boolean; duplicate_check_window_minutes: number; face_match_threshold: number; liveness_threshold: number; max_allowed_faces: number; min_face_confidence: number; geofencing_enabled: boolean; }
const DEFAULTS: AppSettings = { late_threshold_minutes: 15, work_start_time: '09:00', work_end_time: '17:00', require_liveness: true, require_check_out: false, allow_multiple_check_in: false, duplicate_check_window_minutes: 60, face_match_threshold: 0.68, liveness_threshold: 0.6, max_allowed_faces: 1, min_face_confidence: 0.5, geofencing_enabled: false };
export function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const [kioskConfigured, setKioskConfigured] = useState(false); const [kioskRotatedAt, setKioskRotatedAt] = useState<string | null>(null); const [kioskNewKey, setKioskNewKey] = useState<string | null>(null); const [kioskRotating, setKioskRotating] = useState(false); const [kioskError, setKioskError] = useState<string | null>(null);
  const { schema } = usePeopleSchema();
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [orgType, setOrgType] = useState('company');
  const [typeSaving, setTypeSaving] = useState(false); const [typeMsg, setTypeMsg] = useState<string | null>(null); const [typeErr, setTypeErr] = useState<string | null>(null);
  useEffect(() => { getPresets().then(setPresets).catch(() => setPresets([])); }, []);
  useEffect(() => { if (schema) setOrgType(schema.org_type); }, [schema]);
  const handleSaveType = async (loadStarterFields: boolean) => {
    setTypeSaving(true); setTypeMsg(null); setTypeErr(null);
    try {
      const preset = presets.find((p) => p.key === orgType);
      const labels = preset ? preset.labels : (schema?.labels ?? { person_singular: 'Person', person_plural: 'People', id_label: 'ID No.' });
      const fields = loadStarterFields && preset ? preset.fields : (schema?.fields ?? []);
      const res = await savePeopleSchema({ org_type: orgType, labels, fields });
      setPeopleSchemaCache(res);
      setTypeMsg(loadStarterFields ? 'Organisation type saved and starter fields loaded.' : 'Organisation type and wording saved. Your fields were kept.');
    } catch (e) { setTypeErr(e instanceof Error ? e.message : 'Could not save'); }
    finally { setTypeSaving(false); }
  };
  useEffect(() => { (async () => { try { const s = await getKioskKeyStatus(); setKioskConfigured(s.configured); setKioskRotatedAt(s.rotated_at); } catch { /* */ } })(); }, []);
  const handleRotateKiosk = async () => { setKioskRotating(true); setKioskError(null); setKioskNewKey(null); try { const res = await rotateKioskKey(); setKioskNewKey(res.kiosk_api_key); setKioskConfigured(true); setKioskRotatedAt(new Date().toISOString()); } catch (err) { setKioskError(err instanceof Error ? err.message : 'Could not generate a kiosk key'); } finally { setKioskRotating(false); } };
  useEffect(() => { (async () => { if (!user?.organizationId) { setSettings({ ...DEFAULTS }); setLoading(false); return; } const { data } = await supabase.from('app_settings').select('*').eq('organization_id', user.organizationId).maybeSingle(); setSettings(data ? (data as AppSettings) : { ...DEFAULTS }); setLoading(false); })(); }, [user]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const handleSave = async () => {
    if (!settings || !user?.organizationId) return;
    setSaving(true); setSaved(false); setSaveError(null);
    try {
      const payload: Record<string, unknown> = { ...settings };
      for (const k of ['id', 'settings', 'created_at', 'updated_at', 'organization_id']) delete payload[k];
      const { data, error } = await supabase.from('app_settings').upsert({ ...payload, organization_id: user.organizationId }, { onConflict: 'organization_id' }).select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Settings were not saved. Only an org admin can change them.');
      setSettings(data as AppSettings);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : (e as { message?: string })?.message || 'Could not save settings');
    } finally { setSaving(false); }
  };
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>;
  if (!settings) return <Card className="p-12 text-center text-muted-foreground">No settings available.</Card>;
  const num = (label: string, key: keyof AppSettings, step = '1') => (<div className="space-y-1.5"><Label>{label}</Label><Input type="number" step={step} value={settings[key] as number} onChange={(e) => setSettings({ ...settings, [key]: +e.target.value })} /></div>);
  return (<div className="max-w-3xl"><PageHeader title="Settings" description="Configure attendance rules and verification thresholds" /><div className="space-y-6">
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Shapes className="w-4 h-4 text-primary" />Organisation Type</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Sets the wording (e.g. Students / Matric No.) and the starter fields used on the People form and reports.</p>
      <div className="space-y-1.5 max-w-md"><Label>Type</Label><select value={orgType} onChange={(e) => { setOrgType(e.target.value); setTypeMsg(null); }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">{(presets.length ? presets.map((p) => ({ key: p.key, name: p.name })) : ORG_TYPES).map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select></div>
      {presets.find((p) => p.key === orgType) && <p className="text-xs text-muted-foreground">{presets.find((p) => p.key === orgType)!.description} People are called <strong>{presets.find((p) => p.key === orgType)!.labels.person_plural}</strong>, ID is <strong>{presets.find((p) => p.key === orgType)!.labels.id_label}</strong>.</p>}
      <div className="flex flex-wrap gap-2"><Button onClick={() => handleSaveType(false)} disabled={typeSaving}>{typeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save type &amp; wording</Button><Button variant="outline" onClick={() => { if (window.confirm('Replace your current custom fields with the starter fields for this type? Values already saved for people are kept.')) handleSaveType(true); }} disabled={typeSaving}>Save &amp; load starter fields</Button><Link to="/people-fields"><Button variant="ghost">Edit fields<ArrowRight className="w-4 h-4" /></Button></Link></div>
      {typeMsg && <p className="flex items-center gap-1 text-sm text-success"><CheckCircle2 className="w-4 h-4" />{typeMsg}</p>}{typeErr && <p className="text-sm text-destructive">{typeErr}</p>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Attendance Rules</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">{num('Late Threshold (minutes)', 'late_threshold_minutes')}{num('Duplicate Window (minutes)', 'duplicate_check_window_minutes')}<div className="space-y-1.5"><Label>Work Start Time</Label><Input type="time" value={settings.work_start_time} onChange={(e) => setSettings({ ...settings, work_start_time: e.target.value })} /></div><div className="space-y-1.5"><Label>Work End Time</Label><Input type="time" value={settings.work_end_time} onChange={(e) => setSettings({ ...settings, work_end_time: e.target.value })} /></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Verification Thresholds</CardTitle></CardHeader><CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">{num('Face Match Threshold', 'face_match_threshold', '0.01')}{num('Liveness Threshold', 'liveness_threshold', '0.05')}{num('Min Face Confidence', 'min_face_confidence', '0.05')}{num('Max Allowed Faces', 'max_allowed_faces')}<p className="text-xs text-muted-foreground md:col-span-2">Tip: InsightFace works best around 0.66–0.72. If genuine liveness attempts fail, set Liveness Threshold just below the score shown on the kiosk.</p></CardContent></Card>
    <Card><CardHeader><CardTitle>Feature Toggles</CardTitle></CardHeader><CardContent className="space-y-3">{([['require_liveness','Require liveness challenge on the kiosk (turn off to scan faces without blink/turn)'],['require_check_out','Require check-out'],['allow_multiple_check_in','Allow multiple check-ins per day'],['geofencing_enabled','Enable geofencing']] as const).map(([key, label]) => (<label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={settings[key] as boolean} onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })} className="w-4 h-4 rounded border-input accent-[var(--primary)]" />{label}</label>))}</CardContent></Card>
    <Card><CardHeader><CardTitle>Kiosk (no-login attendance screen)</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Generate a kiosk key and enter it once on the device you'll use for walk-up check-in/out at the home screen. Anyone at that device can mark attendance by scanning their face. Rotating disconnects any device paired with the old key.</p><div className="flex items-center gap-2 text-sm"><KeyRound className="w-4 h-4 text-primary" />{kioskConfigured ? <span>Kiosk key configured{kioskRotatedAt ? ` · rotated ${new Date(kioskRotatedAt).toLocaleString()}` : ''}</span> : <span className="text-muted-foreground">No kiosk key generated yet</span>}</div>{kioskNewKey && (<div className="space-y-1.5"><Label>New kiosk key (shown once — copy it now)</Label><div className="flex gap-2"><Input readOnly value={kioskNewKey} className="font-mono text-xs" /><Button type="button" variant="secondary" size="icon" onClick={() => navigator.clipboard.writeText(kioskNewKey)}><Copy className="w-4 h-4" /></Button></div></div>)}{kioskError && <p className="text-sm text-destructive">{kioskError}</p>}<Button variant={kioskConfigured ? 'outline' : 'default'} onClick={handleRotateKiosk} disabled={kioskRotating}>{kioskRotating ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}{kioskConfigured ? 'Rotate Kiosk Key' : 'Generate Kiosk Key'}</Button></CardContent></Card>
    <div className="flex items-center gap-3"><Button onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Settings</Button>{saved && <span className="flex items-center gap-1 text-sm text-success"><CheckCircle2 className="w-4 h-4" />Saved</span>}{saveError && <span className="text-sm text-destructive">{saveError}</span>}</div>
  </div></div>);
}
