import * as React from 'react';
import { cn } from '@/utils/cn';

type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
const variants: Record<Variant, string> = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  destructive: 'border-transparent bg-destructive text-destructive-foreground',
  success: 'border-transparent bg-success text-success-foreground',
  warning: 'border-transparent bg-warning text-warning-foreground',
  outline: 'text-foreground',
};
export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return <div className={cn('inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold', variants[variant], className)} {...props} />;
}
