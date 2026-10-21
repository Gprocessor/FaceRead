-- FaceAttend v1.4 - lower face/liveness defaults to match the new detector scoring.
-- Safe to run more than once.
ALTER TABLE app_settings ALTER COLUMN min_face_confidence SET DEFAULT 0.5;
ALTER TABLE app_settings ALTER COLUMN liveness_threshold  SET DEFAULT 0.6;
UPDATE app_settings SET min_face_confidence = 0.5 WHERE min_face_confidence > 0.5;
UPDATE app_settings SET liveness_threshold  = 0.6 WHERE liveness_threshold  > 0.6;
