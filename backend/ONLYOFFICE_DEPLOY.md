# OnlyOffice 獨立 Linux VM 部署指南（方式 B：隔離通道架構）

> **目標**：在 Windows Server 上以 Hyper-V 建立一台獨立的 Linux 虛擬機器執行 OnlyOffice Document Server，並透過內部專用虛擬網路與桃園區處文件管理系統（IIS .NET 8 API）連通，**完全隔絕外部網路存取**，確保資安合規。

---

## 📐 一、整體架構圖

```text
┌──────────────────────────────────────────────────────────────────┐
│                  Windows Server 2022 (實體主機)                  │
│                                                                  │
│  ┌───────────────────────────┐      ┌──────────────────────────┐ │
│  │  IIS 站台 (現有)          │      │  Hyper-V Linux VM        │ │
│  │  ─────────────────────    │      │  ────────────────────    │ │
│  │  TaoyuanDMS-Frontend      │      │  Ubuntu 22.04 LTS Desktop│ │
│  │  TaoyuanDMS-API (.NET 8)  │◄────►│  OnlyOffice DocumentSrv  │ │
│  │  Port 7443 / 8443         │      │  Port 80 (內部)          │ │
│  │  IP: 192.168.50.1         │      │  IP: 192.168.50.10       │ │
│  └────────────┬──────────────┘      └────────────┬─────────────┘ │
│               │                                  │               │
│               └──────────┬───────────────────────┘               │
│                          ▼                                       │
│            Hyper-V「Internal Switch」（vSwitch-DMS）             │
│            專用 192.168.50.0/24 虛擬網段（無對外路由）           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  對外網卡 (Public NIC) ── 僅 IIS Port 7443/8443 開放      │  │
│  │  Linux VM 完全不綁定此網卡 → 無法被外部直接存取           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**隔離設計重點**：
- Linux VM **只有一張**虛擬網卡，連接到 Hyper-V「內部交換器」
- 內部交換器**不橋接**任何實體網卡 → 外部網路無法 ping 到 VM
- Windows Server 主機本身擁有兩張網卡：對外（公司 LAN）+ 對內（虛擬交換器）
- 僅 IIS 主機可透過 192.168.50.10 存取 OnlyOffice

---

## 🖥️ 二、建立 Hyper-V Linux 虛擬機器（含圖形介面）

### 2-1. 啟用 Hyper-V 角色

以系統管理員身分開啟 PowerShell：

```powershell
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All
```

執行後**重新開機**。

### 2-2. 下載 Ubuntu Desktop ISO

- 版本：**Ubuntu 22.04.4 LTS Desktop**（圖形介面版，非 Server）
- 下載點：https://releases.ubuntu.com/22.04/
- 檔案：`ubuntu-22.04.4-desktop-amd64.iso`（約 4.7 GB）
- 將 ISO 放到 `D:\ISO\ubuntu-22.04.4-desktop-amd64.iso`

### 2-3. 建立內部虛擬交換器（隔離網段）

開 PowerShell（系統管理員）：

```powershell
# 建立「內部」交換器，不綁定實體網卡
New-VMSwitch -Name "vSwitch-DMS" -SwitchType Internal

