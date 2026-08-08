import { useEffect, useState } from 'react';
import { Loader2, Download, Users, CalendarCheck, Clock, AlertTriangle } from 'lucide-react';
import { getAdminReports, type AdminReport } from '@/services/attendanceService';
import { StatCard } from '@/components/ui/stat-card';
import { PageHeader } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatTime, formatScore } from '@/utils/validators';
export function Reports() {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const load = async () => { setLoading(true); try { setReport(await getAdminReports(dateFrom || undefined, dateTo || undefined)); } finally { setLoading(false); } };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const exportCsv = () => {
    if (!report) return;
    const headers = ['Employee', 'Code', 'Department', 'Status', 'Check In', 'Check Out', 'Face Score', 'Liveness'];
    const rows = report.records.map((r) => [r.employee_name, r.employee_code, r.department ?? '', r.status, r.check_in_time ? formatTime(r.check_in_time) : '', r.check_out_time ? formatTime(r.check_out_time) : '', r.face_match_score ? (r.face_match_score * 100).toFixed(1) + '%' : '', r.liveness_score ? (r.liveness_score * 100).toFixed(1) + '%' : '']);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `report_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div>
      <PageHeader title="Reports" description="Organization-wide attendance analytics and export" actions={<Button variant="secondary" onClick={exportCsv}><Download className="w-4 h-4" />Export CSV</Button>} />
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div><label className="text-xs font-medium text-muted-foreground">From</label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">To</label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" /></div>
        <Button onClick={load}>Generate</Button>
      </div>
      {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        : report ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total People" value={report.total_employees} tone="primary" />
              <StatCard icon={CalendarCheck} label="Present" value={report.present_today} tone="success" />
              <StatCard icon={Clock} label="Late" value={report.late_today} tone="warning" />
              <StatCard icon={AlertTriangle} label="Absent" value={report.absent_today} tone="destructive" />
            </div>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Code</TableHead><TableHead className="hidden md:table-cell">Dept</TableHead><TableHead>Status</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>Face</TableHead><TableHead>Live</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.records.length === 0 ? <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No records for the selected period.</TableCell></TableRow>
                    : report.records.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{r.employee_name}</TableCell>
                        <TableCell className="tnum text-xs text-muted-foreground">{r.employee_code}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">{r.department ?? '—'}</TableCell>
                        <TableCell><Badge variant={r.status === 'late' ? 'warning' : 'secondary'}>{r.status}</Badge></TableCell>
                        <TableCell className="tnum text-muted-foreground">{r.check_in_time ? formatTime(r.check_in_time) : '—'}</TableCell>
                        <TableCell className="tnum text-muted-foreground">{r.check_out_time ? formatTime(r.check_out_time) : '—'}</TableCell>
                        <TableCell className="tnum text-muted-foreground">{formatScore(r.face_match_score)}</TableCell>
                        <TableCell className="tnum text-muted-foreground">{formatScore(r.liveness_score)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        ) : <Card className="p-12 text-center text-muted-foreground">No report data available</Card>}
    </div>
  );
}
