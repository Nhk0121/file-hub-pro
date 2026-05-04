# OnlyOffice 獨立 VM 部署指南（方式 B：雙 VM 隔離通道架構）

> **目標**：在一台實體主機上以 Hyper-V 建立**兩台虛擬機器**——
> - **DMS-VM**（Windows Server）：執行 IIS + .NET 8 API + React 前端
> - **OnlyOffice-VM**（Ubuntu Desktop）：執行 OnlyOffice Document Server
>
> 兩台 VM 透過 Hyper-V「內部虛擬交換器」建立專屬通道，OnlyOffice-VM **完全無對外網路**，確保資安合規。

---

## 📐 一、整體架構（實體機 / 虛擬機分層）

```text
╔══════════════════════════════════════════════════════════════════════╗
║  實體主機 (Physical Host) — Windows Server 2022 + Hyper-V 角色       ║
║  ────────────────────────────────────────────────────────────────    ║
║  職責：只負責提供 Hyper-V 虛擬化平台，不部署任何業務服務             ║
║  網卡：1 張實體網卡，連接公司 LAN（給 DMS-VM 對外用）                ║
║                                                                      ║
║  ┌────────────────────────────┐    ┌────────────────────────────┐    ║
║  │ VM 1: DMS-VM               │    │ VM 2: OnlyOffice-VM        │    ║
║  │ Windows Server 2022        │    │ Ubuntu 22.04 LTS Desktop   │    ║
║  │ ─────────────────────      │    │ ─────────────────────      │    ║
║  │ • IIS 站台                 │    │ • Docker                   │    ║
║  │ • TaoyuanDMS-Frontend      │◄──►│ • OnlyOffice DocumentSrv   │    ║
║  │ • TaoyuanDMS-API (.NET 8)  │    │   Port 80（內部）          │    ║
║  │ • MSSQL                    │    │                            │    ║
║  │                            │    │ 【網卡】                   │    ║
║  │ 【網卡】2 張                │    │ NIC 1：vSwitch-DMS         │    ║
║  │ NIC 1：External Switch     │    │   IP: 192.168.50.10        │    ║
║  │   IP: 公司 LAN（對外）     │    │   ⚠️ 無對外、無 Gateway     │    ║
║  │ NIC 2：vSwitch-DMS         │    │                            │    ║
║  │   IP: 192.168.50.1（對內） │    │                            │    ║
║  └────────────┬───────────────┘    └────────────┬───────────────┘    ║
║               │                                 │                    ║
║               └────────── vSwitch-DMS ──────────┘                    ║
║                  Hyper-V Internal Switch                             ║
║                  192.168.50.0/24（無對外路由）                       ║
║                                                                      ║
║  External Switch（橋接實體網卡）── 僅供 DMS-VM 對外連線              ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 隔離設計重點
| 層級 | 網卡數 | 對外? | 對 vSwitch-DMS? |
|------|--------|-------|-----------------|
| **實體主機** | 1 張實體 | ✅ | ❌（不參與 192.168.50.x 網段） |
| **DMS-VM** | 2 張虛擬 | ✅ NIC 1 | ✅ NIC 2 (IP `192.168.50.1`) |
| **OnlyOffice-VM** | 1 張虛擬 | ❌ | ✅ 唯一網卡 (IP `192.168.50.10`) |

> **為何實體主機不需要 192.168.50.1？**
> 將內部網段的閘道角色交給 **DMS-VM** 承擔，實體主機只純粹做虛擬化平台。
> 好處：未來搬機房只需搬 VHDX 檔案，實體主機可直接更換。

---

## 🖥️ 二、實體主機準備（Hyper-V 平台）

### 2-1. 啟用 Hyper-V 角色

在實體主機 PowerShell（系統管理員）：

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
```

執行後**重新開機**。

### 2-2. 下載 ISO 映像

| VM | ISO | 路徑 |
|----|-----|------|
| DMS-VM | Windows Server 2022 ISO（已有授權版本） | `D:\ISO\WindowsServer2022.iso` |
| OnlyOffice-VM | Ubuntu 22.04.4 LTS **Desktop**（圖形介面版） | `D:\ISO\ubuntu-22.04.4-desktop-amd64.iso` |

Ubuntu 下載：https://releases.ubuntu.com/22.04/

### 2-3. 建立兩個虛擬交換器

在實體主機 Hyper-V Manager → 右側「**Virtual Switch Manager**」：

#### 交換器 A：External Switch（對外）
- Name: `vSwitch-External`
- Type: **External**
- 綁定：實體網卡（連公司 LAN 那張）
- 用途：只給 DMS-VM 的 NIC 1

