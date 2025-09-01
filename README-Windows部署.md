# 畜牧業管理系統 - Windows部署說明

## 🚀 快速開始

### 1. 系統要求
- Windows 10/11 或 Windows Server 2019+
- 管理員權限
- 網路連接

### 2. 一鍵部署
1. 下載整個專案到Windows電腦
2. 右鍵點擊 `deploy-windows.bat`
3. 選擇「以管理員身份運行」
4. 等待自動安裝完成

### 3. 手動安裝步驟（如果自動安裝失敗）

#### 步驟1：安裝Node.js
1. 訪問 https://nodejs.org/
2. 下載LTS版本
3. 執行安裝程序

#### 步驟2：安裝MongoDB
1. 運行 `install-mongodb-windows.bat`（以管理員身份）
2. 或手動下載：https://www.mongodb.com/try/download/community

#### 步驟3：安裝FFmpeg
- 自動安裝腳本會處理FFmpeg
- 手動安裝：下載到 `ffmpeg` 資料夾

#### 步驟4：啟動系統
```cmd
npm install
npm start
```

## 🎯 使用方法

### 啟動系統
- **第一次部署**：運行 `deploy-windows.bat`
- **日常啟動**：運行 `start-windows.bat`

### 訪問系統
- 主控台：http://localhost:3000
- 攝影機管理：http://localhost:3000/onvif-cameras

### 攝影機連接
1. 點擊「搜尋攝影機」
2. 使用「批量連接」功能
3. 輸入攝影機認證資訊（通常是 admin/密碼）
4. 等待連接完成

## 📋 功能特色

### ✅ 已實現功能
- 🔍 自動發現ONVIF攝影機
- 🔗 批量連接攝影機
- 📸 拍攝快照
- 🎥 即時串流（需要FFmpeg）
- 📊 系統監控面板
- 🔄 自動更新狀態

### 🚧 需要配置的功能
- 🎬 影像串流轉換（依賴FFmpeg）
- 📱 MQTT感測器數據
- 💾 MongoDB數據存儲

## 🛠️ 故障排除

### 常見問題

#### 1. 攝影機無法連接
- 確認攝影機IP位址正確
- 檢查用戶名和密碼
- 確保攝影機支援ONVIF協議
- 檢查網路防火牆設定

#### 2. 串流無法播放
- 確認FFmpeg已正確安裝
- 檢查防火牆是否阻擋端口
- 確認攝影機支援RTSP串流

#### 3. MongoDB連接失敗
```cmd
net start MongoDB
```

#### 4. 端口衝突
修改 `config.js` 中的端口設定：
```javascript
port: 3001  // 改為其他端口
```

### 日誌檔案
- 部署日誌：`deploy.log`
- 應用日誌：控制台輸出

## 🔧 進階配置

### 環境變數
創建 `.env` 檔案：
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/livestock_management
MQTT_HOST=localhost
MQTT_PORT=1883
```

### 攝影機認證
常見的攝影機預設認證：
- **Hikvision**: admin / 12345 或 admin / admin
- **Dahua**: admin / admin
- **通用**: admin / password

### 網路設定
確保以下端口可用：
- `3000` - Web服務
- `27017` - MongoDB
- `1883` - MQTT
- `554` - RTSP串流

## 📞 技術支援

### 系統資訊
- Node.js版本：查看 `node --version`
- npm版本：查看 `npm --version`
- MongoDB狀態：查看 `net start | findstr MongoDB`

### 重啟服務
```cmd
# 重啟MongoDB
net stop MongoDB
net start MongoDB

# 重啟應用
Ctrl+C 停止
npm start 重新啟動
```

## 🎉 完成部署

部署完成後，您可以：

1. **管理攝影機**
   - 搜尋並連接攝影機
   - 查看即時影像
   - 拍攝快照

2. **監控系統**
   - 查看連接狀態
   - 監控串流數量
   - 管理快照

3. **擴展功能**
   - 添加感測器數據
   - 設定警報系統
   - 客製化介面

---

**🎯 目標**：讓您快速在Windows環境中部署完整的畜牧業管理系統！
