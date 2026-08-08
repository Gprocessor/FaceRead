import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/utils/cn';
type Tone = 'primary'|'success'|'warning'|'destructive';
const tones: Record<Tone,{ chip: string; ring: string }> = {
  primary: { chip: 'bg-accent text-accent-foreground', ring: 'from-primary/15' },
  success: { chip: 'bg-success/15 text-success', ring: 'from-success/15' },
  warning: { chip: 'bg-warning/15 text-warning', ring: 'from-warning/15' },
  destructive: { chip: 'bg-destructive/15 text-destructive', ring: 'from-destructive/15' },
};
export function StatCard({ icon: Icon, label, value, tone='primary', sub, delta }: { icon: LucideIcon; label: string; value: string|number; tone?: Tone; sub?: string; delta?: number }) {
  const t = tones[tone];
  return (
    <div className={cn('surface-panel relative overflow-hidden p-5 animate-rise')}>
      <div className={cn('pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-gradient-to-br to-transparent blur-2xl', t.ring)} />
      <div className="flex items-start justify-between">
        <span className={cn('flex size-10 items-center justify-center rounded-xl', t.chip)}><Icon className="size-5" /></span>
        {delta !== undefined && (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', delta >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
            {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mt-4">{label}</p>
      <p className="text-display tnum text-3xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
