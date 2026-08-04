import { useEffect, useState } from 'react';
import { Users, CalendarCheck, Clock, AlertTriangle } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { MiniBars } from '@/components/ui/mini-bars';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { getAdminReports, type AdminReport } from '@/services/attendanceService';
import { supabase } from '@/services/supabaseClient';
import { formatTime } from '@/utils/validators';

export function Dashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState<AdminReport | null>(null);
  const [mine, setMine] = useState<Array<{ attendance_date: string; status: string; check_in_time: string | null }>>([]);
  const [trend, setTrend] = useState<{ label: string; onTime: number; late: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (user && ['super_admin', 'org_admin', 'hr_officer', 'supervisor'].includes(user.role)) {
          try { setReport(await getAdminReports()); } catch { /* non-critical */ }
        }
        if (user) {
          const { data } = await supabase.from('attendance_sessions').select('attendance_date, status, check_in_time').order('attendance_date', { ascending: false }).limit(20);
          setMine((data ?? []).slice(0, 5));
          // build 7-day trend from sessions
          const buckets = new Map<string, { label: string; onTime: number; late: number }>();
          for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('en-US', { weekday: 'short' });
            buckets.set(d.toISOString().slice(0, 10), { label: key, onTime: 0, late: 0 });
          }
          (data ?? []).forEach((s) => {
            const b = buckets.get(String(s.attendance_date).slice(0, 10));
            if (!b) return;
            if (s.status === 'late') b.late += 1; else if (s.status === 'present') b.onTime += 1;
          });
          setTrend([...buckets.values()]);
        }
      } finally { setLoading(false); }
    })();
  }, [user]);

  const isAdmin = user && ['super_admin', 'org_admin', 'hr_officer'].includes(user.role);
  return (
    <div>
      <PageHeader title={`Welcome back, ${user?.fullName || user?.email?.split('@')[0]}`} description={new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="space-y-6">
          {isAdmin && report && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total People" value={report.total_employees} tone="primary" />
              <StatCard icon={CalendarCheck} label="Present today" value={report.present_today} tone="success" />
              <StatCard icon={Clock} label="Late arrivals" value={report.late_today} tone="warning" />
              <StatCard icon={AlertTriangle} label="Absent today" value={report.absent_today} tone="destructive" />
            </div>
          )}
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader><CardTitle>Check-ins, last 7 days</CardTitle></CardHeader>
              <CardContent><MiniBars data={trend.length ? trend : Array.from({ length: 7 }, (_, i) => ({ label: ['S','M','T','W','T','F','S'][i], onTime: 0, late: 0 }))} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Recent attendance</CardTitle></CardHeader>
              <CardContent>
                {mine.length === 0 ? <p className="text-sm text-muted-foreground">No attendance records yet.</p> : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Check In</TableHead></TableRow></TableHeader>
                    <TableBody>{mine.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{new Date(r.attendance_date).toLocaleDateString()}</TableCell>
                        <TableCell><Badge variant={r.status === 'late' ? 'warning' : 'secondary'}>{r.status}</Badge></TableCell>
                        <TableCell className="tnum text-sm text-muted-foreground">{r.check_in_time ? formatTime(r.check_in_time) : '—'}</TableCell>
                      </TableRow>
                    ))}</TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
          {isAdmin && report && (
            <Card><CardContent className="pt-5 flex items-baseline gap-3">
              <span className="text-sm text-muted-foreground">Attendance rate today</span>
              <span className="text-display tnum text-3xl font-bold text-success">{(report.attendance_rate * 100).toFixed(1)}%</span>
            </CardContent></Card>
          )}
        </div>
      )}
    </div>
  );
}
