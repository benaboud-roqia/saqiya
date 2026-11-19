@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Sāqiya - en ligne
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0en_ligne.ps1"
echo.
pause
