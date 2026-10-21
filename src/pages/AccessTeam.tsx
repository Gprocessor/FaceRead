import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/AppShell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listJoinRequests, approveJoin, rejectJoin, listMembers, setMemberRole, type JoinRequest, type Member } from '@/services/joinService';

const ROLES = ['employee', 'supervisor', 'hr_officer', 'org_admin'];

export function AccessTeam() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFor, setRoleFor] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [r, m] = await Promise.all([listJoinRequests(), listMembers()]);
      setRequests(r); setMembers(m);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const doApprove = async (id: string) => {
    setBusy(id);
    try { await approveJoin(id, roleFor[id] || 'employee'); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(null); }
  };

  const doReject = async (id: string) => {
    setBusy(id);
    try { await rejectJoin(id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(null); }
  };

  const changeRole = async (m: Member, role: string) => {
    setBusy(m.id);
    try { await setMemberRole(m.id, role); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <PageHeader title="Access & Team" description="Approve join requests and manage member roles" />
      {error && <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Pending join requests ({requests.length})</CardTitle></CardHeader>
            <CardContent>
              {requests.length === 0 ? <p className="text-sm text-muted-foreground">No pending requests.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead className="hidden md:table-cell">Domain</TableHead><TableHead>Role</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.full_name || '\u2014'}</TableCell>
                        <TableCell className="text-muted-foreground">{r.email}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{r.requested_domain || (r.requested_new_org_name ? `new: ${r.requested_new_org_name}` : '\u2014')}</TableCell>
                        <TableCell>
                          <select value={roleFor[r.id] || 'employee'} onChange={(e) => setRoleFor({ ...roleFor, [r.id]: e.target.value })} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                            {ROLES.map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}
                          </select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" disabled={busy === r.id} onClick={() => doApprove(r.id)}>Approve</Button>
                            <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => doReject(r.id)}>Reject</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Team members ({members.length})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Change role</TableHead></TableRow></TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.full_name || '\u2014'}</TableCell>
                      <TableCell className="text-muted-foreground">{m.email}</TableCell>
                      <TableCell><Badge variant="secondary">{m.role.replace('_', ' ')}</Badge></TableCell>
                      <TableCell>
                        <select value={m.role} disabled={busy === m.id} onChange={(e) => changeRole(m, e.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
                          {ROLES.map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">Set a member&rsquo;s role to org admin to add another administrator.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
