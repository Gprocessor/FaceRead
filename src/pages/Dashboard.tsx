import { useEffect, useMemo, useState } from 'react';
import { Users, CalendarCheck, Clock, AlertTriangle, Activity, ArrowUpRight, Sparkles } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { AreaChart } from '@/components/ui/area-chart';
import { Donut } from '@/components/ui/donut';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Sparkline } from '@/components/ui/sparkline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { getAdminReports, type AdminReport } from '@/services/attendanceService';
import { supabase } from '@/services/supabaseClient';
import { formatTime } from '@/utils/validators';

export function Dashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState<AdminReport | null>(null);
  const [trend, setTrend] = useState<{ label: string; onTime: number; late: number }[]>([]);
  const [deptRows, setDeptRows] = useState<{ name: string; present: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (user && ['super_admin', 'org_admin', 'hr_officer', 'supervisor'].includes(user.role)) {
          try { setReport(await getAdminReports()); } catch { /* ignore */ }
        }
        const { data } = await supabase.from('attendance_sessions')
          .select('attendance_date, status, employee_id')
          .order('attendance_date', { ascending: false }).limit(500);

        const b = new Map<string, { label: string; onTime: number; late: number }>();
        for (let i = 13; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          b.set(d.toISOString().slice(0, 10), { label: d.toLocaleDateString('en-US', { weekday: 'short' }), onTime: 0, late: 0 });
        }
        (data ?? []).forEach((s) => {
          const x = b.get(String(s.attendance_date).slice(0, 10));
          if (!x) return;
          if (s.status === 'late') x.late += 1;
          else if (s.status === 'present' || s.status === 'checked_out') x.onTime += 1;
        });
        setTrend([...b.values()]);

        const { data: emps } = await supabase.from('employees').select('id, departments(name)').eq('status', 'active');
        const today = new Date().toISOString().slice(0, 10);
        const attendedToday = new Set((data ?? [])
          .filter((s) => String(s.attendance_date).slice(0, 10) === today && ['present', 'late', 'checked_out'].includes(String(s.status)))
          .map((s) => s.employee_id));
        const dmap = new Map<string, { present: number; total: number }>();
        (emps ?? []).forEach((e: { id: string; departments?: { name?: string } | null }) => {
          const name = e.departments?.name || 'General';
          const cur = dmap.get(name) || { present: 0, total: 0 };
          cur.total += 1;
          if (attendedToday.has(e.id)) cur.present += 1;
          dmap.set(name, cur);
        });
        setDeptRows([...dmap.entries()].map(([name, v]) => ({ name, ...v })).sort((a, z) => z.total - a.total).slice(0, 6));
      } finally { setLoading(false); }
    })();
  }, [user]);

  const rate = report ? report.attendance_rate : 0;
  const attended = report ? (report.attended_today ?? report.present_today) : 0;
  const punctual = report && attended > 0 ? (attended - report.late_today) / attended : 0;
  const spark = useMemo(() => trend.slice(-10).map((t) => t.onTime + t.late), [trend]);

  const donut = report ? [
    { label: 'Present', value: Math.max(0, attended - report.late_today), color: 'var(--chart-3)' },
    { label: 'Late', value: report.late_today, color: 'var(--chart-2)' },
    { label: 'Absent', value: Math.max(0, report.absent_today), color: 'var(--chart-4)' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="hero-gradient ring-soft animate-rise rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><Sparkles className="size-3.5" /> Live overview</div>
            <h1 className="text-display mt-3 text-3xl font-bold">Welcome back, {user?.fullName || user?.email?.split('@')[0]}</h1>
            <p className="mt-1 text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {user?.organizationName ? ` \u00b7 ${user.organizationName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <ProgressRing value={rate} label="attendance" color="var(--chart-3)" />
            <ProgressRing value={punctual} label="punctual" color="var(--chart-1)" />
            <div className="hidden md:block">
              <p className="mb-1 text-xs text-muted-foreground">Check-ins (10d)</p>
              <Sparkline data={spark.length ? spark : [0, 0, 0, 0, 0]} className="h-10 w-32" />
            </div>
          </div>
        </div>
      </div>

      {loading ? <div className="text-sm text-muted-foreground">Loading&hellip;</div> : (
        <>
          {report && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Users} label="Total People" value={report.total_employees} tone="primary" />
              <StatCard icon={CalendarCheck} label="Attended today" value={attended} tone="success" delta={+(report.attendance_rate * 100).toFixed(0)} />
              <StatCard icon={Clock} label="Late arrivals" value={report.late_today} tone="warning" />
              <StatCard icon={AlertTriangle} label="Absent today" value={report.absent_today} tone="destructive" />
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Card className="animate-rise">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Attendance trend &middot; 14 days</CardTitle>
                <Badge variant="secondary" className="gap-1"><Activity className="size-3" /> on-time vs late</Badge>
              </CardHeader>
              <CardContent>
                <AreaChart data={trend.length ? trend : Array.from({ length: 14 }, () => ({ label: '\u00b7', onTime: 0, late: 0 }))} />
              </CardContent>
            </Card>

            <Card className="animate-rise">
              <CardHeader><CardTitle>Today&rsquo;s split</CardTitle></CardHeader>
              <CardContent className="flex items-center gap-6">
                <Donut
                  segments={donut.length ? donut : [{ label: '\u2014', value: 1, color: 'var(--muted)' }]}
                  center={<div><p className="text-display tnum text-2xl font-bold">{attended}</p><p className="text-[10px] text-muted-foreground">attended</p></div>}
                />
                <div className="space-y-2 text-sm">
                  {donut.map((d) => (
                    <div key={d.label} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="w-16 text-muted-foreground">{d.label}</span>
                      <span className="tnum font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
            <Card className="animate-rise">
              <CardHeader><CardTitle>Department readiness</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {deptRows.length === 0 ? <p className="text-sm text-muted-foreground">No department data yet.</p> : deptRows.map((d) => {
                  const pct = d.total ? d.present / d.total : 0;
                  return (
                    <div key={d.name}>
                      <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{d.name}</span><span className="tnum text-muted-foreground">{d.present}/{d.total}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-[var(--chart-3)]" style={{ width: `${pct * 100}%` }} /></div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="animate-rise">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent activity</CardTitle>
                <a href="#/reports" className="inline-flex items-center gap-1 text-xs text-primary">Full report <ArrowUpRight className="size-3" /></a>
              </CardHeader>
              <CardContent>
                {report && report.records.length > 0 ? (
                  <Table>
                    <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead className="hidden md:table-cell">Dept</TableHead><TableHead>Status</TableHead><TableHead>In</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {report.records.slice(0, 6).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.employee_name}</TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">{r.department ?? '\u2014'}</TableCell>
                          <TableCell><Badge variant={r.status === 'late' ? 'warning' : 'success'}>{r.status}</Badge></TableCell>
                          <TableCell className="tnum text-muted-foreground">{r.check_in_time ? formatTime(r.check_in_time) : '\u2014'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <p className="text-sm text-muted-foreground">No one has checked in yet today.</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
