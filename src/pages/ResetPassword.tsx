import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ScanFace, Lock, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MIN_LENGTH = 6;

export function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const linkError = params.get('error');
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(!!data.session);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHasSession(!!session);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) { setError(`Password must be at least ${MIN_LENGTH} characters.`); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login', { replace: true, state: { notice: 'Password updated. Sign in with your new password.' } }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid-blueprint min-h-screen flex items-center justify-center px-4 py-12 bg-background"><div className="w-full max-w-md">
      <div className="mb-6 flex justify-center"><Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="size-4" /> Back to sign in</Link></div>
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <span className="bg-gradient-to-br from-primary to-sidebar-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl shadow"><ScanFace className="size-6" /></span>
        <h1 className="text-display text-2xl font-bold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password for your FaceAttend account</p>
      </div>
      <div className="surface-panel p-6">
        {checking ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center"><CheckCircle2 className="size-12 text-success" /><p className="font-medium">Password updated</p><p className="text-sm text-muted-foreground">Taking you to sign in…</p></div>
        ) : linkError || !hasSession ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{linkError || 'This reset link is invalid or has expired.'}</div>
            <Button className="w-full" onClick={() => navigate('/login', { state: { mode: 'forgot' } })}>Request a new reset link</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="np">New password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="np" type="password" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={MIN_LENGTH} placeholder="••••••••" autoComplete="new-password" /></div></div>
            <div className="space-y-1.5"><Label htmlFor="cp">Confirm new password</Label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="cp" type="password" className="pl-9" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={MIN_LENGTH} placeholder="••••••••" autoComplete="new-password" /></div></div>
            {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
            <Button type="submit" disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update password'}</Button>
          </form>
        )}
      </div>
    </div></div>
  );
}
