@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run Setup ScrewShop.cmd first.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" scripts\keep_running.py
start "" "http://localhost:5050/barwork"
