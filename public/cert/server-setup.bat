@echo off
chcp 65001 >nul
title 桃園區處 DMS 伺服器憑證一鍵製作工具
color 0A

echo ============================================================
echo   桃園區處 DMS - 伺服器端憑證一鍵製作工具
echo   （僅在伺服器 10.205.3.52 上執行）
echo ============================================================
echo.

REM === 檢查管理員權限 ===
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [錯誤] 請以系統管理員身分執行此 BAT
    pause
    exit /b 1
)

REM === 設定參數（可依需要修改）===
set SERVER_IP=10.205.3.52
set CERT_DIR=C:\DMS-Cert
set ROOT_CA_NAME=DMS Root CA
set ROOT_CA_YEARS=30
set SERVER_CERT_YEARS=2
set FRONTEND_PORT=7443
set BACKEND_PORT=8443

if not exist "%CERT_DIR%" mkdir "%CERT_DIR%"

echo [步驟 1/5] 建立 PowerShell 執行腳本...
set PS_FILE=%CERT_DIR%\setup-cert.ps1

> "%PS_FILE%" echo $ErrorActionPreference = "Stop"
>>"%PS_FILE%" echo $serverIp = "%SERVER_IP%"
>>"%PS_FILE%" echo $certDir  = "%CERT_DIR%"
>>"%PS_FILE%" echo.
>>"%PS_FILE%" echo Write-Host "[1] 移除舊的 Root CA..." -ForegroundColor Yellow
>>"%PS_FILE%" echo Get-ChildItem Cert:\LocalMachine\My ^| Where-Object { $_.Subject -like "*%ROOT_CA_NAME%*" } ^| Remove-Item -Force -ErrorAction SilentlyContinue
>>"%PS_FILE%" echo Get-ChildItem Cert:\LocalMachine\Root ^| Where-Object { $_.Subject -like "*%ROOT_CA_NAME%*" } ^| Remove-Item -Force -ErrorAction SilentlyContinue
>>"%PS_FILE%" echo.
>>"%PS_FILE%" echo Write-Host "[2] 建立 30 年 Root CA..." -ForegroundColor Yellow
>>"%PS_FILE%" echo $rootCA = New-SelfSignedCertificate ^^^
>>"%PS_FILE%" echo     -Subject "CN=%ROOT_CA_NAME%, O=Taipower Taoyuan, C=TW" ^^^
>>"%PS_FILE%" echo     -KeyUsage CertSign, CRLSign, DigitalSignature ^^^
>>"%PS_FILE%" echo     -KeyLength 4096 -KeyAlgorithm RSA -HashAlgorithm SHA256 ^^^
>>"%PS_FILE%" echo     -KeyExportPolicy Exportable ^^^
>>"%PS_FILE%" echo     -NotAfter (Get-Date).AddYears(%ROOT_CA_YEARS%) ^^^
>>"%PS_FILE%" echo     -CertStoreLocation "Cert:\LocalMachine\My" ^^^
>>"%PS_FILE%" echo     -TextExtension @("2.5.29.19={text}CA=true^&pathlength=0")
>>"%PS_FILE%" echo Export-Certificate -Cert $rootCA -FilePath "$certDir\TaipowerDMS-RootCA.cer" ^| Out-Null
>>"%PS_FILE%" echo Import-Certificate -FilePath "$certDir\TaipowerDMS-RootCA.cer" -CertStoreLocation Cert:\LocalMachine\Root ^| Out-Null
>>"%PS_FILE%" echo Write-Host "    Root CA 完成，有效至 $($rootCA.NotAfter)" -ForegroundColor Green
>>"%PS_FILE%" echo.
>>"%PS_FILE%" echo Write-Host "[3] 簽發 2 年伺服器憑證..." -ForegroundColor Yellow
>>"%PS_FILE%" echo Get-ChildItem Cert:\LocalMachine\My ^| Where-Object { $_.Subject -eq "CN=$serverIp" } ^| Remove-Item -Force -ErrorAction SilentlyContinue
>>"%PS_FILE%" echo $serverCert = New-SelfSignedCertificate ^^^
>>"%PS_FILE%" echo     -Subject "CN=$serverIp" ^^^
>>"%PS_FILE%" echo     -DnsName $serverIp, "localhost" ^^^
>>"%PS_FILE%" echo     -Signer $rootCA -KeyLength 2048 -HashAlgorithm SHA256 ^^^
>>"%PS_FILE%" echo     -NotAfter (Get-Date).AddYears(%SERVER_CERT_YEARS%) ^^^
>>"%PS_FILE%" echo     -CertStoreLocation "Cert:\LocalMachine\My" ^^^
>>"%PS_FILE%" echo     -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1", "2.5.29.17={text}DNS=$serverIp^&IPAddress=$serverIp")
>>"%PS_FILE%" echo Write-Host "    伺服器憑證完成 ($($serverCert.Thumbprint))" -ForegroundColor Green
>>"%PS_FILE%" echo.
>>"%PS_FILE%" echo Write-Host "[4] 繫結至 IIS Port %FRONTEND_PORT% / %BACKEND_PORT%..." -ForegroundColor Yellow
>>"%PS_FILE%" echo Import-Module WebAdministration
>>"%PS_FILE%" echo foreach ($port in @(%FRONTEND_PORT%, %BACKEND_PORT%)) {
>>"%PS_FILE%" echo     $bindPath = "IIS:\SslBindings\0.0.0.0!$port"
>>"%PS_FILE%" echo     if (Test-Path $bindPath) { Remove-Item $bindPath -Force }
>>"%PS_FILE%" echo     Get-Item "Cert:\LocalMachine\My\$($serverCert.Thumbprint)" ^| New-Item $bindPath ^| Out-Null
>>"%PS_FILE%" echo     Write-Host "    Port $port 繫結完成" -ForegroundColor Green
>>"%PS_FILE%" echo }
>>"%PS_FILE%" echo.
>>"%PS_FILE%" echo Write-Host "[5] 註冊每週自動續簽排程..." -ForegroundColor Yellow
>>"%PS_FILE%" echo $renewScript = "$certDir\renew-cert.ps1"
>>"%PS_FILE%" echo Copy-Item -Path "$certDir\renew-cert.ps1" -Destination $renewScript -Force -ErrorAction SilentlyContinue
>>"%PS_FILE%" echo Unregister-ScheduledTask -TaskName "DMS-Cert-AutoRenew" -Confirm:$false -ErrorAction SilentlyContinue
>>"%PS_FILE%" echo $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File $renewScript"
>>"%PS_FILE%" echo $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am
>>"%PS_FILE%" echo $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
>>"%PS_FILE%" echo Register-ScheduledTask -TaskName "DMS-Cert-AutoRenew" -Action $action -Trigger $trigger -Principal $principal -Description "DMS 憑證自動續簽" ^| Out-Null
>>"%PS_FILE%" echo Write-Host "    排程完成（每週日 03:00 檢查）" -ForegroundColor Green
>>"%PS_FILE%" echo.
>>"%PS_FILE%" echo Write-Host "============================================================" -ForegroundColor Cyan
>>"%PS_FILE%" echo Write-Host "  ✓ 全部完成！" -ForegroundColor Green
>>"%PS_FILE%" echo Write-Host "  Root CA 檔案：$certDir\TaipowerDMS-RootCA.cer" -ForegroundColor Cyan
>>"%PS_FILE%" echo Write-Host "  請將此 .cer 上傳至 wwwroot\cert\ 供 Client 端下載" -ForegroundColor Cyan
>>"%PS_FILE%" echo Write-Host "============================================================" -ForegroundColor Cyan

