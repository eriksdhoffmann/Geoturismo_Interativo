@echo off
chcp 65001 >nul
title Passeio Virtual 360 - Timbe do Sul (SC)
echo ============================================================================
echo   Abrindo o Geoturismo SC (Timbe do Sul 360) no Google Chrome...
echo ============================================================================
echo.
cd /d "%~dp0"

set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME_EXE%" (
    start "" "%CHROME_EXE%" "file:///%~dp0index.html?regiao=caminho_dos_canions"
) else (
    start "" "%~dp0index.html"
)
exit