#### 交換器 B：vSwitch-DMS（內部隔離）
- Name: `vSwitch-DMS`
- Type: **Internal**
- 不綁定任何實體網卡
- 用途：DMS-VM ↔ OnlyOffice-VM 專屬通道

> ⚠️ **不要**在實體主機上幫 `vEthernet (vSwitch-DMS)` 設定 IP。
> 如果系統自動配，可手動移除：
> ```powershell
> $if = (Get-NetAdapter -Name "vEthernet (vSwitch-DMS)").ifIndex
> Get-NetIPAddress -InterfaceIndex $if | Remove-NetIPAddress -Confirm:$false
> ```

---

## 💻 三、建立 DMS-VM（Windows Server，雙網卡）

### 3-1. 新增虛擬機器

Hyper-V Manager → 新增 → 虛擬機器：

| 項目 | 設定值 |
|------|--------|
| 名稱 | `DMS-VM` |
| 世代 | 第二代 |
| 記憶體 | 16384 MB（依負載調整） |
| 網路 | 先選 **vSwitch-External**（NIC 1） |
| 虛擬硬碟 | 200 GB+ |
| ISO | Windows Server 2022 |

### 3-2. 加掛第二張網卡（對內 vSwitch-DMS）

VM 建立後**先別開機**，右鍵 →「Settings」→「Add Hardware」→「Network Adapter」：

- 將新網卡的 Virtual switch 選 **vSwitch-DMS**
- 套用後 DMS-VM 就有兩張虛擬網卡

### 3-3. 啟動 VM 並安裝 Windows Server

完成 Windows Server 安裝、加入網域、Windows Update 等常規設定。

### 3-4. 在 DMS-VM 內設定兩張網卡的 IP

進入 DMS-VM，PowerShell（系統管理員）：

```powershell
# 列出兩張網卡，確認名稱
Get-NetAdapter
# 通常會看到 Ethernet（對應 NIC 1）與 Ethernet 2（對應 NIC 2）
```

**NIC 1（對外）**：依公司網管設定（DHCP 或固定 IP），確認可上網。

**NIC 2（對內 vSwitch-DMS）**：

```powershell
# 將 Ethernet 2 設為 192.168.50.1（沒有 Gateway、沒有 DNS）
New-NetIPAddress -InterfaceAlias "Ethernet 2" `
  -IPAddress 192.168.50.1 -PrefixLength 24

# 將此網卡設為「私人網路」設定檔，避免被防火牆當作公用網路阻擋
Set-NetConnectionProfile -InterfaceAlias "Ethernet 2" -NetworkCategory Private
```

### 3-5. DMS-VM 防火牆規則

```powershell
# 允許主動連線到 OnlyOffice-VM (Port 80)
New-NetFirewallRule -DisplayName "DMS-to-OnlyOffice" `
  -Direction Outbound -Action Allow `
  -RemoteAddress 192.168.50.10 -Protocol TCP -RemotePort 80 -Profile Private

# 允許 OnlyOffice 回呼 IIS (Port 8443)
New-NetFirewallRule -DisplayName "OnlyOffice-Callback-to-DMS" `
  -Direction Inbound -Action Allow `
  -RemoteAddress 192.168.50.10 -Protocol TCP -LocalPort 8443 -Profile Private

# 雙重保險：阻擋 OnlyOffice-VM 任何對外嘗試（從 DMS-VM 端封鎖轉發）
New-NetFirewallRule -DisplayName "Block-OnlyOffice-Forwarding" `
  -Direction Inbound -Action Block `
  -RemoteAddress 192.168.50.10 -Profile Private `
  -LocalPort Any -Protocol Any
# （上面這條只擋未明確允許的，前兩條 Allow 仍生效）
```

> ⚠️ **不要**在 DMS-VM 啟用「IP Routing / RRAS」，否則會把 OnlyOffice-VM 的流量轉發到對外網卡，破壞隔離。

---

## 🐧 四、建立 OnlyOffice-VM（Ubuntu Desktop，單網卡）

### 4-1. 新增虛擬機器

Hyper-V Manager → 新增 → 虛擬機器：

| 項目 | 設定值 |
|------|--------|
| 名稱 | `OnlyOffice-VM` |
| 世代 | **第二代** |
| 記憶體 | **8192 MB**（不勾選動態記憶體） |
| 網路 | **vSwitch-DMS**（唯一一張，**不要**加第二張） |
| 虛擬硬碟 | 40 GB，路徑 `D:\Hyper-V\OnlyOffice-VM\disk.vhdx` |
| ISO | `D:\ISO\ubuntu-22.04.4-desktop-amd64.iso` |

