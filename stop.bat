@echo off
REM FaceAttend - stop backend (8000) and frontend (5173).
set "FACEATTEND_ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:FACEATTEND_ROOT + 'scripts\stop.ps1'))"
pause
