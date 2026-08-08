import { supabase } from './supabaseClient';
export type UserRole = 'super_admin'|'org_admin'|'hr_officer'|'supervisor'|'employee';
export interface AppUser { id: string; email: string; role: UserRole; fullName: string | null; organizationId: string | null; organizationName: string | null; }
export async function signOut() { await supabase.auth.signOut(); }
export async function getCurrentUser(): Promise<AppUser | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role, full_name, organization_id, organizations(name)').eq('user_id', user.id).maybeSingle();
  const orgName = (profile as { organizations?: { name?: string } } | null)?.organizations?.name ?? null;
  return { id: user.id, email: user.email ?? '', role: (profile?.role as UserRole) ?? 'employee', fullName: profile?.full_name ?? null, organizationId: profile?.organization_id ?? null, organizationName: orgName };
}
