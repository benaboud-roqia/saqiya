@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Sāqiya - serveur (boîtier réel)
echo ============================================================
echo  Sāqiya - mode réel : serveur seul, sans simulateur
echo  Le boîtier ESP32 doit être configuré avec l'adresse ci-dessous.
echo ============================================================
start "" http://localhost:8000/app/
python backend\server.py
pause
