import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Download, Users, CalendarCheck, Clock, AlertTriangle, Search, RefreshCw } from 'lucide-react';
import { getAdminReports, type AdminReport } from '@/services/attendanceService';
import { StatCard } from '@/components/ui/stat-card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Donut } from '@/components/ui/donut';
import { PageHeader } from '@/components/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatTime, formatScore } from '@/utils/validators';

type StatusFilter = 'all' | 'attended' | 'present' | 'late' | 'checked_out' | 'failed';
type Preset = 'today' | 'yesterday' | 'last7' | 'month' | 'custom';

const toLocalISO = (d: Date) => d.toLocaleDateString('en-CA');
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function presetRange(preset: Preset): [string, string] | null {
  const now = new Date();
  if (preset === 'today') return [toLocalISO(now), toLocalISO(now)];
  if (preset === 'yesterday') { const y = addDays(now, -1); return [toLocalISO(y), toLocalISO(y)]; }
  if (preset === 'last7') return [toLocalISO(addDays(now, -6)), toLocalISO(now)];
  if (preset === 'month') return [toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1)), toLocalISO(now)];
  return null;
}

function matchesStatus(status: string, filter: StatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'attended') return status === 'present' || status === 'late' || status === 'checked_out';
  if (filter === 'failed') return status.includes('failed') || status.includes('rejected');
  return status === filter;
}

function statusVariant(status: string): 'warning' | 'destructive' | 'secondary' | 'success' | 'outline' {
  if (status === 'late') return 'warning';
  if (status.includes('failed') || status.includes('rejected')) return 'destructive';
  if (status === 'checked_out') return 'secondary';
  if (status === 'absent') return 'outline';
  return 'success';
}

