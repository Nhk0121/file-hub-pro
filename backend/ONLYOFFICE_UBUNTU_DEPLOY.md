# OnlyOffice Document Server (Ubuntu Server) 完整建置指南

> 目的：在獨立 Ubuntu Server 上以 Docker 跑 OnlyOffice Document Server，
> 讓桃園區處 DMS（Windows Server IIS）能線上編輯 Word / Excel / PowerPoint。

---

## 0. 架構總覽

```
       公司內網 172.30.0.0/16
   ┌──────────────────────────────────────────────────────┐
   │                                                      │
   │  ┌──────────────────┐         ┌────────────────────┐ │
   │  │  使用者瀏覽器       │ HTTPS  │  DMS-Server (Win) │ │
   │  │ (公司 PC)          │◄──────►│  IIS + .NET 8 API │ │
   │  └──────────────────┘  443   │  172.30.134.58     │ │
   │           │                  └──────────┬─────────┘ │
   │           │ 同源:                       │ HTTP/8080 │
   │           │ https://dms/onlyoffice/*  │ Callback  │
   │           │  (IIS ARR 反向代理)          │ HTTPS/8443│
   │           ▼                             ▼           │
   │  ┌────────────────────────────────────────────┐     │
   │  │  OnlyOffice-Server (Ubuntu 22.04 LTS)       │     │
   │  │  Docker: onlyoffice/documentserver:latest   │     │
   │  │  172.30.134.99   port 80 / 443              │     │
   │  └────────────────────────────────────────────┘     │
   └──────────────────────────────────────────────────────┘
```

**為什麼這樣設計？**

| 對象 | 連到誰 | 用什麼位址 |
|---|---|---|
| 瀏覽器載入 DocsAPI | `/onlyoffice/...` | 同源, IIS 反向代理到 Ubuntu |
| 瀏覽器跟 DocServer WebSocket | `/onlyoffice/...` | 同上,避免 CORS / Mixed Content |
| Ubuntu DocServer 拉檔 | DMS API | `https://172.30.134.58:8443/api/onlyoffice/file/...` |
| Ubuntu DocServer 儲存回呼 | DMS API | `https://172.30.134.58:8443/api/onlyoffice/callback/...` |

> 重點：DocServer 必須能 ping 通並 https 連到 DMS-Server 的 8443，反之亦然。

---

## 1. Ubuntu Server 準備（一次性）

### 1.1 規格建議
- Ubuntu Server **22.04 LTS** 或 24.04 LTS
- CPU 2 核以上、RAM **4 GB 以上**（建議 8 GB）
- 磁碟 20 GB 以上
- 固定 IP `172.30.134.99/16`（依公司網段調整）

### 1.2 安裝後第一件事
```bash
sudo apt update && sudo apt upgrade -y
sudo timedatectl set-timezone Asia/Taipei
sudo hostnamectl set-hostname onlyoffice-server
```

### 1.3 設定固定 IP（Netplan）
```bash
sudo nano /etc/netplan/00-installer-config.yaml
```
範例（網卡名以 `ip addr` 看到的為準，如 `ens33` / `eno1`）：
```yaml
network:
  version: 2
  ethernets:
    ens33:
      dhcp4: false
      addresses: [172.30.134.99/16]
      routes:
        - to: default
          via: 172.30.0.1            # 公司 gateway
      nameservers:
        addresses: [8.8.8.8, 1.1.1.1]
```
```bash
sudo netplan apply
ip addr                              # 確認 172.30.134.99
ping -c 3 172.30.134.58              # 確認能 ping DMS
ping -c 3 8.8.8.8                    # 確認能上外網（拉 Docker image）
```

---

## 2. 安裝 Docker

```bash
# 移除舊版
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null

# 安裝 Docker CE
sudo apt install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 驗證
sudo docker run --rm hello-world
```

---

## 3. 部署 OnlyOffice Document Server

### 3.1 產生 JWT 密鑰
```bash
openssl rand -hex 32
# 例：8f3a91d7b2e4...（複製下來,等下兩邊都要用）
```
> **同一把密鑰**會同時填到：
> 1. Ubuntu Docker 的 `JWT_SECRET` 環境變數
> 2. DMS 的 `appsettings.json` → `OnlyOffice:JwtSecret`

### 3.2 建立資料目錄（持久化儲存）
```bash
sudo mkdir -p /srv/onlyoffice/{data,log,lib,db}
sudo chown -R 1000:1000 /srv/onlyoffice
```

