import { supabase } from './supabaseClient';

export type UserRole = 'super_admin' | 'org_admin' | 'hr_officer' | 'supervisor' | 'employee';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string | null;
  organizationId: string | null;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  if (error) throw error;
  return data;
}

export async function signOut() { await supabase.auth.signOut(); }

export async function getCurrentUser(): Promise<AppUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, organization_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? '',
    role: (profile?.role as UserRole) ?? 'employee',
    fullName: profile?.full_name ?? null,
    organizationId: profile?.organization_id ?? null,
  };
}
