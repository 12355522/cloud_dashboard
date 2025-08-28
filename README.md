# 畜牧業管理系統

一個基於 Node.js + Express + Handlebars 的畜牧業場域管理系統，提供場域監控、設備管理和數據統計功能。

## 功能特色

### 🏠 Dashboard 儀表板
- 總覽所有場域統計資訊
- 即時顯示飼養天數、飼養數量、飲水量、風扇數量
- 場域狀態一覽表

### 🗺️ 場域管理
- 創建和管理場域（輸入 IP 與名稱）
- 場域列表檢視，可點選進入詳細頁面
- 場域詳細資訊編輯

### 📊 場域詳細功能
- 上傳場域平面圖
- 2D 平面感測器與設備佈建
- 拖拽式編輯模式，可調整設備位置
- 感測器和設備列表管理

### 🔧 技術特色
- 響應式設計，支援手機、平板、桌面
- 直觀的拖拽介面
- 即時數據儲存
- 檔案上傳功能

## 系統需求

- Node.js 14.0 或更高版本
- npm 6.0 或更高版本
- MongoDB 4.0 或更高版本
- MQTT Broker (如 Mosquitto, 可選)

## 安裝步驟

1. 下載或複製專案
```bash
git clone <repository-url>
cd cloud_dashboard
```

2. 安裝相依套件
```bash
npm install
```

3. 啟動 MongoDB（必須）
```bash
# macOS (使用 Homebrew)
brew services start mongodb-community

# Ubuntu/Debian
sudo systemctl start mongod

# 或使用 Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

4. 啟動 MQTT Broker（可選）
```bash
# 使用 Mosquitto
mosquitto -p 1883

# 或使用 Docker
docker run -d -p 1883:1883 --name mosquitto eclipse-mosquitto
```

5. 配置環境變數（可選）
```bash
# 複製配置範例
cp .env.example .env

# 編輯配置檔案
# MONGODB_URI=mongodb://localhost:27017/livestock_management
# MQTT_BROKER=mqtt://localhost:1883
```

6. 啟動系統
```bash
npm start
```

7. 開發模式（自動重新載入）
```bash
npm run dev
```

8. 開啟瀏覽器訪問 `http://localhost:3000`

## 專案結構

```
cloud_dashboard/
├── server.js                 # 主要伺服器檔案
├── package.json              # 專案配置和相依性
├── views/                    # Handlebars 模板
│   ├── layouts/
│   │   └── main.hbs          # 主要佈局模板
│   ├── dashboard.hbs         # 儀表板頁面
│   ├── farms.hbs             # 場域列表頁面
│   ├── farm-form.hbs         # 場域表單頁面
│   └── farm-detail.hbs       # 場域詳細頁面
├── public/                   # 靜態資源
│   ├── css/
│   │   └── style.css         # 自定義樣式
│   └── js/
│       └── app.js            # 前端 JavaScript
└── uploads/                  # 上傳檔案目錄
```

## 使用說明

### 1. 建立場域
1. 點選「新增場域」按鈕
2. 輸入場域名稱和 IP 位址
3. 點選「建立場域」

### 2. 管理場域詳細資訊
1. 在場域列表中點選「查看詳細」
2. 上傳場域平面圖
3. 進入編輯模式新增感測器和設備
4. 拖拽調整設備位置
5. 儲存佈局

### 3. 更新統計資料
1. 在場域詳細頁面點選「編輯」
2. 更新飼養天數、飼養數量等資訊
3. 儲存變更

### 4. 設定 MQTT 設備
1. 在場域詳細頁面進入編輯模式
2. 新增感測器或設備時輸入 MQTT 設備名稱
3. 系統會自動訂閱對應的 MQTT 主題
4. 即時接收設備狀態更新

## MQTT 主題結構

系統會自動訂閱以下 MQTT 主題格式：

### 控制設備狀態
- **主題**: `device/{devicename}/nodeinf`
- **說明**: 接收所有控制設備的狀態資訊
- **資料格式**: JSON

### 感測器設備狀態  
- **主題**: `device/{devicename}/seninf`
- **說明**: 接收感測器設備的狀態資訊
- **資料格式**: JSON

### 設備資訊
- **主題**: `device/{devicename}/deviceinf`
- **說明**: 接收設備資訊，包含：
  - `feeding_days`: 飼養天數
  - `device_number`: 設備編號
  - `fan_count`: 風扇數量
- **資料格式**: JSON

### MQTT 訊息範例

```json
// nodeinf - 控制設備狀態
{
  "fan_speed": 75,
  "water_pump": "on",
  "temperature_control": "auto"
}

// seninf - 感測器狀態
{
  "temperature": 25.5,
  "humidity": 68.2,
  "water_level": 85
}

// deviceinf - 設備資訊
{
  "feeding_days": 45,
  "device_number": "PF001",
  "fan_count": 8
}
```

## API 路由

### 網頁路由
- `GET /` - 儀表板首頁
- `GET /farms` - 場域列表
- `GET /farms/new` - 新增場域表單
- `POST /farms` - 建立新場域
- `GET /farms/:id` - 場域詳細頁面
- `GET /farms/:id/edit` - 編輯場域表單
- `POST /farms/:id` - 更新場域資訊
- `POST /farms/:id/upload-layout` - 上傳場域佈局圖
- `POST /farms/:id/sensors-devices` - 更新感測器和設備位置

### API 路由
- `GET /api/system/status` - 系統狀態（MongoDB、MQTT 連接狀態）
- `GET /api/farms/:id/realtime` - 場域即時資料

## 技術棧

- **後端**: Node.js, Express.js
- **資料庫**: MongoDB + Mongoose ODM
- **IoT 通訊**: MQTT Client
- **模板引擎**: Handlebars (HBS)
- **前端**: Bootstrap 5, Font Awesome, 原生 JavaScript
- **檔案上傳**: Multer
- **其他**: UUID（唯一識別符生成）、dotenv（環境變數管理）

## 資料結構

### 場域 (Farm)
```javascript
{
  id: "唯一識別符",
  name: "場域名稱",
  ip: "IP位址",
  layout_image: "佈局圖檔名",
  sensors: [感測器陣列],
  devices: [設備陣列],
  stats: {
    feeding_days: 飼養天數,
    animal_count: 飼養數量,
    water_consumption: 飲水量,
    fan_count: 風扇數量
  }
}
```

### 感測器/設備
```javascript
{
  id: "唯一識別符",
  name: "名稱",
  type: "類型",
  x: X座標百分比,
  y: Y座標百分比
}
```

## 貢獻

歡迎提交 Issue 和 Pull Request 來改善系統功能。

## 授權

MIT License

## 聯絡資訊

如有問題或建議，請聯繫開發團隊。
