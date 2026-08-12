@echo off
echo.
echo  ====================================================
echo   LAEP — Lunar Autonomous Exploration Pipeline
echo  ====================================================
echo.
echo  [1/2] Starting FastAPI backend on http://localhost:8000
echo.
start "LAEP API" cmd /k "cd /d "%~dp0laep-api" && pip install -r requirements.txt -q && uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak >nul

echo  [2/2] Starting React frontend on http://localhost:5173
echo.
start "LAEP Web" cmd /k "cd /d "%~dp0laep-web" && npm install && npm run dev"

echo.
echo  Both servers are starting in separate windows.
echo  Open http://localhost:5173 in your browser.
echo.
pause
