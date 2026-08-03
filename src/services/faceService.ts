import { apiRequest, apiUpload } from './apiClient';

export interface EnrollmentResult {
  success: boolean;
  employee_id: string;
  face_profile_id?: string;
  enrollment_status: string;
  message: string;
  face_detected: boolean;
  face_count: number;
}

export interface VerificationResult {
  success: boolean;
  employee_id: string;
  face_match_score: number;
  verified: boolean;
  threshold: number;
  message: string;
  face_detected: boolean;
  face_count: number;
}

export interface LivenessChallengeResponse {
  challenge_type: string;
  instruction: string;
  session_id: string;
}

export interface LivenessResult {
  passed: boolean;
  challenge_type: string;
  liveness_score: number;
  failure_reason: string | null;
  frame_count: number;
  processing_time_ms: number;
  session_id: string;
}

export async function enrollFace(
  employeeId: string,
  imageBlob: Blob,
  consentId: string,
  deviceInfo: Record<string, unknown>
): Promise<EnrollmentResult> {
  const formData = new FormData();
  formData.append('employee_id', employeeId);
  formData.append('image', imageBlob, 'enrollment.jpg');
  formData.append('consent_id', consentId);
  formData.append('device_info', JSON.stringify(deviceInfo));
  return apiUpload<EnrollmentResult>('/api/face/enroll', formData);
}

export async function verifyFace(
  employeeId: string,
  imageBlob: Blob,
  deviceInfo: Record<string, unknown>
): Promise<VerificationResult> {
  const formData = new FormData();
  formData.append('employee_id', employeeId);
  formData.append('image', imageBlob, 'verify.jpg');
  formData.append('device_info', JSON.stringify(deviceInfo));
  return apiUpload<VerificationResult>('/api/face/verify', formData);
}

export async function requestLivenessChallenge(): Promise<LivenessChallengeResponse> {
  return apiRequest<LivenessChallengeResponse>('/api/liveness/challenge', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function submitLivenessCheck(
  sessionId: string,
  challengeType: string,
  frames: Blob[],
  deviceInfo: Record<string, unknown>
): Promise<LivenessResult> {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('challenge_type', challengeType);
  frames.forEach((frame, i) => {
    formData.append('frames', frame, `frame_${i}.jpg`);
  });
  formData.append('device_info', JSON.stringify(deviceInfo));
  return apiUpload<LivenessResult>('/api/liveness/check', formData);
}
