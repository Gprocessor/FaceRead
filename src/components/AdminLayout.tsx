import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ScanFace, CalendarCheck, History, FileBarChart, Settings, ShieldCheck, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/services/authService';

interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; roles?: UserRole[]; }

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users, roles: ['super_admin', 'org_admin', 'hr_officer'] },
  { to: '/face-enrollment', label: 'Face Enrollment', icon: ScanFace, roles: ['super_admin', 'org_admin', 'hr_officer'] },
  { to: '/attendance', label: 'Check In / Out', icon: CalendarCheck },
  { to: '/attendance/history', label: 'My Attendance', icon: History },
  { to: '/reports', label: 'Reports', icon: FileBarChart, roles: ['super_admin', 'org_admin', 'hr_officer', 'supervisor'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: ShieldCheck, roles: ['super_admin', 'org_admin', 'hr_officer'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin', 'org_admin'] },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleLogout = async () => { await logout(); navigate('/login'); };
  const visible = NAV.filter((i) => !i.roles || (user && i.roles.includes(user.role)));

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-800">
          <ScanFace className="w-6 h-6 text-sky-400" /><span className="font-bold text-slate-100">FaceAttend</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-sky-500/10 text-sky-400' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}>
                <Icon className="w-4 h-4" />{item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.fullName || user?.email}</p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"><LogOut className="w-4 h-4" />Sign Out</button>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-slate-800 bg-slate-900/50">
          <button className="lg:hidden text-slate-400 hover:text-slate-100" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
          <p className="text-sm text-slate-400 hidden sm:block">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm font-semibold">{user?.fullName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}</div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto"><Outlet /></main>
      </div>
    </div>
  );
}
