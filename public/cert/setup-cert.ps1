# ============================================================
#  桃園區處 DMS - 伺服器憑證製作 PowerShell 腳本
#  由 server-setup.bat 自動呼叫，請勿直接執行
# ============================================================
$ErrorActionPreference = "Stop"

# === 參數設定（如需修改 IP 或埠號請改這裡） ===
$ServerIp        = "10.205.3.52"
$CertDir         = "C:\DMS-Cert"
$FrontendCertDir = "D:\TaoyuanDMS-Frontend\cert"
$RootCaName      = "DMS Root CA"
$RootCaYears     = 20
$ServerCertYears = 2
$FrontendPort    = 7443
$BackendPort     = 8443

# 來源目錄（BAT 所在資料夾，用於複製 install-cert.bat / README.txt）
$SourceDir = $PSScriptRoot
if (-not $SourceDir) { $SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

if (-not (Test-Path $CertDir)) { New-Item -Path $CertDir -ItemType Directory -Force | Out-Null }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  桃園區處 DMS 伺服器憑證製作中..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- [1] 移除舊的 Root CA ---
Write-Host "[1/5] 移除舊的 Root CA..." -ForegroundColor Yellow
Get-ChildItem Cert:\LocalMachine\My   | Where-Object { $_.Subject -like "*$RootCaName*" } | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*$RootCaName*" } | Remove-Item -Force -ErrorAction SilentlyContinue
Write-Host "      完成" -ForegroundColor Green

# --- [2] 建立 Root CA ---
Write-Host "[2/5] 建立 Root CA（$RootCaYears 年）..." -ForegroundColor Yellow
$rootCA = New-SelfSignedCertificate `
    -Subject "CN=$RootCaName, O=Taipower Taoyuan, C=TW" `
    -KeyUsage CertSign,CRLSign,DigitalSignature `
    -KeyLength 4096 -KeyAlgorithm RSA -HashAlgorithm SHA256 `
    -KeyExportPolicy Exportable `
    -NotAfter (Get-Date).AddYears($RootCaYears) `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -TextExtension @("2.5.29.19={text}CA=true&pathlength=0")

Export-Certificate -Cert $rootCA -FilePath "$CertDir\TaipowerDMS-RootCA.cer" | Out-Null
Import-Certificate  -FilePath "$CertDir\TaipowerDMS-RootCA.cer" -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
Write-Host "      Root CA 完成，有效至 $($rootCA.NotAfter)" -ForegroundColor Green

# --- [3] 簽發伺服器憑證 ---
Write-Host "[3/5] 簽發伺服器憑證（$ServerCertYears 年，CN=$ServerIp）..." -ForegroundColor Yellow
Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Subject -eq "CN=$ServerIp" } | Remove-Item -Force -ErrorAction SilentlyContinue

$serverCert = New-SelfSignedCertificate `
    -Subject "CN=$ServerIp" `
    -DnsName $ServerIp,"localhost" `
    -Signer $rootCA -KeyLength 2048 -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears($ServerCertYears) `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1","2.5.29.17={text}DNS=$ServerIp&IPAddress=$ServerIp")

Write-Host "      伺服器憑證完成 (Thumbprint: $($serverCert.Thumbprint))" -ForegroundColor Green

# --- [4] IIS 繫結 ---
Write-Host "[4/5] 繫結至 IIS Port $FrontendPort / $BackendPort..." -ForegroundColor Yellow
Import-Module WebAdministration
foreach ($port in @($FrontendPort, $BackendPort)) {
    $bindPath = "IIS:\SslBindings\0.0.0.0!$port"
    if (Test-Path $bindPath) { Remove-Item $bindPath -Force }
    Get-Item "Cert:\LocalMachine\My\$($serverCert.Thumbprint)" | New-Item $bindPath | Out-Null
    Write-Host "      Port $port 繫結完成" -ForegroundColor Green
}

# --- [5] 註冊每週自動續簽排程 ---
Write-Host "[5/5] 註冊每週自動續簽排程..." -ForegroundColor Yellow
$renewScript = "$CertDir\renew-cert.ps1"

