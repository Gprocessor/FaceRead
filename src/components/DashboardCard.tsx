import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardCardProps {
  title: string; value: string | number; subtitle?: string; icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral'; accent?: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';
}

const accentMap = {
  sky: 'from-sky-500/10 to-sky-500/5 text-sky-400 border-sky-500/20',
  emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
  amber: 'from-amber-500/10 to-amber-500/5 text-amber-400 border-amber-500/20',
  rose: 'from-rose-500/10 to-rose-500/5 text-rose-400 border-rose-500/20',
  slate: 'from-slate-500/10 to-slate-500/5 text-slate-400 border-slate-500/20',
};

export function DashboardCard({ title, value, subtitle, icon, trend, accent = 'slate' }: DashboardCardProps) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 ${accentMap[accent]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <div className="opacity-80">{icon}</div>}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : trend === 'down' ? <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> : null}
        </div>
      )}
    </div>
  );
}
