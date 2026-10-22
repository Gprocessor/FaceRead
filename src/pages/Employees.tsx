import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Search, Loader2, Pencil, X, Settings2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { getAdminEmployees, createAdminEmployee, updateAdminEmployee, type AdminEmployee } from '@/services/attendanceService';
import { formatFieldValue } from '@/services/peopleService';
import { usePeopleSchema } from '@/hooks/usePeopleSchema';
import { useAuth } from '@/hooks/useAuth';
import { DynamicField } from '@/components/DynamicField';
import { PageHeader } from '@/components/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Dept { id: string; name: string; }
interface FormState { employee_code: string; full_name: string; department_id: string; status: string; metadata: Record<string, unknown>; }

const emptyForm = (): FormState => ({ employee_code: '', full_name: '', department_id: '', status: 'active', metadata: {} });
const control = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function Employees() {
  const { user } = useAuth();
  const { labels, fields, loading: schemaLoading } = usePeopleSchema();
  const [people, setPeople] = useState<AdminEmployee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const canManageFields = user?.role === 'org_admin' || user?.role === 'super_admin';
  const listFields = fields.filter((f) => f.show_in_list);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [emps, depts] = await Promise.all([getAdminEmployees(), supabase.from('departments').select('id, name').order('name')]);
      setPeople(emps); setDepartments(depts.data ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load records'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditingId(null); setForm(emptyForm()); setFormError(null); setFormOpen(true); };
  const openEdit = (p: AdminEmployee) => {
    setEditingId(p.id);
    setForm({ employee_code: p.employee_code, full_name: p.full_name, department_id: p.department_id ?? '', status: p.status, metadata: { ...(p.metadata || {}) } });
    setFormError(null); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); setFormError(null); };
  const setMeta = (key: string, v: unknown) => setForm((f) => ({ ...f, metadata: { ...f.metadata, [key]: v } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError(null);
    const metadata: Record<string, unknown> = {};
    for (const f of fields) {
      const v = form.metadata[f.key];
      metadata[f.key] = f.type === 'checkbox' ? v === true : (v === undefined ? '' : v);
    }
    const payload = { employee_code: form.employee_code.trim(), full_name: form.full_name.trim(), department_id: form.department_id || null, metadata };
    try {
      if (editingId) await updateAdminEmployee(editingId, { ...payload, status: form.status });
      else await createAdminEmployee(payload);
      closeForm();
      await load();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Could not save'); }
    finally { setSubmitting(false); }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (deptFilter !== 'all' && (p.department_id ?? 'none') !== deptFilter) return false;
      if (!q) return true;
      if (p.full_name.toLowerCase().includes(q) || p.employee_code.toLowerCase().includes(q)) return true;
      return Object.values(p.metadata || {}).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
    });
  }, [people, search, deptFilter, statusFilter]);

  return (
    <div>
      <PageHeader title={labels.person_plural} description="Everyone in your organisation who can mark attendance"
        actions={<>
          {canManageFields && <Link to="/people-fields"><Button variant="outline"><Settings2 className="w-4 h-4" />Fields</Button></Link>}
          <Button onClick={openAdd}><Plus className="w-4 h-4" />Add {labels.person_singular.toLowerCase()}</Button>
        </>} />

      {formOpen && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-display font-semibold">{editingId ? `Edit ${labels.person_singular.toLowerCase()}` : `New ${labels.person_singular.toLowerCase()}`}</h3>
            <Button variant="ghost" size="icon" onClick={closeForm}><X className="w-4 h-4" /></Button>
          </div>
          {schemaLoading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div> : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label htmlFor="fn">Full name<span className="text-destructive"> *</span></Label><Input id="fn" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required minLength={2} maxLength={120} /></div>
                <div className="space-y-1.5"><Label htmlFor="code">{labels.id_label}<span className="text-destructive"> *</span></Label><Input id="code" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} required maxLength={40} placeholder="Letters, numbers, / - _ ." /></div>
                <div className="space-y-1.5"><Label htmlFor="dept">Department</Label>
                  <select id="dept" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className={control}>
                    <option value="">&mdash; None &mdash;</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                {editingId && (
                  <div className="space-y-1.5"><Label htmlFor="st">Status</Label>
                    <select id="st" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={control}>
                      <option value="active">Active</option><option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}
                {fields.map((f) => <DynamicField key={f.key} field={f} value={form.metadata[f.key]} onChange={(v) => setMeta(f.key, v)} />)}
              </div>
              {formError && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{formError}</div>}
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 animate-spin" />}{editingId ? 'Save changes' : 'Save'}</Button>
                <Button type="button" variant="secondary" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {error && <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 mb-4">{error}</div>}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search name, ${labels.id_label} or any field\u2026`} /></div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">All departments</option><option value="none">No department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option>
        </select>
        <span className="self-center text-xs text-muted-foreground">{filtered.length} of {people.length}</span>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          : filtered.length === 0 ? <div className="flex flex-col items-center py-12 text-muted-foreground"><Users className="w-10 h-10 mb-3" /><p className="text-sm">No {labels.person_plural.toLowerCase()} found</p></div>
            : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{labels.id_label}</TableHead><TableHead>Name</TableHead><TableHead className="hidden md:table-cell">Department</TableHead>
                  {listFields.map((f) => <TableHead key={f.key} className="hidden lg:table-cell">{f.label}</TableHead>)}
                  <TableHead>Face</TableHead><TableHead>Status</TableHead><TableHead className="w-10" />
                </TableRow></TableHeader>
                <TableBody>{filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tnum text-xs text-muted-foreground">{p.employee_code}</TableCell>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{p.department ?? '\u2014'}</TableCell>
                    {listFields.map((f) => <TableCell key={f.key} className="hidden lg:table-cell text-muted-foreground">{formatFieldValue(f, p.metadata?.[f.key]) || '\u2014'}</TableCell>)}
                    <TableCell><Badge variant={p.face_enrolled ? 'success' : 'outline'}>{p.face_enrolled ? 'Enrolled' : 'Not enrolled'}</Badge></TableCell>
                    <TableCell><Badge variant={p.status === 'active' ? 'secondary' : 'outline'}>{p.status}</Badge></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Edit"><Pencil className="w-4 h-4" /></Button></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
      </Card>
    </div>
  );
}