# 設定 Windows 主機端在此網段的 IP
$ifIndex = (Get-NetAdapter -Name "vEthernet (vSwitch-DMS)").ifIndex
New-NetIPAddress -IPAddress 192.168.50.1 -PrefixLength 24 -InterfaceIndex $ifIndex
```

> ✅ 建立完成後，Windows 主機會多一張虛擬網卡 `vEthernet (vSwitch-DMS)`，IP 為 `192.168.50.1`。
> ❌ 此交換器**沒有 NAT、沒有橋接**，外部無法進入。

### 2-4. 建立虛擬機器

開啟「Hyper-V 管理員」→ 右側「新增」→「虛擬機器」：

| 項目 | 設定值 |
|------|--------|
| 名稱 | `OnlyOffice-VM` |
| 儲存位置 | `D:\Hyper-V\OnlyOffice-VM` |
| 世代 | **第二代** |
| 記憶體 | **8192 MB**（不勾選動態記憶體） |
| 網路 | 連線到 **vSwitch-DMS** |
| 虛擬硬碟 | 新增，**40 GB**，路徑 `D:\Hyper-V\OnlyOffice-VM\disk.vhdx` |
| 安裝選項 | 從可開機映像檔安裝 → 選 `D:\ISO\ubuntu-22.04.4-desktop-amd64.iso` |

**建立後，先別啟動**，右鍵 →「設定」：

1. **安全性** → 取消勾選「**啟用安全開機**」（Ubuntu 第二代 VM 必要）
2. **處理器** → 虛擬處理器數量改為 **4**
3. **檢查點** → 取消勾選「**啟用檢查點**」（避免效能損耗）

完成後啟動 VM。

### 2-5. 安裝 Ubuntu Desktop（圖形介面）

1. 啟動後從 ISO 開機 → 選「**Install Ubuntu**」
2. 鍵盤：Chinese / English（依需求）
3. 更新與其他軟體：
   - ✅ **Normal installation**（含圖形介面與常用工具）
   - ✅ **Download updates while installing**（**最後一次**讓它連網下載）
4. 安裝類型：**Erase disk and install Ubuntu**
5. 帳號設定：
   - 您的姓名：`dmsadmin`
   - 電腦名稱：`onlyoffice-vm`
   - 使用者名稱：`dmsadmin`
   - 密碼：請設定強密碼並記錄
   - ✅ **Require my password to log in**
6. 安裝完成後**重新開機**並登入。

---

## 🌐 三、Linux VM 初次設定（仍開放網路）

### 3-1. 設定固定 IP（圖形介面）

桌面右上角網路圖示 → Settings → Network → 齒輪圖示 → IPv4：

| 項目 | 值 |
|------|----|
| Method | Manual |
| Address | `192.168.50.10` |
| Netmask | `255.255.255.0` |
| Gateway | `192.168.50.1` |
| DNS | `8.8.8.8, 1.1.1.1`（**僅安裝期間使用，之後移除**） |

點「Apply」→ 關閉再開啟網路連線。

### 3-2. 系統更新

開啟「Terminal」（Ctrl+Alt+T）：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget gnupg2 ca-certificates net-tools openssh-server ufw
```

### 3-3. 安裝 Docker（OnlyOffice 官方建議方式）

```bash
# 安裝 Docker
curl -fsSL https://get.docker.com | sudo bash

# 將目前使用者加入 docker 群組
sudo usermod -aG docker $USER

# 啟動 Docker 並設為開機自啟
sudo systemctl enable --now docker
```

**登出再登入**讓群組權限生效。

### 3-4. 拉取並啟動 OnlyOffice Document Server

```bash
# 建立持久化目錄
sudo mkdir -p /opt/onlyoffice/{data,logs,db}

# 設定 JWT 密鑰（必填，請替換成 32 字元以上強隨機字串）
JWT_SECRET="請替換成隨機32字元以上密鑰例如abc123XYZ789..."

# 啟動容器
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

> 📌 **JWT_SECRET 請妥善保存**，等一下要寫入 .NET 後端 `appsettings.json`。

### 3-5. 驗證 OnlyOffice 啟動

```bash
# 等待約 2 分鐘讓服務啟動完成
docker logs -f onlyoffice
```

看到 `==> default: nginx is running` 後按 Ctrl+C 離開。

開啟 Linux VM 瀏覽器，輸入 `http://localhost/`，應看到「Document Server is running」歡迎頁。

---

## 🔒 四、停用對外網路（隔離通道建立）

> ⚠️ **完成 OnlyOffice 安裝與測試後**才執行此步驟。日後如需更新，可暫時還原 DNS 或使用離線映像檔。

### 4-1. 移除外部 DNS

桌面右上角 Settings → Network → 齒輪 → IPv4：

- **Gateway**：清空（保留 IP 與 Netmask）
- **DNS**：清空，關閉 Automatic
- 點 Apply → 重新連線

### 4-2. 設定 UFW 防火牆（僅允許 IIS 主機進入）

```bash
# 預設拒絕所有
sudo ufw default deny incoming
sudo ufw default deny outgoing

# 允許 loopback
sudo ufw allow in on lo
sudo ufw allow out on lo

# 僅允許來自 Windows 主機 (192.168.50.1) 的入站流量
sudo ufw allow from 192.168.50.1 to any port 80 proto tcp
sudo ufw allow from 192.168.50.1 to any port 22 proto tcp  # SSH 維護用

# 允許 OnlyOffice 回呼 IIS（Port 8443）
sudo ufw allow out to 192.168.50.1 port 8443 proto tcp

# 啟用防火牆
sudo ufw enable
sudo ufw status verbose
```

### 4-3. 驗證隔離

在 Linux VM Terminal 執行：

```bash
# 應該失敗（無法連網）
ping -c 2 8.8.8.8
curl -m 5 https://google.com

# 應該成功（內部通道）
ping -c 2 192.168.50.1
curl -m 5 https://192.168.50.1:8443/api/health -k
```

### 4-4. Windows Server 防火牆規則

