@echo off
chcp 65001 >nul
title Enviar para o GitHub - Geoturismo Interativo
echo ============================================================================
echo   Enviando o projeto para: https://github.com/eriksdhoffmann/Geoturismo_Interativo
echo ============================================================================
echo.
cd /d "%~dp0"

echo Verificando URL remota:
"C:\Program Files\Git\cmd\git.exe" remote -v

echo.
echo Executando o envio (git push -u origin main)...
echo.
echo [ATENCAO] Se o Git pedir login, uma janela do navegador ou uma janela de
echo login do GitHub se abrira. Basta clicar em "Sign in with your browser"!
echo.
"C:\Program Files\Git\cmd\git.exe" push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================================
    echo   [SUCESSO] Seu projeto foi enviado com sucesso para o GitHub!
    echo   Acesse em: https://github.com/eriksdhoffmann/Geoturismo_Interativo
    echo ============================================================================
) else (
    echo.
    echo ============================================================================
    echo   [AVISO] Se o envio falhou:
    echo   1. Verifique se o repositorio foi criado com o nome: Geoturismo_Interativo
    echo   2. Verifique se voce autorizou o login do GitHub na janela que se abriu.
    echo ============================================================================
)

echo.
pause
