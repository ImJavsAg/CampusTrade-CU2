@echo off
title Servidor Web CampusTrade CU2 (BUAP)
echo ========================================================
echo   Iniciando Servidor Web CampusTrade CU2 BUAP...
echo ========================================================

set NODE_PATH="%APPDATA%\Antigravity\bin\agy-node.cmd"

if exist %NODE_PATH% (
    call %NODE_PATH% server.js
) else (
    echo [INFO] Utilizando node del sistema...
    node server.js
)

pause
