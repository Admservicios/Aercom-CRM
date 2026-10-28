@echo off
setlocal
where py >nul 2>&1
if not errorlevel 1 (
  py -3 "%~dp0iniciar_crm.py"
  goto fin
)
where python >nul 2>&1
if not errorlevel 1 (
  python "%~dp0iniciar_crm.py"
  goto fin
)
echo Se necesita Python 3.10 o posterior para iniciar el servidor local.
echo No se instalo ningun programa. Consulta GUIA_LOCAL.md.
:fin
pause
