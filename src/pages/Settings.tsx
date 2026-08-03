import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Loader2, Save, CheckCircle2 } from 'lucide-react';
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
      <div className="flex flex-col items-center py-12 text-slate-500">
        <SettingsIcon className="w-10 h-10 mb-3" />
        <p className="text-sm">No settings found for your organization.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure attendance rules and verification thresholds for your organization.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Attendance Rules</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Late Threshold (minutes)
              </label>
              <input
                type="number"
                value={settings.late_threshold_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, late_threshold_minutes: +e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Duplicate Window (minutes)
              </label>
              <input
                type="number"
                value={settings.duplicate_check_window_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, duplicate_check_window_minutes: +e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Work Start Time
              </label>
              <input
                type="time"
                value={settings.work_start_time}
                onChange={(e) => setSettings({ ...settings, work_start_time: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Work End Time
              </label>
              <input
                type="time"
                value={settings.work_end_time}
                onChange={(e) => setSettings({ ...settings, work_end_time: e.target.value })}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Verification Thresholds</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Face Match Threshold
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.face_match_threshold}
                onChange={(e) =>
                  setSettings({ ...settings, face_match_threshold: +e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Liveness Threshold
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.liveness_threshold}
                onChange={(e) =>
                  setSettings({ ...settings, liveness_threshold: +e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Min Face Confidence
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.min_face_confidence}
                onChange={(e) =>
                  setSettings({ ...settings, min_face_confidence: +e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Max Allowed Faces
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={settings.max_allowed_faces}
                onChange={(e) =>
                  setSettings({ ...settings, max_allowed_faces: +e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Feature Toggles</h3>
          <div className="space-y-3">
            {([
              ['require_liveness', 'Require liveness detection'],
              ['require_check_out', 'Require check-out'],
              ['allow_multiple_check_in', 'Allow multiple check-ins per day'],
              ['geofencing_enabled', 'Enable geofencing'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
