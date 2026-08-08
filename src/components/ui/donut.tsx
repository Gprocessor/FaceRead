export function Donut({ segments, size = 160, thickness = 18, center }: { segments: { label: string; value: number; color: string }[]; size?: number; thickness?: number; center?: React.ReactNode }) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const r = (size - thickness) / 2; const c = 2 * Math.PI * r; let offset = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        {segments.map((s, i) => { const frac = s.value / total; const len = frac * c; const dash = `${len} ${c - len}`; const el = <circle key={i} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="round" />; offset += len; return el; })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{center}</div>
    </div>
  );
}
