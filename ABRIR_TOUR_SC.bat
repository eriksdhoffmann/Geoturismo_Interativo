@echo off
chcp 65001 >nul
title GeoSC 360 - Passeio Virtual Interativo de Santa Catarina
echo ============================================================================
echo   GeoSC 360° - Passeio Virtual Interativo de Santa Catarina
echo   Inspirado na arquitetura do Geohereditas (IGc-USP)
echo ============================================================================
echo.
echo Abrindo o Passeio Virtual 360° no seu navegador padrao...
start "" "%~dp0index.html"
echo.
echo Pronto! O tour foi aberto no navegador.
echo Dica: Para adicionar suas proprias fotos 360 ou novos pontos clicaveis,
echo clique no botao "Criar Ponto / Trocar Foto" na barra inferior do sistema!
echo.
pause