**建立後先別啟動**，右鍵 →「Settings」：
1. **Security** → 取消勾選「**Enable Secure Boot**」（Ubuntu 第二代必要）
2. **Processor** → 4 vCPU
3. **Checkpoints** → 取消勾選「Enable checkpoints」

### 4-2. 安裝 Ubuntu Desktop

> ⚠️ **重要**：由於 OnlyOffice-VM 連的是 Internal Switch，**安裝期間沒有對外網路**。
> 解法二選一：
> - **(A) 暫時切換**：安裝期間先把網卡改接到 `vSwitch-External`，安裝完再改回 `vSwitch-DMS`
> - **(B) 完全離線安裝**：使用 Ubuntu 完整 ISO，跳過下載更新；之後（步驟 4-4）再臨時切換更新

**推薦 (A)**。安裝步驟：

1. 啟動 → 從 ISO 開機 → 選「Install Ubuntu」
2. ✅ Normal installation + Download updates while installing
3. Erase disk and install Ubuntu
4. 帳號：
   - 電腦名稱：`onlyoffice-vm`
   - 使用者：`dmsadmin`
   - 強密碼

安裝完成後**重新開機**並登入。

### 4-3. 系統更新與 Docker 安裝（仍對外）

開啟 Terminal（Ctrl+Alt+T）：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget gnupg2 ca-certificates net-tools openssh-server ufw

# 安裝 Docker
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
sudo systemctl enable --now docker
```

**登出再登入**讓群組權限生效。

### 4-4. 切回隔離網段

**關閉 OnlyOffice-VM** → Hyper-V Manager → Settings → Network Adapter → 改回 **vSwitch-DMS** → 啟動。

進入 Ubuntu 桌面右上角 Settings → Network → 齒輪 → IPv4：

| 項目 | 值 |
|------|----|
| Method | Manual |
| Address | `192.168.50.10` |
| Netmask | `255.255.255.0` |
| Gateway | **留空** |
| DNS | **留空**（關閉 Automatic） |

Apply → 重新連線。

### 4-5. 啟動 OnlyOffice Document Server

```bash
sudo mkdir -p /opt/onlyoffice/{data,logs,db}

JWT_SECRET="請替換成隨機32字元以上密鑰例如abc123XYZ789..."

docker run -d --name onlyoffice \
  --restart=always \
  -p 80:80 \
  -e JWT_ENABLED=true \
  -e JWT_SECRET="$JWT_SECRET" \
  -e JWT_HEADER=Authorization \
  -v /opt/onlyoffice/data:/var/www/onlyoffice/Data \
  -v /opt/onlyoffice/logs:/var/log/onlyoffice \
  -v /opt/onlyoffice/db:/var/lib/postgresql \
  onlyoffice/documentserver:latest
```

> 📌 **JWT_SECRET 請妥善保存**，要寫入 DMS-VM 的 `appsettings.json`。

### 4-6. UFW 防火牆（在 OnlyOffice-VM 內）

```bash
sudo ufw default deny incoming
sudo ufw default deny outgoing

sudo ufw allow in on lo
sudo ufw allow out on lo

# 僅允許來自 DMS-VM (192.168.50.1) 的入站流量
sudo ufw allow from 192.168.50.1 to any port 80 proto tcp
sudo ufw allow from 192.168.50.1 to any port 22 proto tcp  # SSH 維護用

# 允許 OnlyOffice 回呼 DMS-VM (Port 8443)
sudo ufw allow out to 192.168.50.1 port 8443 proto tcp

sudo ufw enable
sudo ufw status verbose
```

---

## ✅ 五、隔離驗證清單

完成上述步驟後，逐項確認：

| # | 在哪執行 | 指令 | 預期結果 |
|---|---------|------|---------|
| 1 | DMS-VM | `Get-NetAdapter` | 看到 2 張 Up 狀態網卡 |
| 2 | DMS-VM | `ping 8.8.8.8` | ✅ 成功（NIC 1 對外） |
| 3 | DMS-VM | `ping 192.168.50.10` | ✅ 成功（NIC 2 對內） |
| 4 | OnlyOffice-VM | `ping -c 2 8.8.8.8` | ❌ 失敗（無對外正確）|
| 5 | OnlyOffice-VM | `curl -m 5 https://google.com` | ❌ 失敗（無對外正確）|
| 6 | OnlyOffice-VM | `ping -c 2 192.168.50.1` | ✅ 成功 |
| 7 | OnlyOffice-VM | `curl http://localhost/` | ✅ Document Server is running |
| 8 | DMS-VM 瀏覽器 | `http://192.168.50.10/` | ✅ OnlyOffice 歡迎頁 |
| 9 | 外部使用者 | `https://公司IP:8443/` | ✅ DMS 網站正常 |
| 10 | 外部使用者 | `http://公司IP/` 或 `192.168.50.10` | ❌ 無法存取（正確） |

