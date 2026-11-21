@echo off
chcp 65001 >nul
title Geoportal Itajaí — Abrir Mapa Interativo
cd /d "%~dp0"
echo ============================================================================
echo   Abrindo Geoportal Itajai no navegador padrao...
echo ============================================================================
start "" "%~dp0index.html"
