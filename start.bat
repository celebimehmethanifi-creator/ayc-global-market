@echo off
chcp 65001 >nul 2>&1
title AYC Global Market - Baslatici

:: ============================================================
::  AYC Global Market  -  start.bat
::  Cift tikla, sistem kalkar.
::  Durdurmak icin:  stop.bat
:: ============================================================

set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%
set LOGDIR=%ROOT%\.logs

if not exist "%LOGDIR%" mkdir "%LOGDIR%"

echo.
echo  ================================================
echo   AYC Global Market  -  Tam Sistem Baslatici
echo  ================================================
echo.

:: Parametreye gore mod sec
if /i "%1"=="stop"   goto :STOP_ALL
if /i "%1"=="status" goto :STATUS

:: ---------- BASLATMA ----------
call :banner "1/4  Gateway baslatiliyor  (port 8000)"
start "AYC-Gateway" /min cmd /c "cd /d "%ROOT%\services\gateway" && C:\n\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "%LOGDIR%\gateway.log" 2>&1"

call :banner "2/4  AI-Service baslatiliyor  (port 8001)"
start "AYC-AI" /min cmd /c "cd /d "%ROOT%\services\ai-service" && C:\n\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload > "%LOGDIR%\ai-service.log" 2>&1"

call :banner "3/4  Signal-Service baslatiliyor  (port 8002)"
start "AYC-Signal" /min cmd /c "cd /d "%ROOT%\services\signal-service" && C:\n\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload > "%LOGDIR%\signal-service.log" 2>&1"

call :banner "4/4  Web App baslatiliyor  (port 3000)"
set NEXT_BIN=%ROOT%\node_modules\.pnpm\next@14.2.3_react-dom@18.3.1_react@18.3.1__react@18.3.1\node_modules\next\dist\bin\next
start "AYC-Web" /min cmd /c "cd /d "%ROOT%\apps\web" && node "%NEXT_BIN%" dev > "%LOGDIR%\web.log" 2>&1"

echo.
echo  Servisler arka planda baslatiliyor...
echo  Hazir olmasi icin ~20 saniye bekleyin.
echo.
timeout /t 20 /nobreak >nul

:: Saglik kontrolu (basit ping)
call :check_port 8000 "Gateway"
call :check_port 8001 "AI-Service"
call :check_port 8002 "Signal-Service"
call :check_port 3000 "Web App"

echo.
echo  ================================================
echo   ADRESLER
echo  ================================================
echo   Web Arayuzu  ->  http://localhost:3000
echo   API Gateway  ->  http://localhost:8000
echo   API Docs     ->  http://localhost:8000/docs
echo   AI Service   ->  http://localhost:8001
echo   Signal Svc   ->  http://localhost:8002
echo  ================================================
echo.
echo  Durdurmak icin: stop.bat  ya da start.bat stop
echo.
pause
goto :EOF

:: ---------- DURDURMA ----------
:STOP_ALL
echo  Servisler kapatiliyor...
taskkill /fi "WindowTitle eq AYC-Gateway*" /f >nul 2>&1
taskkill /fi "WindowTitle eq AYC-AI*"     /f >nul 2>&1
taskkill /fi "WindowTitle eq AYC-Signal*" /f >nul 2>&1
taskkill /fi "WindowTitle eq AYC-Web*"    /f >nul 2>&1
echo  Tum AYC servis pencereleri kapatildi.
echo.
pause
goto :EOF

:: ---------- DURUM ----------
:STATUS
echo  Servis Durumu:
call :check_port 8000 "Gateway     "
call :check_port 8001 "AI-Service  "
call :check_port 8002 "Signal-Svc  "
call :check_port 3000 "Web App     "
echo.
pause
goto :EOF

:: ---------- YARDIMCI: PORT KONTROL ----------
:check_port
netstat -an | findstr ":%1 " | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo   [OK]  %~2  -  Port %1 dinleniyor
) else (
  echo   [!!]  %~2  -  Port %1 kapali ^(log: .logs\%~2.log^)
)
goto :EOF

:: ---------- YARDIMCI: BASLIK ----------
:banner
echo.
echo   ^>^> %~1
goto :EOF