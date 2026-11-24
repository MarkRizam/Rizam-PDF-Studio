@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js 22 or newer is required. Install it from https://nodejs.org/
    pause
    exit /b 1
)
echo Starting Rizam PDF Studio...
if not exist "node_modules" (
    echo Installing PDF editor dependencies. Internet connection needed for first run.
    call npm install
    if errorlevel 1 (
        echo Could not install dependencies. Check your internet connection and try again.
        pause
        exit /b 1
    )
)
echo Open the local web address shown below in Chrome or Edge.
call npm run dev
pause
