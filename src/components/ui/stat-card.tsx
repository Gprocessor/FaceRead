import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

type Tone = 'primary' | 'success' | 'warning' | 'destructive';
const tones: Record<Tone, string> = {
  primary: 'bg-accent text-accent-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/15 text-destructive',
};
export function StatCard({ icon: Icon, label, value, tone = 'primary', sub }: { icon: LucideIcon; label: string; value: string | number; tone?: Tone; sub?: string }) {
  return (
    <div className="surface-panel flex items-center gap-4 p-5">
      <span className={cn('flex size-10 items-center justify-center rounded-lg', tones[tone])}><Icon className="size-5" /></span>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-display tnum text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