echo            完成
echo.

echo [步驟 2/5] 建立自動續簽腳本...
> "%CERT_DIR%\renew-cert.ps1" echo $ErrorActionPreference = "Stop"
>>"%CERT_DIR%\renew-cert.ps1" echo $log = "%CERT_DIR%\renew.log"
>>"%CERT_DIR%\renew-cert.ps1" echo function Log($m) { Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $m" }
>>"%CERT_DIR%\renew-cert.ps1" echo try {
>>"%CERT_DIR%\renew-cert.ps1" echo     $cur = Get-ChildItem Cert:\LocalMachine\My ^| Where-Object { $_.Subject -eq "CN=%SERVER_IP%" } ^| Sort-Object NotAfter -Descending ^| Select-Object -First 1
>>"%CERT_DIR%\renew-cert.ps1" echo     if ($cur -and ($cur.NotAfter - (Get-Date)).Days -gt 30) { Log "仍有 $(($cur.NotAfter - (Get-Date)).Days) 天，無需續簽"; exit 0 }
>>"%CERT_DIR%\renew-cert.ps1" echo     $ca = Get-ChildItem Cert:\LocalMachine\My ^| Where-Object { $_.Subject -like "*%ROOT_CA_NAME%*" } ^| Select-Object -First 1
>>"%CERT_DIR%\renew-cert.ps1" echo     if (-not $ca) { throw "找不到 Root CA" }
>>"%CERT_DIR%\renew-cert.ps1" echo     $new = New-SelfSignedCertificate -Subject "CN=%SERVER_IP%" -DnsName "%SERVER_IP%","localhost" -Signer $ca -KeyLength 2048 -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(%SERVER_CERT_YEARS%) -CertStoreLocation "Cert:\LocalMachine\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1","2.5.29.17={text}DNS=%SERVER_IP%^&IPAddress=%SERVER_IP%")
>>"%CERT_DIR%\renew-cert.ps1" echo     Import-Module WebAdministration
>>"%CERT_DIR%\renew-cert.ps1" echo     foreach ($p in @(%FRONTEND_PORT%,%BACKEND_PORT%)) {
>>"%CERT_DIR%\renew-cert.ps1" echo         $bp = "IIS:\SslBindings\0.0.0.0!$p"; if (Test-Path $bp) { Remove-Item $bp -Force }
>>"%CERT_DIR%\renew-cert.ps1" echo         Get-Item "Cert:\LocalMachine\My\$($new.Thumbprint)" ^| New-Item $bp ^| Out-Null
>>"%CERT_DIR%\renew-cert.ps1" echo     }
>>"%CERT_DIR%\renew-cert.ps1" echo     if ($cur -and $cur.Thumbprint -ne $new.Thumbprint) { Remove-Item "Cert:\LocalMachine\My\$($cur.Thumbprint)" -Force }
>>"%CERT_DIR%\renew-cert.ps1" echo     Log "續簽完成，新憑證有效至 $($new.NotAfter)"
>>"%CERT_DIR%\renew-cert.ps1" echo } catch { Log "失敗：$($_.Exception.Message)"; exit 1 }
echo            完成
echo.

echo [步驟 3/5] 執行 PowerShell 主腳本...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_FILE%"
if %errorLevel% neq 0 (
    echo.
    echo [錯誤] 憑證製作失敗，請檢查上方訊息
    pause
    exit /b 1
)

echo.
echo [步驟 4/5] 複製 Root CA 至 Client 安裝目錄...
if exist "C:\inetpub\wwwroot\cert\" (
    copy /Y "%CERT_DIR%\TaipowerDMS-RootCA.cer" "C:\inetpub\wwwroot\cert\TaipowerDMS-RootCA.cer" >nul
    echo            已複製到 wwwroot\cert\，使用者可從網頁下載
) else (
    echo            （未偵測到 wwwroot\cert\，請手動將 .cer 複製過去）
)
echo.

echo [步驟 5/5] 完成。
echo ============================================================
echo   接下來請通知使用者：
echo     登入頁底部 → 點選「下載憑證」→ 取得 .cer 與 install-cert.bat
echo ============================================================
echo.
pause
