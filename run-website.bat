@echo off
cd /d "%~dp0"
echo Starting Agarwal Medical website...
echo.
echo Website: http://localhost:3000
echo Admin Login: http://localhost:3000/admin-login.html
echo.
echo Keep this window open. Press Ctrl+C to stop the server.
echo.
"C:\Users\Rahul Agarwal\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.js
pause
