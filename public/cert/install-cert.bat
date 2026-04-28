@echo off
chcp 65001 >nul
title DMS Certificate Installer (Current User)
color 0B

echo ============================================================
echo   桃園區處文件管理系統 - 憑證安裝工具
echo   Taoyuan DMS Certificate Installer (Current User)
echo ============================================================
echo.
echo   - 本版本不需要系統管理員權限
echo   - 憑證僅安裝至「目前 Windows 使用者」帳號
echo   - 若同一台電腦有多個 Windows 帳號，每個帳號皆需執行一次
echo.

REM === 檢查憑證檔是否存在 ===
set "CERT_FILE=%~dp0TaipowerDMS-RootCA.cer"
if not exist "%CERT_FILE%" (
    echo [ERROR] 找不到憑證檔: %CERT_FILE%
    echo 請確認 install-cert.bat 與 TaipowerDMS-RootCA.cer 放在同一個資料夾
    echo.
    pause
    exit /b 1
)

echo [步驟 1/3] 檢查是否已安裝相同憑證...
certutil -user -store Root | findstr /C:"DMS Root CA" >nul
if %errorLevel% equ 0 (
    echo            已偵測到舊版憑證，將先移除...
    certutil -user -delstore Root "DMS Root CA" >nul 2>&1
)
echo            完成
echo.

echo [步驟 2/3] 安裝憑證至「目前使用者 - 受信任的根憑證授權單位」...
certutil -user -addstore -f Root "%CERT_FILE%"
if %errorLevel% neq 0 (
    echo [ERROR] 憑證安裝失敗
    echo 請改用滑鼠雙擊 TaipowerDMS-RootCA.cer 手動安裝
    pause
    exit /b 1
)
echo            完成
echo.

echo [步驟 3/3] 驗證安裝結果...
certutil -user -store Root | findstr /C:"DMS Root CA" >nul
if %errorLevel% neq 0 (
    echo [ERROR] 驗證失敗，憑證未正確安裝
    pause
    exit /b 1
)
echo            完成
echo.

echo ============================================================
echo   [OK] 憑證安裝成功！（已套用至目前 Windows 使用者）
echo.
echo   請完成以下操作：
echo     1. 完全關閉所有 Chrome / Edge 瀏覽器視窗
echo     2. 重新開啟瀏覽器
echo     3. 連線至 https://10.205.3.52:7443
echo     4. 確認網址列鎖頭顯示為安全（不再有警告）
echo.
echo   提醒：若您切換到其他 Windows 帳號使用本系統，
echo         請在該帳號下再次執行此 BAT。
echo ============================================================
echo.
pause
