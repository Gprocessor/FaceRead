import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ScanFace, Mail, Lock, Loader2, AlertCircle, User, Globe, Building2, ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { myJoinStatus } from '@/services/joinService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'login' | 'register' | 'join' | 'forgot';

export function Login() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state ?? {}) as { notice?: string; mode?: Mode };
  const [mode, setMode] = useState<Mode>(navState.mode ?? 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(navState.notice ?? null);

  useEffect(() => { (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const s = await myJoinStatus();
      if (s.state === 'member') { await refresh(); navigate('/dashboard'); }
      else if (s.state === 'pending') setPending('Your request to join is pending an administrator’s approval.');
      else if (s.state === 'rejected') setPending('Your request was declined. Contact your administrator.');
    } catch { /* */ }
  })(); /* eslint-disable-next-line */ }, []);

  const switchMode = (m: Mode) => { setMode(m); setError(null); setPending(null); setNotice(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setPending(null); setNotice(null); setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password }); if (err) throw err;
        const s = await myJoinStatus();
        if (s.state === 'member') { await refresh(); navigate('/dashboard'); }
        else if (s.state === 'pending') setPending('Your request to join is pending an administrator’s approval.');
        else if (s.state === 'rejected') setPending('Your request was declined. Contact your administrator.');
        else setPending('Your account has no organization yet. Register a new one or request to join.');
      } else if (mode === 'register') {
        const { data, error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, new_org_name: orgName, requested_domain: domain.trim().toLowerCase() } },
        });
        if (err) throw err;
        if (data.session) { await refresh(); navigate('/dashboard'); }
        else { setMode('login'); setPending('Organization created. Confirm your email, then sign in.'); }
      } else if (mode === 'join') {
        const { data, error: err } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, requested_domain: domain.trim().toLowerCase() } },
        });
        if (err) throw err;
        setMode('login');
        setPending(data.session ? 'Request submitted. An administrator will review it shortly.' : 'Request submitted. Confirm your email, then sign in to check the status.');
      } else {
        const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (err) throw err;
        setMode('login');
        setNotice('If an account exists for that email, a password reset link has been sent. Check your inbox.');
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed'); }
    finally { setLoading(false); }
  };

  const tab = (m: Mode, label: string) => (
    <button onClick={() => switchMode(m)}
      className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors ${mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>{label}</button>
  );

  const subtitle = mode === 'login' ? 'Sign in to your organization'
    : mode === 'register' ? 'Create a new organization — you become its admin'
    : mode === 'join' ? 'Request to join an existing organization'
    : 'Enter your email and we’ll send you a reset link';

  const submitLabel = mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Organization' : mode === 'join' ? 'Submit Request' : 'Send reset link';

  return (
    <div className="grid-blueprint min-h-screen flex items-center justify-center px-4 py-12 bg-background"><div className="w-full max-w-md">
      <div className="mb-6 flex justify-center"><Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="size-4" /> Back to attendance</Link></div>
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <span className="bg-gradient-to-br from-primary to-sidebar-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl shadow"><ScanFace className="size-6" /></span>
        <h1 className="text-display text-2xl font-bold">{mode === 'forgot' ? 'Reset password' : 'FaceAttend'}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="surface-panel p-6">
        {mode !== 'forgot' && <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6">{tab('login', 'Sign In')}{tab('register', 'Register Org')}{tab('join', 'Join Org')}</div>}
        {notice && <div className="flex items-start gap-2 text-sm text-success bg-success/10 rounded-lg p-3 mb-4"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />{notice}</div>}
        {pending && <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 rounded-lg p-3 mb-4"><Clock className="w-4 h-4 shrink-0 mt-0.5" />{pending}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (<>
            <div className="space-y-1.5"><Label htmlFor="org">Organization name</Label><div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="org" className="pl-9" value={orgName} onChange={(e) => setOrgName(e.target.value)} required placeholder="Acme Manufacturing" /></div></div>
            <div className="space-y-1.5"><Label htmlFor="dom2">Company domain (optional)</Label><div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="dom2" className="pl-9" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company.com — lets others request to join" /></div></div>
          </>)}
          {mode === 'join' && (
            <div className="space-y-1.5"><Label htmlFor="dom">Company domain</Label><div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="dom" className="pl-9" value={domain} onChange={(e) => setDomain(e.target.value)} required placeholder="company.com" /></div><p className="text-[11px] text-muted-foreground">We’ll route your request to that organization’s admins.</p></div>
          )}
          {(mode === 'register' || mode === 'join') && (
            <div className="space-y-1.5"><Label htmlFor="fn">Your full name</Label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="fn" className="pl-9" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Doe" /></div></div>
          )}
          <div className="space-y-1.5"><Label htmlFor="em">Email</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="em" type="email" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" autoComplete="email" /></div></div>
          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pw">Password</Label>
                {mode === 'login' && <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-medium text-primary hover:underline">Forgot password?</button>}
              </div>
              <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="pw" type="password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
            </div>
          )}
          {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : submitLabel}</Button>
          {mode === 'forgot' && <button type="button" onClick={() => switchMode('login')} className="w-full text-sm text-muted-foreground hover:text-foreground">Back to sign in</button>}
        </form>
      </div>
    </div></div>
  );
}
