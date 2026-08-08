import { useEffect, useMemo, useState } from 'react';
import { Loader2, Download, Users, CalendarCheck, Clock, AlertTriangle, Search, Filter } from 'lucide-react';
import { getAdminReports, type AdminReport } from '@/services/attendanceService';
import { StatCard } from '@/components/ui/stat-card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Donut } from '@/components/ui/donut';
import { PageHeader } from '@/components/AppShell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatTime, formatScore } from '@/utils/validators';

type StatusFilter = 'all'|'present'|'late'|'absent'|'failed_verification';

export function Reports() {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const [q, setQ] = useState(''); const [status, setStatus] = useState<StatusFilter>('all'); const [dept, setDept] = useState('all');

  const load = async () => { setLoading(true); try { setReport(await getAdminReports(dateFrom || undefined, dateTo || undefined)); } finally { setLoading(false); } };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const departments = useMemo(() => Array.from(new Set((report?.records ?? []).map((r) => r.department).filter(Boolean))) as string[], [report]);
  const rows = useMemo(() => (report?.records ?? []).filter((r) =>
    (status === 'all' || r.status === status) &&
    (dept === 'all' || r.department === dept) &&
    (q === '' || r.employee_name.toLowerCase().includes(q.toLowerCase()) || r.employee_code.toLowerCase().includes(q.toLowerCase()))
  ), [report, status, dept, q]);

  const rate = report ? report.attendance_rate : 0;
  const donut = report ? [
    { label: 'Present', value: report.present_today, color: 'var(--chart-3)' },
    { label: 'Late', value: report.late_today, color: 'var(--chart-2)' },
    { label: 'Absent', value: Math.max(0, report.absent_today), color: 'var(--chart-4)' },
  ] : [];

  const exportCsv = () => {
    if (!report) return;
    const headers = ['Employee','Code','Department','Status','Check In','Check Out','Face Score','Liveness'];
    const data = rows.map((r) => [r.employee_name, r.employee_code, r.department ?? '', r.status, r.check_in_time ? formatTime(r.check_in_time) : '', r.check_out_time ? formatTime(r.check_out_time) : '', r.face_match_score ? (r.face_match_score*100).toFixed(1)+'%' : '', r.liveness_score ? (r.liveness_score*100).toFixed(1)+'%' : '']);
    const csv = [headers, ...data].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `report_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const pill = (label: string, v: StatusFilter) => (<button onClick={() => setStatus(v)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{label}</button>);

  return (
    <div>
      <PageHeader title="Reports" description="Attendance analytics, filters and export — built for supervisors." actions={<Button variant="secondary" onClick={exportCsv}><Download className="w-4 h-4" />Export CSV</Button>} />

      {/* Filter bar */}
      <Card className="mb-6"><CardContent className="pt-5 flex flex-wrap items-end gap-3">
        <div><label className="text-xs font-medium text-muted-foreground">From</label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">To</label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" /></div>
        <Button onClick={load} className="h-9"><Filter className="w-4 h-4" />Apply</Button>
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9 mt-0" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code…" /></div>
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="all">All departments</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}</select>
      </CardContent></Card>

      {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div> : report ? (<div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[repeat(4,1fr)_auto]">
          <StatCard icon={Users} label="Total People" value={report.total_employees} tone="primary" />
          <StatCard icon={CalendarCheck} label="Present" value={report.present_today} tone="success" />
          <StatCard icon={Clock} label="Late" value={report.late_today} tone="warning" />
          <StatCard icon={AlertTriangle} label="Absent" value={report.absent_today} tone="destructive" />
          <Card className="flex items-center justify-center p-4"><div className="flex items-center gap-4"><ProgressRing value={rate} label="rate" /><Donut size={96} thickness={12} segments={donut.length ? donut : [{label:'—',value:1,color:'var(--muted)'}]} center={<span className="text-xs text-muted-foreground">today</span>} /></div></Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">{pill('All', 'all')}{pill('Present', 'present')}{pill('Late', 'late')}{pill('Absent', 'absent')}{pill('Failed', 'failed_verification')}<span className="text-xs text-muted-foreground ml-2">{rows.length} record{rows.length===1?'':'s'}</span></div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Code</TableHead><TableHead className="hidden md:table-cell">Dept</TableHead><TableHead>Status</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>Face</TableHead><TableHead>Live</TableHead></TableRow></TableHeader>
            <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No records match your filters.</TableCell></TableRow> : rows.map((r, i) => (
              <TableRow key={i}><TableCell className="font-medium">{r.employee_name}</TableCell><TableCell className="tnum text-xs text-muted-foreground">{r.employee_code}</TableCell><TableCell className="hidden md:table-cell text-muted-foreground">{r.department ?? '—'}</TableCell><TableCell><Badge variant={r.status === 'late' ? 'warning' : r.status.includes('failed') ? 'destructive' : r.status === 'absent' ? 'outline' : 'success'}>{r.status}</Badge></TableCell><TableCell className="tnum text-muted-foreground">{r.check_in_time ? formatTime(r.check_in_time) : '—'}</TableCell><TableCell className="tnum text-muted-foreground">{r.check_out_time ? formatTime(r.check_out_time) : '—'}</TableCell><TableCell className="tnum text-muted-foreground">{formatScore(r.face_match_score)}</TableCell><TableCell className="tnum text-muted-foreground">{formatScore(r.liveness_score)}</TableCell></TableRow>
            ))}</TableBody>
          </Table>
        </Card>
      </div>) : <Card className="p-12 text-center text-muted-foreground">No report data available</Card>}
    </div>
  );
}