在 Windows Server PowerShell（系統管理員）執行：

```powershell
# 允許 IIS 主機主動連線到 OnlyOffice VM (Port 80)
New-NetFirewallRule -DisplayName "DMS-to-OnlyOffice" `
  -Direction Outbound -Action Allow `
  -RemoteAddress 192.168.50.10 -Protocol TCP -RemotePort 80

# 允許 OnlyOffice VM 回呼 IIS (Port 8443)
New-NetFirewallRule -DisplayName "OnlyOffice-Callback-to-DMS" `
  -Direction Inbound -Action Allow `
  -RemoteAddress 192.168.50.10 -Protocol TCP -LocalPort 8443

# 阻擋 OnlyOffice VM 對外（雙重保險）
New-NetFirewallRule -DisplayName "Block-OnlyOffice-External" `
  -Direction Outbound -Action Block `
  -RemoteAddress 192.168.50.10
```

---

## 🔌 五、與桃園區處文件管理系統整合（後續實作參考）

### 5-1. 後端 appsettings.json 新增區塊

```json
{
  "OnlyOffice": {
    "DocumentServerUrl": "http://192.168.50.10",
    "JwtSecret": "與 Linux VM 上設定相同的 JWT_SECRET",
    "JwtHeader": "Authorization",
    "CallbackBaseUrl": "https://192.168.50.1:8443"
  }
}
```

### 5-2. 前端載入 OnlyOffice API

由於使用者瀏覽器**無法直接存取** 192.168.50.10，需透過 IIS 反向代理：

在 `D:\inetpub\TaoyuanDMS-API\web.config` 增加 Rewrite 規則（需安裝 URL Rewrite + ARR 模組）：

```xml
<rule name="OnlyOfficeProxy" stopProcessing="true">
  <match url="^onlyoffice/(.*)" />
  <action type="Rewrite" url="http://192.168.50.10/{R:1}" />
</rule>
```

使用者瀏覽器存取 `https://MYSERVER:8443/onlyoffice/web-apps/apps/api/documents/api.js` → IIS 自動轉發到 Linux VM。

---

## 🛡️ 六、資安檢核表

| # | 項目 | 設定 | 狀態 |
|---|------|------|------|
| 1 | Linux VM 無對外網卡 | Hyper-V Internal Switch | ✅ |
| 2 | UFW 預設拒絕所有流量 | `ufw default deny` | ✅ |
| 3 | 僅允許 IIS 主機 IP | `from 192.168.50.1` | ✅ |
| 4 | OnlyOffice JWT 啟用 | `JWT_ENABLED=true` | ✅ |
| 5 | Windows 防火牆阻擋 VM 對外 | Outbound Block Rule | ✅ |
| 6 | DNS 已清空 | Network Settings | ✅ |
| 7 | SSH 強密碼 / 金鑰 | passwd / authorized_keys | ✅ |
| 8 | Docker 容器自動重啟 | `--restart=always` | ✅ |

---

## 🔧 七、日後維護

### 更新 OnlyOffice（需暫時開放網路）

```bash
# 1. 暫時加回 DNS 與 Gateway（圖形介面）
# 2. 拉取新映像
docker pull onlyoffice/documentserver:latest

# 3. 停止舊容器並重建
docker stop onlyoffice && docker rm onlyoffice
# 重新執行 3-4 的 docker run 指令（資料保留在 /opt/onlyoffice）

# 4. 確認運作正常後，**再次清空 DNS 與 Gateway**
```

### 備份

```bash
# 在 Linux VM 上每週備份
sudo tar -czf /opt/backup/onlyoffice-$(date +%F).tar.gz /opt/onlyoffice
# 透過 scp 傳到 Windows: scp 檔案 dmsadmin@192.168.50.1:/d/Backup/
```

---

## ❓ 常見問題

| 問題 | 解法 |
|------|------|
| Hyper-V 找不到「第二代」選項 | 確認 Windows Server 為 2016 以上 |
| Ubuntu 安裝後黑畫面 | 取消「啟用安全開機」 |
| Docker 啟動失敗 | `sudo systemctl status docker` 看錯誤；通常是磁碟空間不足 |
| IIS 無法連到 192.168.50.10 | 檢查 Windows 主機虛擬網卡是否拿到 192.168.50.1 |
| OnlyOffice 顯示 "Token is invalid" | JWT_SECRET 兩端不一致 |
| 使用者瀏覽器看不到編輯器 | URL Rewrite + ARR 模組未安裝 |

---

**下一步**：完成 VM 建置與隔離後，再進入 .NET 後端 OnlyOffice Controller 與前端 iframe 整合的程式碼實作階段。
