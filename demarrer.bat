@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Sāqiya - serveur
echo ============================================================
echo  Sāqiya : serveur (site http://localhost:8000 - tableau de bord /app/)
echo  Seules les mesures du vrai boîtier (USB ou WiFi) sont affichées.
echo ============================================================
start "" http://localhost:8000/app/
python backend\server.py
pause
