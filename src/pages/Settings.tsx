import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

interface AppSettings {
  id: string;
  late_threshold_minutes: number;
  work_start_time: string;
  work_end_time: string;
  require_liveness: boolean;
  require_check_out: boolean;
  allow_multiple_check_in: boolean;
  duplicate_check_window_minutes: number;
  face_match_threshold: number;
  liveness_threshold: number;
  max_allowed_faces: number;
  min_face_confidence: number;
  geofencing_enabled: boolean;
}

export function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user?.organizationId) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('organization_id', user.organizationId)
        .maybeSingle();
      if (data) setSettings(data as AppSettings);
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!settings || !user?.organizationId) return;
    setSaving(true);
    setSaved(false);
    try {
      await supabase.from('app_settings').upsert({
        organization_id: user.organizationId,
        late_threshold_minutes: settings.late_threshold_minutes,
        work_start_time: settings.work_start_time,
        work_end_time: settings.work_end_time,
        require_liveness: settings.require_liveness,
        require_check_out: settings.require_check_out,
        allow_multiple_check_in: settings.allow_multiple_check_in,
        duplicate_check_window_minutes: settings.duplicate_check_window_minutes,
        face_match_threshold: settings.face_match_threshold,
        liveness_threshold: settings.liveness_threshold,
        max_allowed_faces: settings.max_allowed_faces,
        min_face_confidence: settings.min_face_confidence,
        geofencing_enabled: settings.geofencing_enabled,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        No settings found for your organization.
      </div>
    );
  }

  const numberField = (
    label: string,
    key: keyof AppSettings,
    step = '1'
  ) => (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input
        type="number"
        step={step}
        value={settings[key] as number}
        onChange={(e) => setSettings({ ...settings, [key]: +e.target.value })}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
      />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure attendance rules and verification thresholds for your organization.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Attendance Rules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {numberField('Late Threshold (minutes)', 'late_threshold_minutes')}
          {numberField('Duplicate Window (minutes)', 'duplicate_check_window_minutes')}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Work Start Time</label>
            <input
              type="time"
              value={settings.work_start_time}
              onChange={(e) => setSettings({ ...settings, work_start_time: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Work End Time</label>
            <input
              type="time"
              value={settings.work_end_time}
              onChange={(e) => setSettings({ ...settings, work_end_time: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Verification Thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {numberField('Face Match Threshold', 'face_match_threshold', '0.05')}
          {numberField('Liveness Threshold', 'liveness_threshold', '0.05')}
          {numberField('Min Face Confidence', 'min_face_confidence', '0.05')}
          {numberField('Max Allowed Faces', 'max_allowed_faces')}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Feature Toggles</h3>
        {(
          [
            ['require_liveness', 'Require liveness detection'],
            ['require_check_out', 'Require check-out'],
            ['allow_multiple_check_in', 'Allow multiple check-ins per day'],
            ['geofencing_enabled', 'Enable geofencing'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings[key] as boolean}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500 focus:ring-offset-0"
            />
            {label}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
