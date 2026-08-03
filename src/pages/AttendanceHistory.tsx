import { useEffect, useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { formatDate, formatTime, formatScore } from '@/utils/validators';

interface LogRow {
  id: string;
  attendance_date: string;
  check_type: string;
  status: string;
  verification_status: string;
  face_match_score: number | null;
  liveness_score: number | null;
  created_at: string;
}

export function AttendanceHistory() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('attendance_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (dateFrom) q = q.gte('attendance_date', dateFrom);
      if (dateTo) q = q.lte('attendance_date', dateTo);
      const { data } = await q;
      setLogs(data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    const headers = ['Date', 'Type', 'Status', 'Verification', 'Face Score', 'Liveness Score', 'Time'];
    const rows = logs.map((l) => [
      formatDate(l.attendance_date),
      l.check_type,
      l.status,
      l.verification_status,
      l.face_match_score ? (l.face_match_score * 100).toFixed(1) + '%' : '',
      l.liveness_score ? (l.liveness_score * 100).toFixed(1) + '%' : '',
      formatTime(l.created_at),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">My Attendance</h1>
          <p className="text-sm text-slate-400 mt-1">
            Your attendance history and verification records.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 font-medium text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500"
          />
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 transition-colors"
        >
          Filter
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No attendance records found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Verification</th>
                <th className="text-left px-4 py-3 font-medium">Face</th>
                <th className="text-left px-4 py-3 font-medium">Liveness</th>
                <th className="text-left px-4 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-800/50 last:border-0">
                  <td className="px-4 py-3 text-slate-300">{formatDate(l.attendance_date)}</td>
                  <td className="px-4 py-3 text-slate-400 capitalize">
                    {l.check_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-slate-400 capitalize">{l.status}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell capitalize">
                    {l.verification_status}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatScore(l.face_match_score)}</td>
                  <td className="px-4 py-3 text-slate-400">{formatScore(l.liveness_score)}</td>
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
