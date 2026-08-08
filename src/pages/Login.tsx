import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ScanFace, Mail, Lock, Loader2, AlertCircle, User, Globe, ArrowLeft, Clock } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { myJoinStatus } from '@/services/joinService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export function Login() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login'|'signup'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState<string | null>(null);
  useEffect(() => { (async () => { try { const { data: { session } } = await supabase.auth.getSession(); if (!session) return; const s = await myJoinStatus(); if (s.state === 'member') { await refresh(); navigate('/dashboard'); } else if (s.state === 'pending') setPending('Your request to join is pending an administrator’s approval.'); else if (s.state === 'rejected') setPending('Your request was declined. Contact your administrator.'); } catch { /* */ } })(); /* eslint-disable-next-line */ }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setPending(null); setLoading(true);
    try {
      if (mode === 'login') { const { error: err } = await supabase.auth.signInWithPassword({ email, password }); if (err) throw err; const s = await myJoinStatus(); if (s.state === 'member') { await refresh(); navigate('/dashboard'); } else if (s.state === 'pending') setPending('Your request to join is pending an administrator’s approval.'); else if (s.state === 'rejected') setPending('Your request was declined. Contact your administrator.'); else setPending('Your account has no organization yet. Ask an admin to invite you, or request access with your company domain.'); }
      else { const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, requested_domain: domain.trim().toLowerCase() } } }); if (err) throw err; setMode('login'); setPending(data.session ? 'Request submitted. An administrator will review it shortly.' : 'Request submitted. Confirm your email, then sign in to check the status.'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed'); } finally { setLoading(false); }
  };
  return (<div className="grid-blueprint min-h-screen flex items-center justify-center px-4 py-12 bg-background"><div className="w-full max-w-md">
    <div className="mb-6 flex justify-center"><Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="size-4" /> Back to attendance</Link></div>
    <div className="mb-8 flex flex-col items-center gap-2 text-center"><span className="bg-gradient-to-br from-primary to-sidebar-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl shadow"><ScanFace className="size-6" /></span><h1 className="text-display text-2xl font-bold">FaceAttend Admin</h1><p className="text-sm text-muted-foreground">{mode === 'login' ? 'Sign in to your organization' : 'Request access with your company domain'}</p></div>
    <div className="surface-panel p-6">
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6"><button onClick={() => { setMode('login'); setPending(null); setError(null); }} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Sign In</button><button onClick={() => { setMode('signup'); setPending(null); setError(null); }} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Request Access</button></div>
      {pending && <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 rounded-lg p-3 mb-4"><Clock className="w-4 h-4 shrink-0 mt-0.5" />{pending}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (<><div className="space-y-1.5"><Label htmlFor="dom">Company domain</Label><div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="dom" className="pl-9" value={domain} onChange={(e) => setDomain(e.target.value)} required placeholder="company.com" /></div><p className="text-[11px] text-muted-foreground">We’ll route your request to the matching organization’s admins.</p></div><div className="space-y-1.5"><Label htmlFor="fn">Your full name</Label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="fn" className="pl-9" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Doe" /></div></div></>)}
        <div className="space-y-1.5"><Label htmlFor="em">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="em" type="email" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" /></div></div>
        <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="pw" type="password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" /></div></div>
        {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        <Button type="submit" disabled={loading} className="w-full">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? 'Sign In' : 'Submit Request'}</Button>
      </form>
    </div>
  </div></div>);
}
