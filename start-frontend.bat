@echo off
title Annara Frontend (Vite React)
cd /d "%~dp0frontend"
echo ===================================================
echo   Starting Annara Frontend (Port 5173)
echo ===================================================
call npm run dev
pause
