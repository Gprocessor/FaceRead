import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { formatDate, formatTime } from '@/utils/validators';
import { PageHeader } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
interface AuditRow { id: string; action: string; entity_type: string | null; actor_role: string | null; ip_address: string | null; created_at: string; }
export function AuditLogs() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { try { const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200); setLogs(data ?? []); } finally { setLoading(false); } })(); }, []);
  return (
    <div>
      <PageHeader title="Audit Log" description="Immutable trail of all sensitive actions" />
      <Card className="overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          : logs.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No audit entries yet.</div>
          : (
            <Table>
              <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Role</TableHead><TableHead className="hidden md:table-cell">IP</TableHead><TableHead>Date</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
              <TableBody>{logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="tnum text-xs font-medium">{l.action}</TableCell>
                  <TableCell className="text-muted-foreground">{l.entity_type ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{l.actor_role ?? '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{l.ip_address ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(l.created_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatTime(l.created_at)}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
      </Card>
    </div>
  );
}
