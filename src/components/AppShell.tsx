import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, ScanFace, FileBarChart, Settings, ShieldCheck, UserCog, LogOut, Menu, X, ListChecks } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePeopleSchema, clearPeopleSchemaCache } from '@/hooks/usePeopleSchema';
import type { UserRole } from '@/services/authService';
import { cn } from '@/utils/cn';

interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; roles?: UserRole[]; }

const M: UserRole[] = ['super_admin', 'org_admin', 'hr_officer'];

const ADMIN: UserRole[] = ['super_admin','org_admin'];
function buildNav(peopleLabel: string): NavItem[] {
  return [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/employees', label: peopleLabel, icon: Users, roles: M },
    { to: '/people-fields', label: 'People Fields', icon: ListChecks, roles: ADMIN },
    { to: '/departments', label: 'Departments', icon: Building2, roles: M },
    { to: '/face-enrollment', label: 'Face Enrollment', icon: ScanFace, roles: M },
    { to: '/reports', label: 'Reports', icon: FileBarChart, roles: [...M, 'supervisor'] },
    { to: '/access', label: 'Access & Team', icon: UserCog, roles: ADMIN },
    { to: '/audit-logs', label: 'Audit Log', icon: ShieldCheck, roles: M },
    { to: '/settings', label: 'Settings', icon: Settings, roles: ADMIN },
  ];
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { labels } = usePeopleSchema();
  const NAV = buildNav(labels.person_plural);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => { clearPeopleSchemaCache(); await logout(); navigate('/login'); };
  const visible = NAV.filter((i) => !i.roles || (user && i.roles.includes(user.role)));
  const initials = (user?.fullName?.charAt(0) || user?.email?.charAt(0) || '?').toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 items-center justify-center rounded-lg"><ScanFace className="size-4" /></span>
        <span className="text-display font-bold">FaceAttend</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {visible.map((item) => (
          <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground')}>
            <item.icon className="size-4" />{item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="bg-sidebar-accent text-sidebar-accent-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.fullName || user?.email}</p>
            <p className="truncate text-xs text-sidebar-foreground/60 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground">
          <LogOut className="size-4" />Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-60">{sidebar}</div>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-md p-2 hover:bg-accent">
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <span className="text-display font-bold">FaceAttend</span>
        </header>
        <main className="p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-display text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
