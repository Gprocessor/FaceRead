import { useEffect, useState } from 'react';
import { Loader2, Download, Users, CalendarCheck, Clock, AlertTriangle } from 'lucide-react';
import { getAdminReports, type AdminReport } from '@/services/attendanceService';
import { DashboardCard } from '@/components/DashboardCard';
import { formatTime, formatScore } from '@/utils/validators';

export function Reports() {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    try { setReport(await getAdminReports(dateFrom || undefined, dateTo || undefined)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const exportCsv = () => {
    if (!report) return;
    const headers = ['Employee', 'Code', 'Department', 'Status', 'Check In', 'Check Out', 'Face Score', 'Liveness'];
    const rows = report.records.map((r) => [r.employee_name, r.employee_code, r.department ?? '', r.status, r.check_in_time ? formatTime(r.check_in_time) : '', r.check_out_time ? formatTime(r.check_out_time) : '', r.face_match_score ? (r.face_match_score * 100).toFixed(1) + '%' : '', r.liveness_score ? (r.liveness_score * 100).toFixed(1) + '%' : '']);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `report_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const inp = 'px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-slate-100">Reports</h1><p className="text-sm text-slate-400 mt-1">Organization-wide attendance analytics and export.</p></div>
        <button onClick={exportCsv} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 font-medium text-sm hover:bg-slate-700 transition-colors flex items-center gap-2"><Download className="w-4 h-4" /> Export CSV</button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="block text-xs font-medium text-slate-400 mb-1.5">From</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inp} /></div>
        <div><label className="block text-xs font-medium text-slate-400 mb-1.5">To</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inp} /></div>
        <button onClick={load} className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 transition-colors">Generate</button>
      </div>
      {loading ? (<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>)
        : report ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardCard title="Total Employees" value={report.total_employees} icon={<Users className="w-6 h-6" />} accent="sky" />
              <DashboardCard title="Present" value={report.present_today} icon={<CalendarCheck className="w-6 h-6" />} accent="emerald" />
              <DashboardCard title="Late" value={report.late_today} icon={<Clock className="w-6 h-6" />} accent="amber" />
              <DashboardCard title="Absent" value={report.absent_today} icon={<AlertTriangle className="w-6 h-6" />} accent="rose" />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-800 text-slate-400 text-xs">
                  <th className="text-left px-4 py-3 font-medium">Employee</th><th className="text-left px-4 py-3 font-medium">Code</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Dept</th><th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">In</th><th className="text-left px-4 py-3 font-medium">Out</th>
                  <th className="text-left px-4 py-3 font-medium">Face</th><th className="text-left px-4 py-3 font-medium">Live</th>
                </tr></thead>
                <tbody>
                  {report.records.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No records for the selected period.</td></tr>
                  ) : report.records.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/50 last:border-0">
                      <td className="px-4 py-3 text-slate-200">{r.employee_name}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{r.employee_code}</td>
                      <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{r.department ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-400 capitalize">{r.status}</td>
                      <td className="px-4 py-3 text-slate-400">{r.check_in_time ? formatTime(r.check_in_time) : '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{r.check_out_time ? formatTime(r.check_out_time) : '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{formatScore(r.face_match_score)}</td>
                      <td className="px-4 py-3 text-slate-400">{formatScore(r.liveness_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (<div className="py-12 text-center text-sm text-slate-500">No report data available</div>)}
    </div>
  );
}
