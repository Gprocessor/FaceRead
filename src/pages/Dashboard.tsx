import { useEffect, useState } from 'react';
import { Users, CalendarCheck, Clock, AlertTriangle } from 'lucide-react';
import { DashboardCard } from '@/components/DashboardCard';
import { useAuth } from '@/hooks/useAuth';
import { getAdminReports, type AdminReport } from '@/services/attendanceService';
import { supabase } from '@/services/supabaseClient';
import { formatTime } from '@/utils/validators';

export function Dashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState<AdminReport | null>(null);
  const [myAttendance, setMyAttendance] = useState<Array<{ attendance_date: string; status: string; check_in_time: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (user && ['super_admin', 'org_admin', 'hr_officer', 'supervisor'].includes(user.role)) {
          try { setReport(await getAdminReports()); } catch { /* non-critical */ }
        }
        if (user) {
          const { data } = await supabase
            .from('attendance_sessions')
            .select('attendance_date, status, check_in_time')
            .order('attendance_date', { ascending: false })
            .limit(5);
          setMyAttendance(data ?? []);
        }
      } finally { setLoading(false); }
    })();
  }, [user]);

  const isAdmin = user && ['super_admin', 'org_admin', 'hr_officer'].includes(user.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Welcome back, {user?.fullName || user?.email?.split('@')[0]}</h1>
        <p className="text-sm text-slate-400 mt-1">Here's your attendance overview for today.</p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          {isAdmin && report && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardCard title="Total Employees" value={report.total_employees} icon={<Users className="w-6 h-6" />} accent="sky" />
              <DashboardCard title="Present Today" value={report.present_today} icon={<CalendarCheck className="w-6 h-6" />} accent="emerald" trend="up" />
              <DashboardCard title="Late Today" value={report.late_today} icon={<Clock className="w-6 h-6" />} accent="amber" />
              <DashboardCard title="Absent Today" value={report.absent_today} icon={<AlertTriangle className="w-6 h-6" />} accent="rose" trend="down" />
            </div>
          )}

          {isAdmin && report && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h3 className="text-sm font-semibold text-slate-300">Attendance Rate</h3>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{(report.attendance_rate * 100).toFixed(1)}%</p>
              <p className="text-xs text-slate-500 mt-1">today</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Recent Attendance</h3>
            {myAttendance.length === 0 ? (
              <p className="text-sm text-slate-500">No attendance records yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs">
                    <th className="text-left px-2 py-2 font-medium">Date</th>
                    <th className="text-left px-2 py-2 font-medium">Status</th>
                    <th className="text-left px-2 py-2 font-medium">Check In</th>
                  </tr>
                </thead>
                <tbody>
                  {myAttendance.map((row, i) => (
                    <tr key={i} className="border-b border-slate-800/50 last:border-0">
                      <td className="px-2 py-2 text-slate-300">{new Date(row.attendance_date).toLocaleDateString()}</td>
                      <td className="px-2 py-2 text-slate-400 capitalize">{row.status}</td>
                      <td className="px-2 py-2 text-slate-400">{row.check_in_time ? formatTime(row.check_in_time) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
