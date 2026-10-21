import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { formatDate, formatTime } from '@/utils/validators';
import { PageHeader } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Row { id: string; action: string; entity_type: string | null; actor_role: string | null; ip_address: string | null; created_at: string; }

export function AuditLogs() {
  const [logs, setLogs] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
        setLogs(data ?? []);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Audit Log" description="Every privileged action, recorded for compliance" />
      <Card className="overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
          : logs.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No audit entries yet.</div>
            : (
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Role</TableHead><TableHead className="hidden md:table-cell">IP</TableHead><TableHead>Date</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.action}</TableCell>
                      <TableCell className="text-muted-foreground">{l.entity_type ?? '\u2014'}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{l.actor_role?.replace('_', ' ') ?? '\u2014'}</TableCell>
                      <TableCell className="hidden tnum text-muted-foreground md:table-cell">{l.ip_address ?? '\u2014'}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(l.created_at)}</TableCell>
                      <TableCell className="tnum text-muted-foreground">{formatTime(l.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
      </Card>
    </div>
  );
}