export function Reports() {
  const today = toLocalISO(new Date());
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>('today');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [dept, setDept] = useState('all');
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    const id = ++requestId.current;
    setLoading(true); setError(null);
    try {
      const data = await getAdminReports(dateFrom, dateTo);
      if (id === requestId.current) setReport(data);
    } catch (e) {
      if (id === requestId.current) { setError(e instanceof Error ? e.message : 'Failed to load report'); setReport(null); }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const choosePreset = (p: Preset) => {
    setPreset(p);
    const r = presetRange(p);
    if (r) { setDateFrom(r[0]); setDateTo(r[1]); }
  };

  const departments = useMemo(() => Array.from(new Set((report?.records ?? []).map((r) => r.department).filter(Boolean))) as string[], [report]);
  const rows = useMemo(() => (report?.records ?? []).filter((r) =>
    matchesStatus(r.status, status) &&
    (dept === 'all' || r.department === dept) &&
    (q === '' || r.employee_name.toLowerCase().includes(q.toLowerCase()) || r.employee_code.toLowerCase().includes(q.toLowerCase()))
  ), [report, status, dept, q]);

  const rate = report ? report.attendance_rate : 0;
  const attended = report ? (report.attended_today ?? report.present_today) : 0;
  const donut = report ? [
    { label: 'Attended', value: attended, color: 'var(--chart-3)' },
    { label: 'Late', value: report.late_today, color: 'var(--chart-2)' },
    { label: 'Absent', value: Math.max(0, report.absent_today), color: 'var(--chart-4)' },
  ] : [];
  const single = dateFrom === dateTo;
  const rangeLabel = single ? formatDate(dateFrom) : `${formatDate(dateFrom)} – ${formatDate(dateTo)}`;

  const exportCsv = () => {
    if (!report) return;
    const headers = ['Date', 'Employee', 'Code', 'Department', 'Status', 'Check In', 'Check Out', 'Face Score', 'Liveness'];
    const data = rows.map((r) => [r.attendance_date ?? '', r.employee_name, r.employee_code, r.department ?? '', r.status, r.check_in_time ? formatTime(r.check_in_time) : '', r.check_out_time ? formatTime(r.check_out_time) : '', r.face_match_score != null ? (r.face_match_score * 100).toFixed(1) + '%' : '', r.liveness_score != null ? (r.liveness_score * 100).toFixed(1) + '%' : '']);
    const csv = [headers, ...data].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `attendance_${dateFrom}_to_${dateTo}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const presetBtn = (label: string, p: Preset) => (
    <button key={p} onClick={() => choosePreset(p)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${preset === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{label}</button>
  );
  const pill = (label: string, v: StatusFilter) => (
    <button key={v} onClick={() => setStatus(v)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${status === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{label}</button>
  );

  return (
    <div>
      <PageHeader title="Reports" description={`Attendance for ${rangeLabel}`} actions={<>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        <Button variant="secondary" onClick={exportCsv} disabled={!report}><Download className="w-4 h-4" />Export CSV</Button>
      </>} />

      <Card className="mb-6"><CardContent className="pt-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {presetBtn('Today', 'today')}{presetBtn('Yesterday', 'yesterday')}{presetBtn('Last 7 days', 'last7')}{presetBtn('This month', 'month')}{presetBtn('Custom', 'custom')}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="text-xs font-medium text-muted-foreground">From</label><Input type="date" value={dateFrom} max={today} onChange={(e) => { setPreset('custom'); setDateFrom(e.target.value); }} className="mt-1" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">To</label><Input type="date" value={dateTo} max={today} onChange={(e) => { setPreset('custom'); setDateTo(e.target.value); }} className="mt-1" /></div>
          <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or code…" /></div>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"><option value="all">All departments</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        </div>
      </CardContent></Card>

      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-4">{error}</div>}

      {loading && !report ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div> : report ? (<div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[repeat(4,1fr)_auto]">
          <StatCard icon={Users} label="Total People" value={report.total_employees} tone="primary" sub={single ? undefined : `${report.days} days`} />
          <StatCard icon={CalendarCheck} label="Attended" value={attended} tone="success" />
          <StatCard icon={Clock} label="Late" value={report.late_today} tone="warning" />
          <StatCard icon={AlertTriangle} label={single ? 'Absent' : 'Absent (person-days)'} value={report.absent_today} tone="destructive" />
          <Card className="flex items-center justify-center p-4"><div className="flex items-center gap-4"><ProgressRing value={rate} label="rate" /><Donut size={96} thickness={12} segments={donut.some((d) => d.value > 0) ? donut : [{ label: '—', value: 1, color: 'var(--muted)' }]} center={<span className="text-[10px] text-muted-foreground">{single ? 'day' : 'range'}</span>} /></div></Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pill('All', 'all')}{pill('Attended', 'attended')}{pill('Present', 'present')}{pill('Late', 'late')}{pill('Checked out', 'checked_out')}{pill('Failed', 'failed')}
          <span className="text-xs text-muted-foreground ml-2">{rows.length} record{rows.length === 1 ? '' : 's'}</span>
          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Code</TableHead><TableHead className="hidden md:table-cell">Dept</TableHead><TableHead>Status</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>Face</TableHead><TableHead>Live</TableHead></TableRow></TableHeader>
            <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No records match your filters.</TableCell></TableRow> : rows.map((r, i) => (
              <TableRow key={`${r.employee_id}-${r.attendance_date}-${i}`}>
                <TableCell className="tnum text-muted-foreground">{r.attendance_date ? formatDate(r.attendance_date) : '—'}</TableCell>
                <TableCell className="font-medium">{r.employee_name}</TableCell>
                <TableCell className="tnum text-xs text-muted-foreground">{r.employee_code}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">{r.department ?? '—'}</TableCell>
                <TableCell><Badge variant={statusVariant(r.status)}>{r.status.replace('_', ' ')}</Badge></TableCell>
                <TableCell className="tnum text-muted-foreground">{r.check_in_time ? formatTime(r.check_in_time) : '—'}</TableCell>
                <TableCell className="tnum text-muted-foreground">{r.check_out_time ? formatTime(r.check_out_time) : '—'}</TableCell>
                <TableCell className="tnum text-muted-foreground">{formatScore(r.face_match_score)}</TableCell>
                <TableCell className="tnum text-muted-foreground">{formatScore(r.liveness_score)}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </Card>
      </div>) : <Card className="p-12 text-center text-muted-foreground">No report data available</Card>}
    </div>
  );
}
