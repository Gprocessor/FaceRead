import { supabase } from './supabaseClient';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
if (!API_BASE_URL) throw new Error('Missing VITE_API_BASE_URL in .env');
export class ApiError extends Error { status: number; detail: unknown; constructor(m: string, s: number, d?: unknown) { super(m); this.name = 'ApiError'; this.status = s; this.detail = d; } }
async function authHeaders(): Promise<Record<string,string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const h: Record<string,string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
  return h;
}
export async function apiRequest<T=unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string,string>) } });
  let body: unknown = null; if (res.headers.get('content-type')?.includes('application/json')) body = await res.json();
  if (!res.ok) throw new ApiError((body as {detail?:string})?.detail || (body as {message?:string})?.message || `Request failed (${res.status})`, res.status, body);
  return body as T;
}
export async function apiUpload<T=unknown>(path: string, formData: FormData): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string,string> = {}; if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData });
  let body: unknown = null; if (res.headers.get('content-type')?.includes('application/json')) body = await res.json();
  if (!res.ok) throw new ApiError((body as {detail?:string})?.detail || `Upload failed (${res.status})`, res.status, body);
  return body as T;
}
export const KIOSK_KEY_STORAGE_KEY = 'faceread_kiosk_api_key';
export function getKioskKey(): string | null { return localStorage.getItem(KIOSK_KEY_STORAGE_KEY); }
export function setKioskKey(k: string) { localStorage.setItem(KIOSK_KEY_STORAGE_KEY, k); }
export function clearKioskKey() { localStorage.removeItem(KIOSK_KEY_STORAGE_KEY); }
export async function kioskApiUpload<T=unknown>(path: string, formData: FormData): Promise<T> {
  const key = getKioskKey(); if (!key) throw new ApiError('This kiosk is not paired yet', 401);
  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: { 'X-Kiosk-Key': key }, body: formData });
  let body: unknown = null; if (res.headers.get('content-type')?.includes('application/json')) body = await res.json();
  if (!res.ok) throw new ApiError((body as {detail?:string})?.detail || `Request failed (${res.status})`, res.status, body);
  return body as T;
}
