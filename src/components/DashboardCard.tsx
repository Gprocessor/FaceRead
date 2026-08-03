import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';
}

const accentMap = {
  sky: 'from-sky-500/10 to-sky-500/5 text-sky-400 border-sky-500/20',
  emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
  amber: 'from-amber-500/10 to-amber-500/5 text-amber-400 border-amber-500/20',
  rose: 'from-rose-500/10 to-rose-500/5 text-rose-400 border-rose-500/20',
  slate: 'from-slate-500/10 to-slate-500/5 text-slate-400 border-slate-500/20',
};

export function DashboardCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent = 'slate',
}: DashboardCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 ${accentMap[accent]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-100">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        {icon && <div className="opacity-80">{icon}</div>}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5 text-sm">
          {trend === 'up' ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : trend === 'down' ? (
            <TrendingDown className="w-4 h-4 text-rose-400" />
          ) : null}
        </div>
      )}
    </div>
  );
}
