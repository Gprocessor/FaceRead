import { useEffect, useState } from 'react';
import { Users, CalendarCheck, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { DashboardCard } from '@/components/DashboardCard';
import { useAuth } from '@/hooks/useAuth';
import { getAdminReports, type AdminReport } from '@/services/attendanceService';
import { supabase } from '@/services/supabaseClient';
import { formatTime } from '@/utils/validators';

export function Dashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState<AdminReport | null>(null);
  const [myAttendance, setMyAttendance] = useState<
    Array<{ attendance_date: string; status: string; check_in_time: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (user && ['super_admin', 'org_admin', 'hr_officer', 'supervisor'].includes(user.role)) {
          const r = await getAdminReports();
          setReport(r);
        }
        if (user) {
          const { data } = await supabase
            .from('attendance_sessions')
            .select('attendance_date, status, check_in_time')
            .order('attendance_date', { ascending: false })
            .limit(5);
          setMyAttendance(data ?? []);
        }
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const isAdmin = user && ['super_admin', 'org_admin', 'hr_officer'].includes(user.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">
          Welcome back, {user?.fullName || user?.email?.split('@')[0]}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Here's your attendance overview for today.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {isAdmin && report && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardCard
                title="Total Employees"
                value={report.total_employees}
                icon={<Users className="w-6 h-6" />}
                accent="sky"
              />
              <DashboardCard
                title="Present Today"
                value={report.present_today}
                icon={<CalendarCheck className="w-6 h-6" />}
                accent="emerald"
                trend="up"
              />
              <DashboardCard
                title="Late Today"
                value={report.late_today}
                icon={<Clock className="w-6 h-6" />}
                accent="amber"
              />
              <DashboardCard
                title="Absent Today"
                value={report.absent_today}
                icon={<AlertTriangle className="w-6 h-6" />}
                accent="rose"
                trend="down"
              />
            </div>
          )}

          {isAdmin && report && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-200">
                  Attendance Rate
                </h3>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-slate-100">
                  {(report.attendance_rate * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-slate-500 mb-1">today</p>
              </div>
              <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${report.attendance_rate * 100}%` }}
                />
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-200 mb-3">
              Recent Attendance
            </h3>
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              {myAttendance.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">
                  No attendance records yet.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs">
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Check In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAttendance.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-800/50 last:border-0"
                      >
                        <td className="px-4 py-3 text-slate-300">
                          {new Date(row.attendance_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.status === 'present'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : row.status === 'late'
                                ? 'bg-amber-500/10 text-amber-400'
                                : row.status === 'absent'
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {row.check_in_time ? formatTime(row.check_in_time) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
