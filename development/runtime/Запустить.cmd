@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22 or 24 LTS, then run this file again.
  echo https://nodejs.org/
  pause
  exit /b 1
)
node -e "var v=process.versions.node.split('.').map(Number);if(v[0]<20||(v[0]===20&&v[1]<6))process.exit(1)"
if errorlevel 1 (
  echo Node.js 20.6 or newer is required. Node.js 22 or 24 LTS is recommended.
  pause
  exit /b 1
)
if not exist "node_modules\better-sqlite3" (
  echo First start: installing the local server dependency...
  if exist "package-lock.json" (
    call npm ci --omit=dev --no-audit --no-fund
  ) else (
    call npm install --omit=dev --no-audit --no-fund
  )
  if errorlevel 1 (
    echo Installation failed. Check internet access and use an LTS version of Node.js.
    pause
    exit /b 1
  )
)
if not exist "dist\index.html" (
  echo Missing dist folder. Extract the complete archive, not just this file.
  pause
  exit /b 1
)
if exist ".env" (
  node --env-file=.env server.mjs --open
) else (
  node server.mjs --open
)
pause