### 3.3 啟動容器（最終正式版）
```bash
sudo docker run -d --name onlyoffice --restart=always \
  -p 80:80 \
  -e JWT_ENABLED=true \
  -e JWT_SECRET='把上面那把 hex 32 字串貼進來' \
  -e JWT_HEADER=Authorization \
  -e USE_UNAUTHORIZED_STORAGE=true \
  -v /srv/onlyoffice/data:/var/www/onlyoffice/Data \
  -v /srv/onlyoffice/log:/var/log/onlyoffice \
  -v /srv/onlyoffice/lib:/var/lib/onlyoffice \
  -v /srv/onlyoffice/db:/var/lib/postgresql \
  onlyoffice/documentserver:latest
```

> **參數說明**
> - `JWT_ENABLED=true`：所有 DocsAPI 呼叫都必須帶簽章
> - `USE_UNAUTHORIZED_STORAGE=true`：允許 DocServer 信任 DMS 的自簽 HTTPS 憑證
> - `-p 80:80`：對外開 HTTP（瀏覽器走 IIS 反向代理過來,已是 HTTPS）

### 3.4 驗證
```bash
# 等約 30 秒（首啟動會初始化資料庫）
sleep 30
curl http://localhost/healthcheck
# 預期回傳：true

# 從 DMS-Server 也測一次
# 在 Windows PowerShell:
#   Invoke-WebRequest http://172.30.134.99/healthcheck
```

打開瀏覽器：`http://172.30.134.99/welcome/`
看到 OnlyOffice 歡迎頁就 OK。

---

## 4. 防火牆：只接受 DMS-Server

```bash
# 安裝 iptables-persistent（重開機保留規則）
sudo apt install -y iptables-persistent

# 規則：只允許 DMS-Server (172.30.134.58) 連 80, SSH 限 DMS-Server
sudo iptables -F INPUT
sudo iptables -A INPUT -i lo -j ACCEPT
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80  -s 172.30.134.58 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 22  -s 172.30.134.58 -j ACCEPT
sudo iptables -A INPUT -p icmp -s 172.30.134.58 -j ACCEPT
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# 持久化
sudo netfilter-persistent save
```

> 若日後新增可信來源（例如另一台管理機 `172.30.134.10`）：
> ```bash
> sudo iptables -I INPUT -p tcp --dport 22 -s 172.30.134.10 -j ACCEPT
> sudo netfilter-persistent save
> ```

---

## 5. DMS 端（Windows Server）設定

### 5.1 安裝 IIS 反向代理元件
1. **URL Rewrite Module 2.1** — https://www.iis.net/downloads/microsoft/url-rewrite
2. **Application Request Routing 3.0** — https://www.iis.net/downloads/microsoft/application-request-routing
3. 安裝完開 IIS 管理員 → 點伺服器節點 → **Application Request Routing Cache** → 右側 **Server Proxy Settings** → **✅ Enable proxy** → Apply

### 5.2 修改 `appsettings.json`
把第 3.1 步的 JWT 密鑰、固定 IP 填入：

```json
"OnlyOffice": {
  "JwtSecret": "貼上 openssl rand 出來的 hex32",
  "InternalDocumentServerUrl": "http://172.30.134.99",
  "PublicDocumentServerUrl": "/onlyoffice",
  "CallbackBaseUrl": "https://172.30.134.58:8443"
}
```

> **`CallbackBaseUrl` 必須是 DocServer 連得到的 DMS 位址**。
> - 若 DMS 對內走 8443 → 填 `https://172.30.134.58:8443`
> - 若已上正式網域 → 填 `https://dms.example.gov.tw`

### 5.3 `web.config` 已內建反向代理規則
專案內 `backend/TaoyuanDMS.API/web.config` 已有：
```xml
<rule name="OnlyOfficeProxy" stopProcessing="true">
  <match url="^onlyoffice/(.*)" />
  <action type="Rewrite" url="http://172.30.134.99/{R:1}" />
</rule>
```
若 Ubuntu IP 換了就改這行。

### 5.4 Windows 防火牆：放行 8443
讓 Ubuntu 連得進來：
```powershell
New-NetFirewallRule -DisplayName "DMS 8443 in" -Direction Inbound `
  -LocalPort 8443 -Protocol TCP -Action Allow -Profile Any
