import { useEffect, useState } from 'react';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
interface Dept { id: string; name: string; created_at: string; }
export function Departments() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Dept[]>([]); const [loading, setLoading] = useState(true); const [name, setName] = useState(''); const [error, setError] = useState<string | null>(null);
  const load = async () => { setLoading(true); const { data } = await supabase.from('departments').select('id, name, created_at').order('name'); setDepartments(data ?? []); setLoading(false); };
  useEffect(() => { load(); }, []);
  const add = async (e: React.FormEvent) => { e.preventDefault(); setError(null); if (!user?.organizationId) { setError('Your account has no organization assigned yet.'); return; } const { error: err } = await supabase.from('departments').insert({ organization_id: user.organizationId, name: name.trim() }); if (err) { setError(err.message); return; } setName(''); await load(); };
  return (<div><PageHeader title="Departments" description="Organise staff into departments" /><Card className="p-5 mb-6"><form onSubmit={add} className="flex flex-wrap items-end gap-3"><div className="flex-1 min-w-[220px]"><label className="text-sm font-medium text-muted-foreground">New department</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Assembly line B" maxLength={80} required className="mt-1.5" /></div><Button type="submit"><Plus className="w-4 h-4" />Add</Button></form>{error && <p className="text-sm text-destructive mt-3">{error}</p>}</Card>{loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div> : departments.length === 0 ? <Card className="p-10 text-center text-muted-foreground"><Building2 className="w-10 h-10 mx-auto mb-3" />No departments yet.</Card> : (<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{departments.map((d) => (<Card key={d.id}><CardHeader><CardTitle>{d.name}</CardTitle><CardDescription>Created {new Date(d.created_at).toLocaleDateString()}</CardDescription></CardHeader><CardContent><span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="size-3.5" />Department</span></CardContent></Card>))}</div>)}</div>);
}
