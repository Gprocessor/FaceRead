export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}
export function validateEmployeeCode(code: string): boolean {
  return /^[A-Z0-9-]{3,20}$/i.test(code);
}
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return `${(score * 100).toFixed(1)}%`;
}
