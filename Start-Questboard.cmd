@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -File "%~dp0Launch-Questboard.ps1" %*
if errorlevel 1 (
  echo.
  echo Questboard could not start. See .local\logs\launcher.log for details.
  pause
  exit /b 1
)
