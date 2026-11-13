@echo off
chcp 65001 >nul
title Passeio Virtual 360 - Vale do Rio da Luz
echo ============================================================================
echo   Abrindo o Passeio Virtual 360 no Google Chrome...
echo ============================================================================
echo.
cd /d "%~dp0"

set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME_EXE%" (
    start "" "%CHROME_EXE%" "file:///%~dp0index.html"
) else (
    start "" "%~dp0index.html"
)
exit
