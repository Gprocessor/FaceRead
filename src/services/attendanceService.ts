import { apiRequest, apiUpload, kioskApiUpload } from './apiClient';
export interface CheckInOutResponse { success: boolean; employee_id: string | null; attendance_log_id: string; attendance_session_id: string; check_type: string; status: string; verification_status: string; face_match_score: number; liveness_score: number; message: string; duplicate: boolean; employee_name?: string; employee_code?: string; }
export interface AdminReport {
  total_employees: number; present_today: number; late_today: number; absent_today: number; failed_verification_today: number; attendance_rate: number;
  records: Array<{ employee_id: string; employee_name: string; employee_code: string; department: string | null; status: string; check_in_time: string | null; check_out_time: string | null; face_match_score: number | null; liveness_score: number | null; }>;
}
export async function checkIn(employeeId: string, imageBlob: Blob, livenessSessionId: string, deviceInfo: Record<string, unknown>, location?: { latitude: number; longitude: number }): Promise<CheckInOutResponse> {
  const fd = new FormData();
  fd.append('employee_id', employeeId); fd.append('image', imageBlob, 'checkin.jpg'); fd.append('liveness_session_id', livenessSessionId); fd.append('device_info', JSON.stringify(deviceInfo));
  if (location) { fd.append('latitude', String(location.latitude)); fd.append('longitude', String(location.longitude)); }
  return apiUpload<CheckInOutResponse>('/api/attendance/check-in', fd);
}
export async function checkOut(employeeId: string, imageBlob: Blob, livenessSessionId: string, deviceInfo: Record<string, unknown>, location?: { latitude: number; longitude: number }): Promise<CheckInOutResponse> {
  const fd = new FormData();
  fd.append('employee_id', employeeId); fd.append('image', imageBlob, 'checkout.jpg'); fd.append('liveness_session_id', livenessSessionId); fd.append('device_info', JSON.stringify(deviceInfo));
  if (location) { fd.append('latitude', String(location.latitude)); fd.append('longitude', String(location.longitude)); }
  return apiUpload<CheckInOutResponse>('/api/attendance/check-out', fd);
}
export async function getAdminReports(dateFrom?: string, dateTo?: string): Promise<AdminReport> {
  const p = new URLSearchParams();
  if (dateFrom) p.append('date_from', dateFrom); if (dateTo) p.append('date_to', dateTo);
  const qs = p.toString();
  return apiRequest<AdminReport>(`/api/admin/reports${qs ? `?${qs}` : ''}`);
}
export async function getAdminEmployees(): Promise<Array<{ id: string; employee_code: string; full_name: string; email: string | null; department: string | null; status: string; face_enrolled: boolean }>> {
  return apiRequest('/api/admin/employees');
}
export async function createAdminEmployee(data: { employee_code: string; full_name: string; email: string; phone?: string; position?: string; department_id?: string; hire_date?: string }): Promise<{ success: boolean; employee_id: string; message: string }> {
  return apiRequest('/api/admin/employees', { method: 'POST', body: JSON.stringify(data) });
}

export async function kioskCheckIn(imageBlob: Blob, livenessSessionId: string, deviceInfo: Record<string, unknown>, location?: { latitude: number; longitude: number }): Promise<CheckInOutResponse> {
  const fd = new FormData();
  fd.append('image', imageBlob, 'checkin.jpg'); fd.append('liveness_session_id', livenessSessionId); fd.append('device_info', JSON.stringify(deviceInfo));
  if (location) { fd.append('latitude', String(location.latitude)); fd.append('longitude', String(location.longitude)); }
  return kioskApiUpload<CheckInOutResponse>('/api/kiosk/check-in', fd);
}
export async function kioskCheckOut(imageBlob: Blob, livenessSessionId: string, deviceInfo: Record<string, unknown>, location?: { latitude: number; longitude: number }): Promise<CheckInOutResponse> {
  const fd = new FormData();
  fd.append('image', imageBlob, 'checkout.jpg'); fd.append('liveness_session_id', livenessSessionId); fd.append('device_info', JSON.stringify(deviceInfo));
  if (location) { fd.append('latitude', String(location.latitude)); fd.append('longitude', String(location.longitude)); }
  return kioskApiUpload<CheckInOutResponse>('/api/kiosk/check-out', fd);
}
export async function getKioskKeyStatus(): Promise<{ configured: boolean; rotated_at: string | null }> {
  return apiRequest('/api/admin/kiosk-key');
}
export async function rotateKioskKey(): Promise<{ kiosk_api_key: string }> {
  return apiRequest('/api/admin/kiosk-key/rotate', { method: 'POST' });
}
