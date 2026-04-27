@echo off
chcp 65001 >nul
title 桃園區處 DMS 憑證安裝工具
color 0B

echo ============================================================
echo   桃園區處文件管理系統 - 憑證安裝工具
echo   Taoyuan DMS Certificate Installer
echo ============================================================
echo.

REM === 檢查管理員權限 ===
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [警告] 偵測到您未以系統管理員身分執行
    echo.
    echo 請依下列步驟操作：
    echo   1. 關閉此視窗
    echo   2. 對 install-cert.bat 按右鍵
    echo   3. 選擇「以系統管理員身分執行」
    echo.
    pause
    exit /b 1
)

REM === 檢查憑證檔是否存在 ===
set CERT_FILE=%~dp0TaipowerDMS-RootCA.cer
if not exist "%CERT_FILE%" (
    echo [錯誤] 找不到憑證檔：%CERT_FILE%
    echo 請確認 install-cert.bat 與 TaipowerDMS-RootCA.cer 放在同一個資料夾
    echo.
    pause
    exit /b 1
)

echo [步驟 1/3] 檢查是否已安裝相同憑證...
certutil -store Root | findstr /C:"DMS Root CA" >nul
if %errorLevel% equ 0 (
    echo            已偵測到舊版憑證，將先移除...
    certutil -delstore Root "DMS Root CA" >nul 2>&1
)
echo            完成
echo.

echo [步驟 2/3] 安裝憑證至「受信任的根憑證授權單位」...
certutil -addstore -f Root "%CERT_FILE%"
if %errorLevel% neq 0 (
    echo [錯誤] 憑證安裝失敗
    pause
    exit /b 1
)
echo            完成
echo.

echo [步驟 3/3] 驗證安裝結果...
certutil -store Root | findstr /C:"DMS Root CA" >nul
if %errorLevel% neq 0 (
    echo [錯誤] 驗證失敗，憑證未正確安裝
    pause
    exit /b 1
)
echo            完成
echo.

echo ============================================================
echo   ✓ 憑證安裝成功！
echo.
echo   請完成以下操作：
echo     1. 完全關閉所有 Chrome / Edge 瀏覽器視窗
echo     2. 重新開啟瀏覽器
echo     3. 連線至 https://10.205.3.52:7443
echo     4. 確認網址列鎖頭顯示為安全（不再有警告）
echo ============================================================
echo.
pause
