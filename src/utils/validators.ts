export function formatDate(d: string | Date): string { const x = typeof d === 'string' ? new Date(d) : d; return x.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
export function formatTime(d: string | Date): string { const x = typeof d === 'string' ? new Date(d) : d; return x.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
export function formatScore(s: number | null | undefined): string { return s === null || s === undefined ? '—' : `${(s * 100).toFixed(1)}%`; }
