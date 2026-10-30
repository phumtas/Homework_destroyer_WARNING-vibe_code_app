@echo off
title Homework Destroyer
echo ========================================================
echo    Starting Homework Destroyer - AI Homework Assistant
echo ========================================================
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    echo [OK] Using virtual environment...
    ".venv\Scripts\python.exe" app.py %*
) else (
    echo [!] Virtual environment not found. Using system python...
    python app.py %*
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] An error occurred while running Homework Destroyer.
    pause
)
