import { useEffect, useState } from 'react';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface Dept { id: string; name: string; created_at: string; }

export function Departments() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('departments').select('id, name, created_at').order('name');
    setDepartments(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!user?.organizationId) { setError('Your account has no organization assigned yet.'); return; }
    const { error: err } = await supabase.from('departments').insert({ organization_id: user.organizationId, name: name.trim() });
    if (err) { setError(err.message); return; }
    setName('');
    await load();
  };

  return (
    <div>
      <PageHeader title="Departments" description="Group people by department for clearer reporting" />

      <Card className="mb-6 p-5">
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="dn">New department</Label>
            <Input id="dn" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Assembly line B" maxLength={80} required />
          </div>
          <Button type="submit"><Plus className="size-4" />Add</Button>
        </form>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </Card>

      {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
        : departments.length === 0 ? <Card className="p-12 text-center text-muted-foreground"><Building2 className="mx-auto mb-3 size-10" />No departments yet.</Card>
          : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((d) => (
                <Card key={d.id}>
                  <CardHeader>
                    <CardTitle>{d.name}</CardTitle>
                    <CardDescription>Created {new Date(d.created_at).toLocaleDateString()}</CardDescription>
                  </CardHeader>
                  <CardContent><Badge variant="secondary">Department</Badge></CardContent>
                </Card>
              ))}
            </div>
          )}
    </div>
  );
}
