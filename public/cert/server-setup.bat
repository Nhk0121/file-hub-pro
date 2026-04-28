@echo off
chcp 65001 >nul
title DMS Server Cert Setup
color 0A

REM ============================================================
REM  Usage / 使用方式
REM
REM  When to run / 執行時機:
REM    1. First-time DMS server setup / 首次架設伺服器
REM    2. Server IP changed / 伺服器 IP 變更
REM    3. Auto-renewal failed / 自動續簽失敗（一般免手動執行）
REM
REM  Prerequisites / 前置條件:
REM    1. Run on DMS server (10.205.3.52) only
REM       僅可在 DMS 伺服器主機執行
REM    2. Right-click -> Run as Administrator
REM       右鍵 -> 以系統管理員身分執行
REM    3. IIS installed, sites bound to 7443/8443
REM       IIS 已安裝且 DMS 站台已建立（Port 7443/8443）
REM
REM  What it does / 動作:
REM    1. Create Root CA (20 years) / 建立 Root CA
REM    2. Issue server cert (2 years) / 簽發伺服器憑證
REM    3. Bind to IIS / 繫結 IIS
REM    4. Register weekly auto-renew task / 註冊每週自動續簽
REM    5. Copy .cer to D:\TaoyuanDMS-Frontend\cert\ for download
REM       複製 .cer 至前端目錄供使用者下載
REM ============================================================

echo ============================================================
echo   桃園區處 DMS - 伺服器端憑證一鍵製作工具
echo   （僅在伺服器 10.205.3.52 上執行）
echo ============================================================
echo.

REM === Check Administrator privilege ===
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please run as Administrator
    echo [錯誤] 請以系統管理員身分執行此 BAT
    pause
    exit /b 1
)

REM === Locate setup-cert.ps1 in same folder ===
set "PS_SCRIPT=%~dp0setup-cert.ps1"

if not exist "%PS_SCRIPT%" (
    echo [ERROR] setup-cert.ps1 not found in: %~dp0
    echo [錯誤] 找不到 setup-cert.ps1，請確認與本 BAT 放在同一資料夾
    pause
    exit /b 1
)

echo [INFO] Executing PowerShell script...
echo [資訊] 開始執行 PowerShell 腳本...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%"

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Setup failed. Please check messages above.
    echo [錯誤] 憑證製作失敗，請檢查上方訊息
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   接下來請通知使用者：
echo     登入頁底部 → 點選「下載憑證」→ 取得 .cer 與 install-cert.bat
echo ============================================================
echo.
pause
