@echo off
title AYC Global Market - Durdurma
echo.
echo  AYC Global Market - Tum servisler duduruluyor...
echo.
taskkill /fi "WindowTitle eq AYC-Gateway*" /f >nul 2>&1 && echo   [OK] Gateway durduruldu
taskkill /fi "WindowTitle eq AYC-AI*"      /f >nul 2>&1 && echo   [OK] AI-Service durduruldu
taskkill /fi "WindowTitle eq AYC-Signal*"  /f >nul 2>&1 && echo   [OK] Signal-Service durduruldu
taskkill /fi "WindowTitle eq AYC-Web*"     /f >nul 2>&1 && echo   [OK] Web App durduruldu
echo.
echo  Port kontrol:
netstat -an | findstr ":3000 :8000 :8001 :8002" | findstr LISTENING
echo.
echo  Tamamlandi.
pause