import { useEffect, useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { formatDate, formatTime, formatScore } from '@/utils/validators';
import { PageHeader } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface LogRow { id: string; attendance_date: string; check_type: string; status: string; verification_status: string; face_match_score: number | null; liveness_score: number | null; created_at: string; }
export function AttendanceHistory() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const load = async () => {
    setLoading(true);
    try {
      let q = supabase.from('attendance_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (dateFrom) q = q.gte('attendance_date', dateFrom);
      if (dateTo) q = q.lte('attendance_date', dateTo);
      const { data } = await q; setLogs(data ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const exportCsv = () => {
    const headers = ['Date', 'Type', 'Status', 'Verification', 'Face Score', 'Liveness Score', 'Time'];
    const rows = logs.map((l) => [formatDate(l.attendance_date), l.check_type, l.status, l.verification_status, l.face_match_score ? (l.face_match_score * 100).toFixed(1) + '%' : '', l.liveness_score ? (l.liveness_score * 100).toFixed(1) + '%' : '', formatTime(l.created_at)]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `attendance_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div>
      <PageHeader title="My Attendance" description="Your attendance history and verification records"
        actions={<Button variant="secondary" onClick={exportCsv}><Download className="w-4 h-4" />Export CSV</Button>} />
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div><label className="text-xs font-medium text-muted-foreground">From</label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">To</label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" /></div>
        <Button onClick={load}>Filter</Button>
      </div>
      <Card className="overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          : logs.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No attendance records found</div>
          : (
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead className="hidden md:table-cell">Verification</TableHead><TableHead>Face</TableHead><TableHead>Liveness</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
              <TableBody>{logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{formatDate(l.attendance_date)}</TableCell>
                  <TableCell className="capitalize">{l.check_type.replace('_', ' ')}</TableCell>
                  <TableCell><Badge variant={l.status === 'late' ? 'warning' : l.status.includes('failed') ? 'destructive' : 'secondary'}>{l.status}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground capitalize">{l.verification_status}</TableCell>
                  <TableCell className="tnum text-muted-foreground">{formatScore(l.face_match_score)}</TableCell>
                  <TableCell className="tnum text-muted-foreground">{formatScore(l.liveness_score)}</TableCell>
                  <TableCell className="tnum text-muted-foreground">{formatTime(l.created_at)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
      </Card>
    </div>
  );
}
