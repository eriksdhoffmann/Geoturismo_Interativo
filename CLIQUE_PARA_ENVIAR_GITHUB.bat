@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Enviar Tudo para o GitHub Oficial - Geoturismo Interativo

echo ============================================================================
echo   ENVIAR GEOTURISMO INTERATIVO PARA O GITHUB OFICIAL (branch main)
echo   Repositorio: https://github.com/eriksdhoffmann/Geoturismo_Interativo
echo ============================================================================
echo.
cd /d "%~dp0"

set "GIT_EXE="
set "GIT_DIR="

if exist "C:\Program Files\Git\cmd\git.exe" (
    set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
    set "GIT_DIR=C:\Program Files\Git\cmd"
) else (
    for /f "delims=" %%G in ('where git 2^>nul') do (
        set "GIT_EXE=%%G"
        set "GIT_DIR=%%~dpG"
        goto :git_ok
    )
)

if not defined GIT_EXE (
    if exist "C:\Users\11865493945\.gemini\antigravity\brain\fd8c641d-3354-4404-b854-10dcc7ac23d6\scratch\mingit\cmd\git.exe" (
        set "GIT_EXE=C:\Users\11865493945\.gemini\antigravity\brain\fd8c641d-3354-4404-b854-10dcc7ac23d6\scratch\mingit\cmd\git.exe"
        set "GIT_DIR=C:\Users\11865493945\.gemini\antigravity\brain\fd8c641d-3354-4404-b854-10dcc7ac23d6\scratch\mingit\cmd"
    )
)

:git_ok
if not defined GIT_EXE (
    echo [ERRO] Git nao encontrado neste computador!
    echo Instale o GitHub Desktop ou Git for Windows e tente novamente.
    pause
    exit /b 1
)

set "PATH=%GIT_DIR%;%PATH%"
echo Git encontrado: %GIT_EXE%
echo.
echo [IMPORTANTE] Se abrir uma janela de login do GitHub:
echo   1. Clique no botao azul "Sign in with your browser"
echo   2. No Google Chrome, clique em "Authorize" (Autorizar)
echo.
echo Enviando para o GitHub (git push -u origin main)...
echo.

"%GIT_EXE%" -c safe.directory=* push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================================
    echo   [SUCESSO!] Todos os arquivos foram enviados para o GitHub oficial!
    echo   Aguarde 1 a 2 minutos e atualize seu navegador em:
    echo   https://eriksdhoffmann.github.io/Geoturismo_Interativo/
    echo ============================================================================
) else (
    echo.
    echo ============================================================================
    echo   [AVISO] O envio nao foi concluido.
    echo   - Verifique se voce clicou em "Sign in with your browser" e autorizou.
    echo   - Verifique sua conexao com a internet.
    echo ============================================================================
)

echo.
pause
