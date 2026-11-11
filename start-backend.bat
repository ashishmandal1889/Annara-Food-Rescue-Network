@echo off
title Annara Backend (Spring Boot)
cd /d "%~dp0backend"

if "%JAVA_HOME%"=="" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-24"
)
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo ===================================================
echo   Starting Annara Spring Boot Backend (Port 8080)
echo   JAVA_HOME: %JAVA_HOME%
echo ===================================================
call mvnw.cmd spring-boot:run
pause
