export function Sparkline({ data, className = '', stroke = 'var(--chart-1)' }: { data: number[]; className?: string; stroke?: string }) {
  const w = 120, h = 36, max = Math.max(1, ...data), min = Math.min(0, ...data);
  const pts = data.map((v, i) => { const x = (i / Math.max(1, data.length - 1)) * w; const y = h - ((v - min) / Math.max(1, max - min)) * h; return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (<svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none"><polygon points={area} fill={stroke} opacity="0.12" /><polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
