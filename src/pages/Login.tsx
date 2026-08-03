import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanFace, Mail, Lock, Loader2, AlertCircle, User } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export function Login() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (err) throw err;
      }
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500/10 mb-4">
            <ScanFace className="w-8 h-8 text-sky-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">FaceAttend</h1>
          <p className="text-sm text-slate-400 mt-1">
            Face Recognition Attendance System
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex gap-1 p-1 bg-slate-800/60 rounded-lg mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'login'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'signup'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-rose-400 bg-rose-500/10 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-sky-500 text-slate-950 font-medium text-sm hover:bg-sky-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-[11px] text-slate-600 text-center mt-4">
            By signing in you agree to biometric data processing with consent.
          </p>
        </div>
      </div>
    </div>
  );
}
