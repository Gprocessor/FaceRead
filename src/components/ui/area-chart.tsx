/** Stacked on-time/late area chart with axis + hover tooltips (no deps). */
import { useState } from 'react';
export function AreaChart({ data, height = 220 }: { data: { label: string; onTime: number; late: number }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640, h = height, pad = 24;
  const max = Math.max(1, ...data.map((d) => d.onTime + d.late));
  const x = (i: number) => pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = (key: 'onTime' | 'total') => data.map((d, i) => `${x(i).toFixed(1)},${y(key === 'total' ? d.onTime + d.late : d.onTime).toFixed(1)}`).join(' ');
  const areaTop = `${pad},${h - pad} ${line('total')} ${w - pad},${h - pad}`;
  const areaBottom = `${pad},${h - pad} ${line('onTime')} ${w - pad},${h - pad}`;
  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" onMouseLeave={() => setHover(null)}>
        {[0.25,0.5,0.75,1].map((g) => (<line key={g} x1={pad} x2={w-pad} y1={y(max*g)} y2={y(max*g)} stroke="var(--border)" strokeDasharray="3 4" />))}
        <polygon points={areaTop} fill="var(--chart-2)" opacity="0.18" />
        <polygon points={areaBottom} fill="var(--chart-1)" opacity="0.28" />
        <polyline points={line('total')} fill="none" stroke="var(--chart-2)" strokeWidth="2" />
        <polyline points={line('onTime')} fill="none" stroke="var(--chart-1)" strokeWidth="2.5" />
        {data.map((d, i) => (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={x(i) - (w-pad*2)/data.length/2} y={pad} width={(w-pad*2)/data.length} height={h-pad*2} fill="transparent" />
            <circle cx={x(i)} cy={y(d.onTime + d.late)} r={hover === i ? 4 : 0} fill="var(--chart-2)" />
            <text x={x(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>{d.label}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute -translate-x-1/2 rounded-lg glass px-3 py-2 text-xs shadow" style={{ left: `${(x(hover)/w)*100}%`, top: 6 }}>
          <div className="font-semibold">{data[hover].label}</div>
          <div className="text-muted-foreground">On-time <span className="tnum text-foreground">{data[hover].onTime}</span></div>
          <div className="text-muted-foreground">Late <span className="tnum text-foreground">{data[hover].late}</span></div>
        </div>
      )}
    </div>
  );
}