---

## 🔌 六、與桃園區處文件管理系統整合

### 6-1. DMS-VM 後端 `appsettings.json`

```json
{
  "OnlyOffice": {
    "DocumentServerUrl": "http://192.168.50.10",
    "JwtSecret": "與 OnlyOffice-VM 上設定相同的 JWT_SECRET",
    "JwtHeader": "Authorization",
    "CallbackBaseUrl": "https://192.168.50.1:8443"
  }
}
```

### 6-2. IIS 反向代理（前端 iframe 載入用）

由於使用者瀏覽器**無法直接存取** `192.168.50.10`，需在 DMS-VM 的 IIS 安裝
**URL Rewrite + Application Request Routing (ARR)** 模組，並在
`D:\inetpub\TaoyuanDMS-API\web.config` 增加：

```xml
<rule name="OnlyOfficeProxy" stopProcessing="true">
  <match url="^onlyoffice/(.*)" />
  <action type="Rewrite" url="http://192.168.50.10/{R:1}" />
</rule>
```

使用者瀏覽器存取 `https://公司IP:8443/onlyoffice/web-apps/apps/api/documents/api.js`
→ IIS 自動轉發到 OnlyOffice-VM。

---

## 🛡️ 七、資安檢核表

| # | 項目 | 設定點 | 狀態 |
|---|------|------|------|
| 1 | OnlyOffice-VM 僅 1 張網卡 | Hyper-V 設定 | ✅ |
| 2 | OnlyOffice-VM 無 Gateway/DNS | Ubuntu 網路設定 | ✅ |
| 3 | UFW 預設 deny 所有 | OnlyOffice-VM | ✅ |
| 4 | 僅允許 192.168.50.1 入站 | UFW 規則 | ✅ |
| 5 | OnlyOffice JWT 啟用 | docker run -e | ✅ |
| 6 | DMS-VM 未啟用 IP Routing | DMS-VM | ✅ |
| 7 | 實體主機不參與 192.168.50.x | 實體主機 | ✅ |
| 8 | Docker 容器自動重啟 | `--restart=always` | ✅ |

---

## 🔧 八、日後維護

### 更新 OnlyOffice（需暫時開放網路）

1. **關閉 OnlyOffice-VM** → Hyper-V 設定 → 網路改為 `vSwitch-External`
2. 開機後設定臨時 Gateway/DNS
3. 執行更新：
   ```bash
   docker pull onlyoffice/documentserver:latest
   docker stop onlyoffice && docker rm onlyoffice
   # 重新執行 4-5 的 docker run 指令（資料保留在 /opt/onlyoffice）
   ```
4. **關機 → 網路改回 `vSwitch-DMS` → 清空 Gateway/DNS**

### 備份

```bash
# 在 OnlyOffice-VM 上每週備份
sudo tar -czf /opt/backup/onlyoffice-$(date +%F).tar.gz /opt/onlyoffice
# 透過 scp 傳到 DMS-VM
scp /opt/backup/onlyoffice-*.tar.gz dmsadmin@192.168.50.1:/d/Backup/
```

實體主機端建議定期匯出 VM：
```powershell
Export-VM -Name "OnlyOffice-VM" -Path "D:\Hyper-V-Backup\"
Export-VM -Name "DMS-VM" -Path "D:\Hyper-V-Backup\"
```

---

## ❓ 常見問題

| 問題 | 解法 |
|------|------|
| Hyper-V 找不到「第二代」選項 | 確認 Windows Server 為 2016 以上 |
| Ubuntu 安裝後黑畫面 | 取消「啟用安全開機」 |
| OnlyOffice-VM 無法 ping 到 DMS-VM | 檢查 DMS-VM「Ethernet 2」NetworkCategory 是否為 Private |
| DMS-VM 無法 ping 到 OnlyOffice-VM | UFW 是否擋掉 ICMP？可加 `sudo ufw allow from 192.168.50.1 proto icmp` |
| IIS 反向代理 502 | 確認已安裝 URL Rewrite + ARR，並在 ARR 中啟用 Proxy |
| OnlyOffice 顯示 "Token is invalid" | JWT_SECRET 兩端不一致 |
| 實體主機被入侵會怎樣？ | 攻擊者可接觸 VHDX 檔案；建議實體主機亦做磁碟加密與最小化服務 |

---

**下一步**：完成雙 VM 建置與隔離驗證後，再進入 .NET 後端 OnlyOffice Controller
與前端 iframe 整合的程式碼實作階段。
