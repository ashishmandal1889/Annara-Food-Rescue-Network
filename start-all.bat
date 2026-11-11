@echo off
title Annara Food Rescue Network
echo ===================================================
echo   Launching Annara Full Stack Application
echo ===================================================

if "%JAVA_HOME%"=="" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-24"
)

echo 1. Launching Backend on http://localhost:8080 ...
start "Annara Backend (Spring Boot)" cmd /k "cd /d %~dp0backend && set JAVA_HOME=%JAVA_HOME% && set PATH=%JAVA_HOME%\bin;%%PATH%% && mvnw.cmd spring-boot:run"

echo 2. Launching Frontend on http://localhost:5173 ...
start "Annara Frontend (Vite React)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo ===================================================
echo Both services are starting in dedicated windows!
echo - Web App: http://localhost:5173
echo - API:     http://localhost:8080/api
echo ===================================================
timeout /t 5
