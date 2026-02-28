@echo off
title PulsePay Dev Server
color 0B
cls

echo.
echo  ======================================================
echo   PULSEPAY - Development Server
echo  ======================================================
echo.

:: ── Check .env exists in backend folder ────────────────────────
if not exist "backend\.env" (
    color 0C
    echo  [ERROR] backend\.env file not found!
    echo.
    echo  Steps to fix:
    echo  1. Go into the "backend" folder
    echo  2. Create a new file called ".env"  (no .txt extension)
    echo  3. Paste your DATABASE_URL, DIRECT_URL, and JWT_SECRET
    echo  4. Save the file and run start.bat again
    echo.
    echo  See DEPLOY.md for exact instructions.
    echo.
    pause
    exit /b 1
)

:: ── Check node_modules exists ──────────────────────────────────
if not exist "node_modules" (
    echo  [SETUP] First time setup - installing dependencies...
    echo.
    npm install
    if errorlevel 1 (
        color 0C
        echo.
        echo  [ERROR] npm install failed. Make sure Node.js is installed.
        echo  Download from: https://nodejs.org
        pause
        exit /b 1
    )
    echo.
)

:: ── Start server ───────────────────────────────────────────────
echo  [OK] Everything looks good!
echo.
echo  Starting server...
echo.
echo  --------------------------------------------------------
echo   Open in browser: http://localhost:5000
echo   Admin panel:     http://localhost:5000/admin/
echo  --------------------------------------------------------
echo.
echo  (Press Ctrl+C to stop the server)
echo.

npm run dev

pause
