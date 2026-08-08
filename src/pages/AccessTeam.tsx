import { useEffect, useState } from 'react';
import { Loader2, UserCheck, UserX, ShieldCheck, Mail } from 'lucide-react';
import { PageHeader } from '@/components/AppShell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listJoinRequests, approveJoin, rejectJoin, listMembers, setMemberRole, type JoinRequest, type Member } from '@/services/joinService';
const ROLES = ['employee','supervisor','hr_officer','org_admin'];
export function AccessTeam() {
  const [requests, setRequests] = useState<JoinRequest[]>([]); const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true); const [roleFor, setRoleFor] = useState<Record<string,string>>({}); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const load = async () => { setLoading(true); setError(null); try { const [r, m] = await Promise.all([listJoinRequests(), listMembers()]); setRequests(r); setMembers(m); } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const doApprove = async (id: string) => { setBusy(id); try { await approveJoin(id, roleFor[id] || 'employee'); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(null); } };
  const doReject = async (id: string) => { setBusy(id); try { await rejectJoin(id); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(null); } };
  const changeRole = async (m: Member, role: string) => { setBusy(m.id); try { await setMemberRole(m.id, role); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(null); } };
  return (<div>
    <PageHeader title="Access & Team" description="Approve people who requested to join, and manage roles (including other admins)." />
    {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-4">{error}</div>}
    {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div> : (<div className="space-y-6">
      <Card><CardHeader><CardTitle>Pending join requests ({requests.length})</CardTitle></CardHeader><CardContent>{requests.length === 0 ? <p className="text-sm text-muted-foreground">No pending requests.</p> : (
        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Domain</TableHead><TableHead>Role</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{requests.map((r) => (<TableRow key={r.id}>
          <TableCell className="font-medium">{r.full_name || '—'}</TableCell><TableCell className="text-muted-foreground"><span className="inline-flex items-center gap-1"><Mail className="size-3" />{r.email}</span></TableCell><TableCell className="text-muted-foreground">{r.requested_domain || (r.requested_new_org_name ? `new: ${r.requested_new_org_name}` : '—')}</TableCell>
          <TableCell><select value={roleFor[r.id] || 'employee'} onChange={(e) => setRoleFor({ ...roleFor, [r.id]: e.target.value })} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">{ROLES.map((x) => <option key={x} value={x}>{x.replace('_',' ')}</option>)}</select></TableCell>
          <TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" disabled={busy === r.id} onClick={() => doApprove(r.id)}><UserCheck className="size-4" />Approve</Button><Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => doReject(r.id)}><UserX className="size-4" />Reject</Button></div></TableCell>
        </TableRow>))}</TableBody></Table>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Team members ({members.length})</CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Change role</TableHead></TableRow></TableHeader><TableBody>{members.map((m) => (<TableRow key={m.id}><TableCell className="font-medium">{m.full_name || '—'}</TableCell><TableCell className="text-muted-foreground">{m.email}</TableCell><TableCell><Badge variant={m.role.includes('admin') ? 'default' : 'secondary'}>{m.role.replace('_',' ')}</Badge></TableCell><TableCell><select value={m.role} disabled={busy === m.id} onChange={(e) => changeRole(m, e.target.value)} className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">{ROLES.map((x) => <option key={x} value={x}>{x.replace('_',' ')}</option>)}</select></TableCell></TableRow>))}</TableBody></Table>
        <p className="text-xs text-muted-foreground mt-3 inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> Set a member's role to <strong>org admin</strong> to add another administrator.</p>
      </CardContent></Card>
    </div>)}
  </div>);
}
