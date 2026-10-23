@echo off
setlocal
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%app"

where py >nul 2>nul
if %errorlevel%==0 (
  set "PYTHON_CMD=py -3"
) else (
  set "PYTHON_CMD=python"
)

%PYTHON_CMD% -c "import openpyxl" >nul 2>nul
if errorlevel 1 (
  echo Required package is missing.
  echo Run: %PYTHON_CMD% -m pip install -r "%ROOT_DIR%requirements.txt"
  pause
  exit /b 1
)

start "Qualitative Bias Analysis" %PYTHON_CMD% server.py
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8773"