```

### 5.5 部署 / 重啟
```powershell
# 重新部署後端
dotnet publish backend/TaoyuanDMS.API -c Release -o C:\inetpub\dms-api
iisreset
```

---

## 6. 驗證流程（重要！按順序跑）

### Step 1 — Ubuntu 自己 OK
```bash
curl http://localhost/healthcheck
# → true
```

### Step 2 — DMS 連得到 Ubuntu
在 DMS-Server PowerShell：
```powershell
Invoke-WebRequest http://172.30.134.99/healthcheck
# StatusCode 200, Content "true"
```

### Step 3 — IIS 反向代理 OK
瀏覽器開：`https://172.30.134.58:8443/onlyoffice/healthcheck`
應回傳 `true`。若 404 或 502 → IIS ARR 未啟用 proxy / URL Rewrite 沒裝。

### Step 4 — DMS 內建診斷端點
登入 DMS 後在瀏覽器網址列：
```
https://172.30.134.58:8443/api/onlyoffice/diagnose
```
應得到：
```json
{
  "ok": true,
  "status": 200,
  "body": "true",
  "internalUrl": "http://172.30.134.99",
  "publicUrl": "/onlyoffice",
  "callbackBaseUrl": "https://172.30.134.58:8443"
}
```

### Step 5 — 實際開檔測試
1. 在 DMS 上傳一個 `.docx` 檔
2. 點預覽 → 看到「**線上編輯**」按鈕 → 按下
3. 應跳到 `/edit/{id}`,載入 OnlyOffice 編輯器
4. 修改 → 等 10 秒自動儲存 → 重整頁面看內容是否更新

---

## 7. 常見問題排除

| 症狀 | 原因 | 解法 |
|---|---|---|
| `diagnose` 回 `ok:false, error: timeout` | DMS ping 不到 Ubuntu | 檢查 iptables、IP、網段 |
| 編輯器顯示 `Error: Token is invalid` | JWT_SECRET 兩邊不一致 | 重新對 `JwtSecret` 與 Docker `JWT_SECRET` |
| 開啟編輯器空白 / 一直轉圈 | IIS ARR proxy 沒啟用 | IIS → ARR Cache → Server Proxy Settings → Enable |
| 儲存後檔案沒變更 | DocServer 拉檔失敗 / callback URL 錯 | 看 `sudo docker logs onlyoffice` 是否有 401/connection refused |
| `Mixed Content` 警告 | DMS 是 HTTPS,DocsAPI 載到 HTTP | 使用 `PublicDocumentServerUrl: "/onlyoffice"` 走同源 |
| docker logs 出現 `unauthorized storage` | DMS 自簽憑證未信任 | 確認 `USE_UNAUTHORIZED_STORAGE=true` 有設 |

### 即時看 DocServer log
```bash
sudo docker logs -f onlyoffice
# 或進容器看詳細
sudo docker exec -it onlyoffice bash
tail -f /var/log/onlyoffice/documentserver/converter/out.log
```

---

## 8. 升級 / 維護

### 升級到新版
```bash
sudo docker pull onlyoffice/documentserver:latest
sudo docker stop onlyoffice && sudo docker rm onlyoffice
# 用第 3.3 同樣的 docker run 指令重啟（資料目錄已掛載,內容會保留）
```

### 備份
備份 `/srv/onlyoffice/` 整個目錄即可（含字型、設定、暫存文件）。

### 重啟容器
```bash
sudo docker restart onlyoffice
```

---

## 9. 完整檢核清單

部署完請逐項勾選：

- [ ] Ubuntu 固定 IP `172.30.134.99`,可雙向 ping DMS
- [ ] `openssl rand -hex 32` 產生的 JWT_SECRET 兩邊一致
- [ ] `docker ps` 看到 `onlyoffice` running
- [ ] `curl http://localhost/healthcheck` 在 Ubuntu 回 `true`
- [ ] `Invoke-WebRequest http://172.30.134.99/healthcheck` 在 Windows 回 `true`
- [ ] iptables 規則已 `netfilter-persistent save`
- [ ] IIS 已裝 URL Rewrite + ARR,Proxy 已啟用
- [ ] DMS `appsettings.json` 的三個 OnlyOffice URL 都對
- [ ] Windows 防火牆放行 8443
- [ ] `https://DMS/onlyoffice/healthcheck` 回 `true`
- [ ] `https://DMS/api/onlyoffice/diagnose` 回 `ok:true`
- [ ] 上傳 .docx → 線上編輯 → 自動儲存 → 重整內容已更新
