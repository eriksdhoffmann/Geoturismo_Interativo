@echo off
chcp 65001 >nul
title Enviar Branch Itajai 3D Bairros para o GitHub
echo ============================================================================
echo   Enviando a branch 'itajai-3d-bairros' para:
echo   https://github.com/eriksdhoffmann/Geoturismo_Interativo
echo ============================================================================
echo.
cd /d "%~dp0"

echo Verificando branch atual:
"C:\Program Files\Git\cmd\git.exe" branch

echo.
echo Executando o envio da branch (git push -u origin itajai-3d-bairros)...
echo.
"C:\Program Files\Git\cmd\git.exe" push -u origin itajai-3d-bairros

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================================
    echo   [SUCESSO] Branch 'itajai-3d-bairros' enviada com sucesso!
    echo   Acesse em: https://github.com/eriksdhoffmann/Geoturismo_Interativo/tree/itajai-3d-bairros
    echo ============================================================================
) else (
    echo.
    echo ============================================================================
    echo   [AVISO] Verifique a conexao ou autorizacao do GitHub na janela aberta.
    echo ============================================================================
)

echo.
pause
