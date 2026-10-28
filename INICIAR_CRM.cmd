@echo off
setlocal
set "AERCOM_PWSH=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%AERCOM_PWSH%" (
  echo No se encontro Windows PowerShell. No se instalo ningun programa.
  echo Consulta GUIA_LOCAL.md o avisa el mensaje que aparece.
  pause
  exit /b 1
)
"%AERCOM_PWSH%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar_crm_windows.ps1"
if errorlevel 1 echo No se pudo iniciar el CRM. Revisa el mensaje anterior.
pause
