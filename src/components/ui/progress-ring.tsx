export function ProgressRing({ value, size = 84, thickness = 9, color = 'var(--chart-3)', label }: { value: number; size?: number; thickness?: number; color?: string; label?: string }) {
  const r = (size - thickness) / 2; const c = 2 * Math.PI * r; const p = Math.max(0, Math.min(1, value)); const dash = `${p * c} ${c}`;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90"><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} /><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeDasharray={dash} strokeLinecap="round" /></svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-display tnum text-lg font-bold">{Math.round(p*100)}%</span>{label && <span className="text-[10px] text-muted-foreground">{label}</span>}</div>
    </div>
  );
}
