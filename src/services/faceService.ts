import { apiRequest, apiUpload } from './apiClient';

export interface EnrollmentResult { success: boolean; employee_id: string; face_profile_id?: string; enrollment_status: string; message: string; face_detected: boolean; face_count: number; }
export interface VerificationResult { success: boolean; employee_id: string; face_match_score: number; verified: boolean; threshold: number; message: string; face_detected: boolean; face_count: number; }
export interface LivenessChallengeResponse { challenge_type: string; instruction: string; session_id: string; }
export interface LivenessResult { passed: boolean; challenge_type: string; liveness_score: number; failure_reason: string | null; frame_count: number; processing_time_ms: number; session_id: string; }

export async function enrollFace(employeeId: string, imageBlob: Blob, consentId: string, deviceInfo: Record<string, unknown>): Promise<EnrollmentResult> {
  const fd = new FormData();
  fd.append('employee_id', employeeId); fd.append('image', imageBlob, 'enrollment.jpg');
  fd.append('consent_id', consentId); fd.append('device_info', JSON.stringify(deviceInfo));
  return apiUpload<EnrollmentResult>('/api/face/enroll', fd);
}
export async function verifyFace(employeeId: string, imageBlob: Blob, deviceInfo: Record<string, unknown>): Promise<VerificationResult> {
  const fd = new FormData();
  fd.append('employee_id', employeeId); fd.append('image', imageBlob, 'verify.jpg'); fd.append('device_info', JSON.stringify(deviceInfo));
  return apiUpload<VerificationResult>('/api/face/verify', fd);
}
export async function requestLivenessChallenge(): Promise<LivenessChallengeResponse> {
  return apiRequest<LivenessChallengeResponse>('/api/liveness/challenge', { method: 'POST', body: JSON.stringify({}) });
}
export async function submitLivenessCheck(sessionId: string, challengeType: string, frames: Blob[], deviceInfo: Record<string, unknown>): Promise<LivenessResult> {
  const fd = new FormData();
  fd.append('session_id', sessionId); fd.append('challenge_type', challengeType);
  frames.forEach((f, i) => fd.append('frames', f, `frame_${i}.jpg`));
  fd.append('device_info', JSON.stringify(deviceInfo));
  return apiUpload<LivenessResult>('/api/liveness/check', fd);
}
