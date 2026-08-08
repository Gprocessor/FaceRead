import { useEffect, useState } from 'react';
import { Users, Plus, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { getAdminEmployees, createAdminEmployee } from '@/services/attendanceService';
import { PageHeader } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
interface Row { id: string; employee_code: string; full_name: string; email: string | null; department: string | null; status: string; face_enrolled: boolean; }
interface Dept { id: string; name: string; }
export function Employees() {
  const [employees, setEmployees] = useState<Row[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ employee_code: '', full_name: '', email: '', phone: '', position: '', department_id: '', hire_date: '' });
  const [submitting, setSubmitting] = useState(false);
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [emps, depts] = await Promise.all([getAdminEmployees(), supabase.from('departments').select('id, name').order('name')]);
      setEmployees(emps); setDepartments(depts.data ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load people'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError(null);
    try {
      await createAdminEmployee({ employee_code: form.employee_code, full_name: form.full_name, email: form.email, phone: form.phone || undefined, position: form.position || undefined, department_id: form.department_id || undefined, hire_date: form.hire_date || undefined });
      setForm({ employee_code: '', full_name: '', email: '', phone: '', position: '', department_id: '', hire_date: '' });
      setShowAdd(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to add person'); } finally { setSubmitting(false); }
  };
  const filtered = employees.filter((e) => e.full_name.toLowerCase().includes(search.toLowerCase()) || e.employee_code.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <PageHeader title="People" description="Employees and students in this organization" actions={<Button onClick={() => setShowAdd(!showAdd)}><Plus className="w-4 h-4" />Add person</Button>} />
      {showAdd && (
        <Card className="p-5 mb-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Employee Code *</Label><Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Position</Label><Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Department</Label>
                <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">— Select —</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label>Hire Date</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button>
              <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}
      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-4">{error}</div>}
      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code…" />
      </div>
      <Card className="overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          : filtered.length === 0 ? <div className="flex flex-col items-center py-12 text-muted-foreground"><Users className="w-10 h-10 mb-3" /><p className="text-sm">No people found</p></div>
          : (
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Dept</TableHead><TableHead>Face</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="tnum text-xs text-muted-foreground">{e.employee_code}</TableCell>
                  <TableCell className="font-medium">{e.full_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{e.department ?? '—'}</TableCell>
                  <TableCell><Badge variant={e.face_enrolled ? 'success' : 'outline'}>{e.face_enrolled ? 'Enrolled' : 'Not enrolled'}</Badge></TableCell>
                  <TableCell><Badge variant={e.status === 'active' ? 'secondary' : 'outline'}>{e.status}</Badge></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
      </Card>
    </div>
  );
}
