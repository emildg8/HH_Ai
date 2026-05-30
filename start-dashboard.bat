@echo off
cd /d "%~dp0"
echo HH Ai — http://127.0.0.1:3849
echo Закройте окно для остановки дашборда.
node scripts/dashboard-server.mjs
pause
