@echo off
title He Thong Tu Dong Dang Bai Laptop Len Facebook - DESIGN BY VUONGGIA
echo ======================================================================
echo    HE THONG TU DONG DANG BAI LAPTOP NHAT LEN FACEBOOK FANPAGE
echo    DESIGN BY VUONGGIA /// HOTLINE / ZALO: 0876637806
echo ======================================================================
echo.
echo [1/2] Dang kiem tra dependencies...
if not exist node_modules (
    echo Dang cai dat thu vien...
    call npm install
)
echo.
echo [2/2] Dang khoi chay may chu...
start http://localhost:3000
node server.js
pause
