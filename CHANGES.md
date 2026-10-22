# FaceAttend v1.4.1

## Fixed in this build
- Liveness on/off: the kiosk now asks the server before every scan. Turning
  "Require liveness challenge" off in Settings skips the blink/turn step immediately.
- Settings save now shows the real error if it fails (previously always said "Saved").
- Kiosk footer shows "Liveness on/off" and the build tag "v1.4.1 · full-frame".
- People Fields page, dynamic People form with Edit, org type on registration,
  dynamic report/CSV columns, flexible ID formats (e.g. ABC/2023/014).

## Already in v1.4 (kept)
- Full-frame camera (no oval), instructions inside the camera, browser video buttons hidden.
- Faster scanning, persistent liveness sessions, landmark-based liveness, 1 automatic retry.
- Report date filters, password reset, Organisation Type in Settings.

## After copying
1. Run supabase/migrations/00_faceattend_full_setup.sql once (safe to repeat).
2. stop.bat, then "launch App.bat".
3. In the browser press Ctrl+F5 so the old cached kiosk page is not shown.
