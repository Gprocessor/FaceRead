import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ScanFace, Mail, Lock, Loader2, AlertCircle, User, Building2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export function Login() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login'|'signup'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [info, setInfo] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setInfo(null); setLoading(true);
    try {
      if (mode === 'login') { const { error: err } = await supabase.auth.signInWithPassword({ email, password }); if (err) throw err; }
      else { const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, organization_name: orgName } } }); if (err) throw err; if (!data.session) { setInfo('Organization created. Check your email to confirm, then sign in.'); setMode('login'); setLoading(false); return; } }
      await refresh(); navigate('/dashboard');
    } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed'); } finally { setLoading(false); }
  };
  return (<div className="grid-blueprint min-h-screen flex items-center justify-center px-4 py-12 bg-background"><div className="w-full max-w-md">
    <div className="mb-6 flex justify-center"><Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="size-4" /> Back to attendance</Link></div>
    <div className="mb-8 flex flex-col items-center gap-2 text-center"><span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl"><ScanFace className="size-6" /></span><h1 className="text-display text-2xl font-bold">FaceAttend Admin</h1><p className="text-sm text-muted-foreground">{mode === 'login' ? 'Sign in to manage your organization' : 'Register a new organization'}</p></div>
    <div className="surface-panel p-6">
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6"><button onClick={() => setMode('login')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Sign In</button><button onClick={() => setMode('signup')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Register Organization</button></div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (<><div className="space-y-1.5"><Label htmlFor="org">Organization name</Label><div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="org" className="pl-9" value={orgName} onChange={(e) => setOrgName(e.target.value)} required placeholder="Acme Manufacturing" /></div></div><div className="space-y-1.5"><Label htmlFor="fn">Your full name</Label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="fn" className="pl-9" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Doe" /></div></div></>)}
        <div className="space-y-1.5"><Label htmlFor="em">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="em" type="email" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" /></div></div>
        <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="pw" type="password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" /></div></div>
        {info && <div className="text-sm text-success bg-success/10 rounded-lg p-3">{info}</div>}
        {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        <Button type="submit" disabled={loading} className="w-full">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? 'Sign In' : 'Create Organization'}</Button>
      </form>
      <p className="text-[11px] text-muted-foreground text-center mt-4">{mode === 'signup' ? 'Registering creates a new organization with you as its administrator.' : 'Employees mark attendance at the kiosk — no login needed there.'}</p>
    </div>
  </div></div>);
}
