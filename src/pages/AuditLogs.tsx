import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { formatDate, formatTime } from '@/utils/validators';

interface AuditRow {
  id: string;
  action: string;
  entity_type: string | null;
  actor_role: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200);
        setLogs(data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Audit Logs</h1>
        <p className="text-sm text-slate-400 mt-1">
          System-wide audit trail of all sensitive actions.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No audit logs recorded yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Entity</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">IP</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-800/50 last:border-0">
                  <td className="px-4 py-3 text-slate-200 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-3 text-slate-400">{l.entity_type ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 capitalize">{l.actor_role ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                    {l.ip_address ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(l.created_at)}</td>
                  <td className="px-4 py-3 text-slate-400">{formatTime(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
