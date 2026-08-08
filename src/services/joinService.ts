import { apiRequest } from './apiClient';
export interface JoinRequest { id: string; email: string | null; full_name: string | null; requested_domain: string | null; organization_id: string | null; requested_new_org_name: string | null; created_at: string; }
export interface Member { id: string; user_id: string; full_name: string | null; email: string | null; role: string; status: string; }
export async function myJoinStatus(): Promise<{ state: string; role?: string; matched_org?: boolean }> { return apiRequest('/api/me/join-status'); }
export async function listJoinRequests(): Promise<JoinRequest[]> { return apiRequest('/api/admin/join-requests'); }
export async function approveJoin(id: string, role: string): Promise<{ success: boolean }> { return apiRequest(`/api/admin/join-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ role }) }); }
export async function rejectJoin(id: string): Promise<{ success: boolean }> { return apiRequest(`/api/admin/join-requests/${id}/reject`, { method: 'POST' }); }
export async function listMembers(): Promise<Member[]> { return apiRequest('/api/admin/members'); }
export async function setMemberRole(profileId: string, role: string): Promise<{ success: boolean }> { return apiRequest(`/api/admin/members/${profileId}/role`, { method: 'POST', body: JSON.stringify({ role }) }); }
