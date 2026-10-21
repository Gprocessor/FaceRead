@echo off
REM FaceAttend - one-click launcher. Run from the project root.
cd /d "%~dp0"
set "FACEATTEND_ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:FACEATTEND_ROOT + 'start.ps1'))"