# 將續簽腳本寫入 CertDir
$renewContent = @"
`$ErrorActionPreference = "Stop"
`$log = "$CertDir\renew.log"
function Log(`$m) { Add-Content `$log "[`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] `$m" }
try {
    `$cur = Get-ChildItem Cert:\LocalMachine\My | Where-Object { `$_.Subject -eq "CN=$ServerIp" } | Sort-Object NotAfter -Descending | Select-Object -First 1
    if (`$cur -and (`$cur.NotAfter - (Get-Date)).Days -gt 30) { Log "仍有 `$((`$cur.NotAfter - (Get-Date)).Days) 天，無需續簽"; exit 0 }
    `$ca = Get-ChildItem Cert:\LocalMachine\My | Where-Object { `$_.Subject -like "*$RootCaName*" } | Select-Object -First 1
    if (-not `$ca) { throw "找不到 Root CA" }
    `$new = New-SelfSignedCertificate -Subject "CN=$ServerIp" -DnsName "$ServerIp","localhost" -Signer `$ca -KeyLength 2048 -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears($ServerCertYears) -CertStoreLocation "Cert:\LocalMachine\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1","2.5.29.17={text}DNS=$ServerIp&IPAddress=$ServerIp")
    Import-Module WebAdministration
    foreach (`$p in @($FrontendPort,$BackendPort)) {
        `$bp = "IIS:\SslBindings\0.0.0.0!`$p"
        if (Test-Path `$bp) { Remove-Item `$bp -Force }
        Get-Item "Cert:\LocalMachine\My\`$(`$new.Thumbprint)" | New-Item `$bp | Out-Null
    }
    if (`$cur -and `$cur.Thumbprint -ne `$new.Thumbprint) { Remove-Item "Cert:\LocalMachine\My\`$(`$cur.Thumbprint)" -Force }
    Log "續簽完成，新憑證有效至 `$(`$new.NotAfter)"
} catch { Log "失敗：`$(`$_.Exception.Message)"; exit 1 }
"@
Set-Content -Path $renewScript -Value $renewContent -Encoding UTF8

Unregister-ScheduledTask -TaskName "DMS-Cert-AutoRenew" -Confirm:$false -ErrorAction SilentlyContinue
$action    = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$renewScript`""
$trigger   = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3am
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
Register-ScheduledTask -TaskName "DMS-Cert-AutoRenew" -Action $action -Trigger $trigger -Principal $principal -Description "DMS 憑證自動續簽" | Out-Null
Write-Host "      排程完成（每週日 03:00 檢查）" -ForegroundColor Green

# --- 複製到前端站台供 Client 下載 ---
Write-Host ""
Write-Host "[後置] 複製 Root CA 至前端站台 cert\ 目錄..." -ForegroundColor Yellow
if (-not (Test-Path $FrontendCertDir)) { New-Item -Path $FrontendCertDir -ItemType Directory -Force | Out-Null }
Copy-Item -Path "$CertDir\TaipowerDMS-RootCA.cer" -Destination "$FrontendCertDir\TaipowerDMS-RootCA.cer" -Force

if (Test-Path "$SourceDir\install-cert.bat") {
    Copy-Item -Path "$SourceDir\install-cert.bat" -Destination "$FrontendCertDir\install-cert.bat" -Force
}
if (Test-Path "$SourceDir\README.txt") {
    Copy-Item -Path "$SourceDir\README.txt" -Destination "$FrontendCertDir\README.txt" -Force
}
Write-Host "      已複製到 $FrontendCertDir" -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  全部完成！" -ForegroundColor Green
Write-Host "  Root CA 檔案：$CertDir\TaipowerDMS-RootCA.cer" -ForegroundColor Cyan
Write-Host "  使用者下載目錄：$FrontendCertDir" -ForegroundColor Cyan
Write-Host "  請通知使用者：登入頁底部 → 點選「下載憑證」" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
