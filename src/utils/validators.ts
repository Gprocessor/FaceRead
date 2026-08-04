export function formatDate(date: string | Date): string { const d = typeof date === 'string' ? new Date(date) : date; return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
export function formatTime(date: string | Date): string { const d = typeof date === 'string' ? new Date(date) : date; return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
export function formatScore(score: number | null | undefined): string { return score === null || score === undefined ? '—' : `${(score * 100).toFixed(1)}%`; }
