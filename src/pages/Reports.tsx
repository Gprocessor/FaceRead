import { useEffect, useState } from 'react';
import { FileBarChart, Loader2, Download, Users, CalendarCheck, Clock, AlertTriangle } from 'lucide-react';
import { getAdminReports, type AdminReport } from '@/services/attendanceService';
import { DashboardCard } from '@/components/DashboardCard';
import { formatDate, formatTime, formatScore } from '@/utils/validators';

export function Reports() {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await getAdminReports(dateFrom || undefined, dateTo || undefined);
      setReport(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    if (!report) return;
    const headers = ['Employee', 'Code', 'Department', 'Status', 'Check In', 'Check Out', 'Face Score', 'Liveness'];
    const rows = report.records.map((r) => [
      r.employee_name,
      r.employee_code,
      r.department ?? '',
      r.status,
      r.check_in_time ? formatTime(r.check_in_time) : '',
      r.check_out_time ? formatTime(r.check_out_time) : '',
      r.face_match_score ? (r.face_match_score * 100).toFixed(1) + '%' : '',
      r.liveness_score ? (r.liveness_score * 100).toFixed(1) + '%' : '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Reports</h1>
          <p className="text-sm text-slate-400 mt-1">
            Organization-wide attendance analytics and export.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!report || report.records.length === 0}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium text-sm hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex gap-3 items-end">
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
          className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400"
        >
          Generate
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardCard title="Total" value={report.total_employees} icon={<Users className="w-6 h-6" />} accent="sky" />
            <DashboardCard title="Present" value={report.present_today} icon={<CalendarCheck className="w-6 h-6" />} accent="emerald" />
            <DashboardCard title="Late" value={report.late_today} icon={<Clock className="w-6 h-6" />} accent="amber" />
            <DashboardCard title="Failed" value={report.failed_verification_today} icon={<AlertTriangle className="w-6 h-6" />} accent="rose" />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs">
                    <th className="text-left px-4 py-3 font-medium">Employee</th>
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Dept</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">In</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Out</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Face</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Live</th>
                  </tr>
                </thead>
                <tbody>
                  {report.records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        No records for the selected period.
                      </td>
                    </tr>
                  ) : (
                    report.records.map((r, i) => (
                      <tr key={i} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-200">{r.employee_name}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{r.employee_code}</td>
                        <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{r.department ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.status === 'present'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : r.status === 'late'
                                ? 'bg-amber-500/10 text-amber-400'
                                : r.status === 'absent'
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                          {r.check_in_time ? formatTime(r.check_in_time) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                          {r.check_out_time ? formatTime(r.check_out_time) : '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                          {formatScore(r.face_match_score)}
                        </td>
                        <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                          {formatScore(r.liveness_score)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center py-12 text-slate-500">
          <FileBarChart className="w-10 h-10 mb-3" />
          <p className="text-sm">No report data available</p>
        </div>
      )}
    </div>
  );
}
