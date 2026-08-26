@echo off
rem MIMON BARAKA UNIVERSE - Startdatei fuer Windows. Einfach doppelklicken.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js ist nicht installiert.
  echo   Bitte die LTS-Version von https://nodejs.org installieren,
  echo   danach diese Datei erneut doppelklicken.
  echo.
  start "" https://nodejs.org/de/download
  pause
  exit /b 1
)

echo.
echo   MIMON BARAKA UNIVERSE wird gestartet...
echo   Der Browser oeffnet sich gleich von selbst.
echo.
node tools/serve.mjs --open
pause
