@echo off
chcp 65001 >nul
title Enviar Branch Vale Tombado Rio da Luz para o GitHub
echo ============================================================================
echo   Enviando a branch 'vale-tombado-rio-da-luz' para:
echo   https://github.com/eriksdhoffmann/Geoturismo_Interativo
echo ============================================================================
echo.
cd /d "%~dp0"

echo Verificando branch atual:
"C:\Program Files\Git\cmd\git.exe" branch

echo.
echo Executando o envio da branch (git push -u origin vale-tombado-rio-da-luz)...
echo.
"C:\Program Files\Git\cmd\git.exe" push -u origin vale-tombado-rio-da-luz

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================================
    echo   [SUCESSO] Branch 'vale-tombado-rio-da-luz' enviada com sucesso!
    echo   Acesse em: https://github.com/eriksdhoffmann/Geoturismo_Interativo/tree/vale-tombado-rio-da-luz
    echo ============================================================================
) else (
    echo.
    echo ============================================================================
    echo   [AVISO] Verifique a conexao ou autorizacao do GitHub na janela aberta.
    echo ============================================================================
)

echo.
pause
