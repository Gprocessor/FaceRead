export function MiniBars({ data }: { data: { label: string; onTime: number; late: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.onTime + d.late));
  return (
    <div className="flex items-end gap-2 h-56">
      {data.map((d, i) => {
        const total = d.onTime + d.late;
        const h = (total / max) * 100;
        const lateH = total ? (d.late / total) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 min-w-0">
            <div className="w-full flex-1 flex items-end">
              <div className="w-full rounded-t-md overflow-hidden bg-[var(--chart-1)]" style={{ height: `${h}%`, minHeight: total ? 4 : 0 }} title={`${d.onTime} on-time · ${d.late} late`}>
                <div className="w-full bg-[var(--chart-2)]" style={{ height: `${lateH}%` }} />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}
