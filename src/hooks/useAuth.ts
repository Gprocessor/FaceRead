import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/services/supabaseClient';
import { getCurrentUser, signOut, type AppUser } from '@/services/authService';
export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const loadUser = useCallback(async () => { setUser(await getCurrentUser()); setLoading(false); }, []);
  useEffect(() => { loadUser(); const { data: sub } = supabase.auth.onAuthStateChange(() => { (async () => { await loadUser(); })(); }); return () => sub.subscription.unsubscribe(); }, [loadUser]);
  const logout = useCallback(async () => { await signOut(); setUser(null); }, []);
  return { user, loading, logout, refresh: loadUser };
}
