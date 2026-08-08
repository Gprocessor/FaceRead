import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, ScanFace, FileBarChart, Settings, ShieldCheck, UserCog, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/services/authService';
import { cn } from '@/utils/cn';
interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; roles?: UserRole[]; }
const M: UserRole[] = ['super_admin','org_admin','hr_officer'];
const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'People', icon: Users, roles: M },
  { to: '/departments', label: 'Departments', icon: Building2, roles: M },
  { to: '/face-enrollment', label: 'Face Enrollment', icon: ScanFace, roles: M },
  { to: '/reports', label: 'Reports', icon: FileBarChart, roles: [...M, 'supervisor'] },
  { to: '/access', label: 'Access & Team', icon: UserCog, roles: ['super_admin','org_admin'] },
  { to: '/audit-logs', label: 'Audit Log', icon: ShieldCheck, roles: M },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin','org_admin'] },
];
export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate(); const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleLogout = async () => { await logout(); navigate('/login'); };
  const visible = NAV.filter((i) => !i.roles || (user && i.roles.includes(user.role)));
  const initials = (user?.fullName?.charAt(0) || user?.email?.charAt(0) || '?').toUpperCase();
  return (<div className="min-h-screen bg-background flex">
    <aside className={cn('fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transform transition-transform lg:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex items-center gap-2 px-5 py-5"><span className="bg-gradient-to-br from-sidebar-primary to-primary text-sidebar-primary-foreground flex size-9 items-center justify-center rounded-xl shadow"><ScanFace className="size-5" /></span><div className="min-w-0"><span className="text-display font-bold block leading-tight">FaceAttend</span>{user?.organizationName && <span className="text-[11px] opacity-70 truncate block">{user.organizationName}</span>}</div></div>
      <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto">{visible.map((item) => { const Icon = item.icon; const active = location.pathname === item.to; return (<NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={cn('flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors', active ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}><Icon className="size-4" />{item.label}</NavLink>); })}</nav>
      <div className="border-t border-sidebar-border p-4"><div className="flex items-center gap-2"><span className="flex size-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold">{initials}</span><div className="min-w-0"><p className="truncate text-xs">{user?.fullName || user?.email}</p><p className="text-[11px] opacity-70 capitalize">{user?.role?.replace('_',' ')}</p></div></div><button onClick={handleLogout} className="mt-3 w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"><LogOut className="size-4" /> Sign out</button></div>
    </aside>
    {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
    <div className="flex-1 flex flex-col min-w-0">
      <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-border bg-gradient-to-r from-background to-accent/20"><button className="lg:hidden text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button><p className="text-sm text-muted-foreground hidden sm:block">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p><span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-semibold">{initials}</span></header>
      <main className="flex-1 px-4 lg:px-6 py-6 overflow-y-auto"><Outlet /></main>
      <footer className="text-muted-foreground border-t border-border px-6 py-3 text-xs"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Biometric data is processed under your organization's consent records.</span></footer>
    </div>
  </div>);
}
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (<div className="flex flex-wrap items-start justify-between gap-4 mb-6"><div><h1 className="text-2xl font-bold text-display">{title}</h1>{description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}</div>{actions && <div className="flex items-center gap-2">{actions}</div>}</div>);
}
