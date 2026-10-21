import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/utils/cn';

type Tone = 'primary' | 'success' | 'warning' | 'destructive';

const tones: Record<Tone, { chip: string }> = {
  primary: { chip: 'bg-accent text-accent-foreground' },
  success: { chip: 'bg-success/15 text-success' },
  warning: { chip: 'bg-warning/15 text-warning' },
  destructive: { chip: 'bg-destructive/15 text-destructive' },
};

export function StatCard({ icon: Icon, label, value, tone = 'primary', sub, delta }: { icon: LucideIcon; label: string; value: string | number; tone?: Tone; sub?: string; delta?: number }) {
  const t = tones[tone];
  return (
    <div className="surface-panel p-4 animate-rise">
      <div className="flex items-start justify-between">
        <span className={cn('inline-flex size-9 items-center justify-center rounded-lg', t.chip)}><Icon className="size-4" /></span>
        {delta !== undefined && (
          <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', delta >= 0 ? 'text-success' : 'text-destructive')}>
            {delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">{label}</p>
      <p className="text-display tnum text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
