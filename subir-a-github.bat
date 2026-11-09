@echo off
title Sincronizar Cambios con GitHub y Netlify
echo ========================================================
echo    Subir y Actualizar LoboTrade CU2 en GitHub y Netlify
echo ========================================================

git status
echo.
set /p msg="Escribe el mensaje de los cambios que hiciste (o presiona ENTER): "
if "%msg%"=="" set msg=Actualizacion de funciones de la pagina

echo.
echo [1/3] Preparando archivos...
git add .

echo [2/3] Guardando cambios locales...
git commit -m "%msg%"

echo [3/3] Subiendo a GitHub (Netlify se actualizara automaticamente)...
git push

echo.
echo ========================================================
echo   Listo! En segundos tus cambios estaran en vivo en Netlify.
echo ========================================================
pause
