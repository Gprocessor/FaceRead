import { useState } from 'react';

/** Stacked on-time/late area chart with axis + hover tooltips (no deps). */
export function AreaChart({ data, height = 220 }: { data: { label: string; onTime: number; late: number }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640, h = height, pad = 24;
  const max = Math.max(1, ...data.map((d) => d.onTime + d.late));
  const x = (i: number) => pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = (key: 'onTime' | 'total') =>
    data.map((d, i) => `${x(i).toFixed(1)},${y(key === 'total' ? d.onTime + d.late : d.onTime).toFixed(1)}`).join(' ');
  const areaTop = `${pad},${h - pad} ${line('total')} ${w - pad},${h - pad}`;
  const areaBottom = `${pad},${h - pad} ${line('onTime')} ${w - pad},${h - pad}`;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" onMouseLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={pad} x2={w - pad} y1={h - pad - g * (h - pad * 2)} y2={h - pad - g * (h - pad * 2)} stroke="var(--border)" strokeDasharray="3 4" />
        ))}
        <polygon points={areaTop} fill="var(--chart-2)" opacity="0.22" />
        <polygon points={areaBottom} fill="var(--chart-3)" opacity="0.28" />
        <polyline points={line('total')} fill="none" stroke="var(--chart-2)" strokeWidth="2" />
        <polyline points={line('onTime')} fill="none" stroke="var(--chart-3)" strokeWidth="2" />
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - 10} y={pad} width="20" height={h - pad * 2} fill="transparent" />
            <circle cx={x(i)} cy={y(d.onTime + d.late)} r={hover === i ? 4 : 2.5} fill="var(--chart-2)" />
            <text x={x(i)} y={h - 6} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">{d.label}</text>
          </g>
        ))}
      </svg>
      {hover !== null && data[hover] && (
        <div className="pointer-events-none absolute top-2 right-2 surface-panel px-3 py-2 text-xs">
          <p className="font-semibold mb-1">{data[hover].label}</p>
          <p className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: 'var(--chart-3)' }} />On-time <span className="tnum ml-auto">{data[hover].onTime}</span></p>
          <p className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: 'var(--chart-2)' }} />Late <span className="tnum ml-auto">{data[hover].late}</span></p>
        </div>
      )}
    </div>
  );
}
