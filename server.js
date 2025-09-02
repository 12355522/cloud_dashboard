const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// 載入設定和服務
const config = require('./system-config');
const databaseService = require('./services/database');
const mqttBroker = require('./services/mqttBroker');
const mqttClient = require('./services/mqttClient');
const onvifService = require('./services/onvifService');
const Farm = require('./models/Farm');

const app = express();
const port = config.server.port;

// 設定 Handlebars 模板引擎
app.engine('.hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
        eq: function(a, b) {
            return a === b;
        },
        add: function(a, b) {
            return a + b;
        },
        json: function(context) {
            return JSON.stringify(context);
        },
        formatDate: function(date) {
            if (!date) return '無資料';
            return new Date(date).toLocaleString('zh-TW');
        },
        statusBadge: function(status) {
            const badges = {
                'online': 'bg-success',
                'offline': 'bg-secondary',
                'error': 'bg-danger'
            };
            return badges[status] || 'bg-secondary';
        }
    }
}));
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

// 中介軟體
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/snapshots', express.static(path.join(__dirname, 'public/snapshots')));
app.use('/streams', express.static(path.join(__dirname, 'public/streams')));

// 設定檔案上傳
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // 清理檔案名稱並添加時間戳
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_') || 'image';
        const cleanName = cleanBaseName + ext;
        const finalName = Date.now() + '-' + cleanName;
        console.log('📝 檔案名稱處理:', {
            original: file.originalname,
            cleaned: cleanName,
            final: finalName
        });
        cb(null, finalName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB 限制
        files: 1 // 一次只能上傳一個檔案
    },
    fileFilter: function (req, file, cb) {
        // 檢查檔案類型
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允許上傳圖片檔案！'), false);
        }
    }
});

// 系統狀態中介軟體
app.use((req, res, next) => {
    res.locals.systemStatus = {
        database: databaseService.getConnectionStatus(),
        mqtt: mqttClient.getConnectionStatus()
    };
    next();
});

// 路由
app.get('/', async (req, res) => {
    try {
        const farms = await Farm.find({}).lean();
        
        // 計算統計摘要
        const totalStats = farms.reduce((acc, farm) => {
            acc.total_farms += 1;
            acc.total_animals += farm.stats.animal_count || 0;
            acc.total_water += farm.stats.water_consumption || 0;
            acc.total_fans += farm.stats.fan_count || 0;
            
            // 計算線上感測器和設備數量
            acc.online_sensors += (farm.sensors || []).filter(s => s.status === 'online').length;
            acc.online_devices += (farm.devices || []).filter(d => d.status === 'online').length;
            
            return acc;
        }, {
            total_farms: 0,
            total_animals: 0,
            total_water: 0,
            total_fans: 0,
            online_sensors: 0,
            online_devices: 0
        });

        res.render('dashboard', { 
            title: '畜牧業管理系統', 
            farms: farms,
            totalStats: totalStats
        });
    } catch (error) {
        console.error('載入儀表板失敗:', error);
        res.status(500).render('error', { error: '載入資料失敗' });
    }
});

// 場域列表
app.get('/farms', async (req, res) => {
    try {
        const farms = await Farm.find({}).sort({ created_at: -1 }).lean();
        res.render('farms', { 
            title: '場域管理',
            farms: farms 
        });
    } catch (error) {
        console.error('載入場域列表失敗:', error);
        res.status(500).render('error', { error: '載入場域列表失敗' });
    }
});

// 新增場域頁面
app.get('/farms/new', (req, res) => {
    res.render('farm-form', { 
        title: '新增場域',
        action: '/farms',
        method: 'POST'
    });
});

// 創建新場域
app.post('/farms', async (req, res) => {
    try {
        const { name, ip } = req.body;
        
        const newFarm = new Farm({
            name: name,
            ip: ip,
            sensors: [],
            devices: [],
            stats: {
                feeding_days: 0,
                animal_count: 0,
                water_consumption: 0,
                fan_count: 0
            },
            mqtt_topic_prefix: 'device/',
            status: 'active'
        });
        
        await newFarm.save();
        console.log('新場域已建立:', newFarm.name);
        
        res.redirect('/farms');
    } catch (error) {
        console.error('建立場域失敗:', error);
        res.status(500).render('error', { error: '建立場域失敗: ' + error.message });
    }
});

// 場域詳細頁面
app.get('/farms/:id', async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id).lean();
        if (!farm) {
            return res.status(404).render('error', { error: '場域不存在' });
        }
        
        res.render('farm-detail', { 
            title: `${farm.name} - 場域詳細`,
            farm: farm
        });
    } catch (error) {
        console.error('載入場域詳細失敗:', error);
        res.status(500).render('error', { error: '載入場域詳細失敗' });
    }
});

// 編輯場域頁面
app.get('/farms/:id/edit', async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id).lean();
        if (!farm) {
            return res.status(404).render('error', { error: '場域不存在' });
        }
        
        res.render('farm-form', { 
            title: '編輯場域',
            farm: farm,
            action: `/farms/${farm._id}`,
            method: 'POST'
        });
    } catch (error) {
        console.error('載入編輯頁面失敗:', error);
        res.status(500).render('error', { error: '載入編輯頁面失敗' });
    }
});

// 更新場域
app.post('/farms/:id', async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id);
        if (!farm) {
            return res.status(404).render('error', { error: '場域不存在' });
        }
        
        const { name, ip, feeding_days, animal_count, water_consumption, fan_count } = req.body;
        
        farm.name = name;
        farm.ip = ip;
        
        if (feeding_days !== undefined) farm.stats.feeding_days = parseInt(feeding_days) || 0;
        if (animal_count !== undefined) farm.stats.animal_count = parseInt(animal_count) || 0;
        if (water_consumption !== undefined) farm.stats.water_consumption = parseInt(water_consumption) || 0;
        if (fan_count !== undefined) farm.stats.fan_count = parseInt(fan_count) || 0;
        
        await farm.save();
        console.log('場域已更新:', farm.name);
        
        res.redirect(`/farms/${farm._id}`);
    } catch (error) {
        console.error('更新場域失敗:', error);
        res.status(500).render('error', { error: '更新場域失敗: ' + error.message });
    }
});

// 刪除場域
app.delete('/farms/:id', async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id);
        if (!farm) {
            return res.status(404).json({ error: '場域不存在' });
        }
        
        const farmName = farm.name;
        await Farm.findByIdAndDelete(req.params.id);
        console.log('場域已刪除:', farmName);
        
        res.json({ success: true, message: `場域「${farmName}」已成功刪除` });
    } catch (error) {
        console.error('刪除場域失敗:', error);
        res.status(500).json({ error: '刪除場域失敗: ' + error.message });
    }
});

// POST方式刪除場域（用於表單提交）
app.post('/farms/:id/delete', async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id);
        if (!farm) {
            return res.status(404).render('error', { error: '場域不存在' });
        }
        
        const farmName = farm.name;
        await Farm.findByIdAndDelete(req.params.id);
        console.log('場域已刪除:', farmName);
        
        res.redirect('/farms');
    } catch (error) {
        console.error('刪除場域失敗:', error);
        res.status(500).render('error', { error: '刪除場域失敗: ' + error.message });
    }
});

// 上傳場域佈局圖
app.post('/farms/:id/upload-layout', (req, res) => {
    console.log('🚀 開始處理場域佈局圖上傳 - 場域ID:', req.params.id);
    
    upload.single('layout_image')(req, res, async (err) => {
        try {
            console.log('📁 Multer 處理完成');
            
            // 處理 Multer 錯誤
            if (err) {
                console.error('❌ 檔案上傳錯誤:', err);
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).render('error', { error: '檔案大小超過 5MB 限制' });
                } else if (err.message.includes('圖片檔案')) {
                    return res.status(400).render('error', { error: '只允許上傳圖片檔案（JPG, PNG, GIF）' });
                } else {
                    return res.status(400).render('error', { error: '檔案上傳失敗: ' + err.message });
                }
            }
            
            console.log('✅ 沒有 Multer 錯誤');
            
            const farm = await Farm.findById(req.params.id);
            if (!farm) {
                return res.status(404).render('error', { error: '場域不存在' });
            }
            
            if (!req.file) {
                return res.status(400).render('error', { error: '請選擇要上傳的圖片檔案' });
            }
            
            console.log('📤 收到檔案上傳:', {
                filename: req.file.filename,
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });
            
            // 刪除舊圖片檔案（如果存在）
            if (farm.layout_image) {
                const fs = require('fs');
                const oldImagePath = path.join(__dirname, 'uploads', farm.layout_image);
                try {
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                        console.log('已刪除舊圖片:', farm.layout_image);
                    }
                } catch (deleteError) {
                    console.warn('刪除舊圖片失敗:', deleteError.message);
                }
            }
            
            // 更新資料庫
            farm.layout_image = req.file.filename;
            await farm.save();
            console.log('✅ 場域佈局圖已上傳:', req.file.filename);
            
            res.redirect(`/farms/${farm._id}`);
        } catch (error) {
            console.error('上傳處理失敗:', error);
            res.status(500).render('error', { error: '上傳處理失敗: ' + error.message });
        }
    });
});

// 新增/更新感測器和設備位置
app.post('/farms/:id/sensors-devices', async (req, res) => {
    try {
        console.log('🚀 收到佈局儲存請求 - 場域ID:', req.params.id);
        console.log('📦 請求資料:', {
            sensorsCount: req.body.sensors?.length,
            devicesCount: req.body.devices?.length
        });
        
        const farm = await Farm.findById(req.params.id);
        if (!farm) {
            console.log('❌ 場域不存在:', req.params.id);
            return res.status(404).json({ error: '場域不存在' });
        }
        
        console.log('✅ 找到場域:', farm.name);
        const { sensors, devices } = req.body;
        
        if (sensors) {
            farm.sensors = sensors;
            
            // 為新感測器訂閱 MQTT 主題
            for (const sensor of sensors) {
                if (sensor.deviceName && mqttClient.isConnected) {
                    await mqttClient.addDeviceSubscription(sensor.deviceName);
                }
            }
        }
        
        if (devices) {
            farm.devices = devices;
            
            // 為新設備訂閱 MQTT 主題
            for (const device of devices) {
                if (device.deviceName && mqttClient.isConnected) {
                    await mqttClient.addDeviceSubscription(device.deviceName);
                }
            }
        }
        
        await farm.save();
        console.log('✅ 感測器和設備位置已更新');
        console.log('📊 更新後的資料:', {
            sensorsCount: farm.sensors.length,
            devicesCount: farm.devices.length
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('更新感測器設備失敗:', error);
        res.status(500).json({ error: '更新失敗: ' + error.message });
    }
});

// 系統狀態 API
app.get('/api/system/status', (req, res) => {
    res.json({
        database: databaseService.getConnectionStatus(),
        mqtt: mqttClient.getConnectionStatus(),
        timestamp: new Date().toISOString()
    });
});

// 測試飼養天數MQTT訊息
app.post('/api/test/feeding', async (req, res) => {
    try {
        const { deviceName = 'R02277d5', feedDay = '2' } = req.body;
        
        // 模擬MQTT訊息
        const mockMessage = {
            feedDay: feedDay.toString(),
            timestamp: new Date().toISOString()
        };
        
        console.log(`🧪 測試飼養天數更新 - 設備: ${deviceName}, 天數: ${feedDay}`);
        
        // 直接調用處理函數
        await mqttClient.handleFeedingInfo(deviceName, mockMessage);
        
        res.json({
            success: true,
            message: `已測試飼養天數更新`,
            data: {
                deviceName: deviceName,
                feedDay: feedDay,
                timestamp: mockMessage.timestamp
            }
        });
        
    } catch (error) {
        console.error('測試飼養天數更新失敗:', error);
        res.status(500).json({
            success: false,
            message: '測試失敗',
            error: error.message
        });
    }
});

// 重新訂閱所有設備的 feeding 主題
app.post('/api/mqtt/resubscribe-feeding', async (req, res) => {
    try {
        console.log('🔄 API 請求：重新訂閱所有 feeding 主題');
        
        const result = await mqttClient.resubscribeAllFeedingTopics();
        
        res.json({
            success: true,
            message: '已重新訂閱所有 feeding 主題',
            data: {
                deviceNames: result.deviceNames,
                newSubscriptions: result.newSubscriptions,
                totalDevices: result.deviceNames.length
            }
        });
        
    } catch (error) {
        console.error('重新訂閱 feeding 主題失敗:', error);
        res.status(500).json({
            success: false,
            message: '重新訂閱失敗',
            error: error.message
        });
    }
});

// 場域即時資料 API
app.get('/api/farms/:id/realtime', async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id);
        if (!farm) {
            return res.status(404).json({ error: '場域不存在' });
        }
        
        res.json({
            id: farm._id,
            name: farm.name,
            sensors: farm.sensors,
            devices: farm.devices,
            stats: farm.stats,
            online_sensors: farm.getOnlineSensorsCount(),
            online_devices: farm.getOnlineDevicesCount(),
            last_update: farm.updated_at
        });
    } catch (error) {
        console.error('載入即時資料失敗:', error);
        res.status(500).json({ error: '載入失敗' });
    }
});

// 系統狀態 API
app.get('/api/system/status', (req, res) => {
    const status = {
        system: {
            status: 'running',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version
        },
        database: {
            status: databaseService.isConnected() ? 'connected' : 'disconnected'
        },
        mqtt: {
            broker: mqttBroker.getStatus(),
            client: mqttClient.getConnectionStatus()
        }
    };
    
    res.json(status);
});

// 取得場域感測器資料 API
app.get('/api/farms/:id/sensors', async (req, res) => {
    try {
        const farm = await Farm.findById(req.params.id).lean();
        if (!farm) {
            return res.status(404).json({ error: '場域不存在' });
        }
        
        // 只返回感測器資料
        const sensorsData = farm.sensors.map(sensor => ({
            id: sensor.id,
            name: sensor.name,
            description: sensor.description, // 加入描述欄位作為主要識別名稱
            type: sensor.type,
            deviceName: sensor.deviceName,
            status: sensor.status,
            lastValue: sensor.lastValue,
            lastUpdate: sensor.lastUpdate,
            x: sensor.x,
            y: sensor.y
        }));
        
        res.json(sensorsData);
    } catch (error) {
        console.error('取得感測器資料失敗:', error);
        res.status(500).json({ error: '取得感測器資料失敗: ' + error.message });
    }
});

// 輪播感測器資料 API
app.get('/api/dashboard/carousel-data', async (req, res) => {
    try {
        const farms = await Farm.find({}).lean();
        
        // 返回輪播需要的資料
        const carouselData = farms.map(farm => ({
            _id: farm._id,
            name: farm.name,
            sensors: farm.sensors.map(sensor => ({
                id: sensor.id,
                name: sensor.name,
                description: sensor.description, // 加入描述欄位作為主要識別名稱
                lastValue: sensor.lastValue
            }))
        }));
        
        res.json(carouselData);
    } catch (error) {
        console.error('取得輪播資料失敗:', error);
        res.status(500).json({ error: '取得輪播資料失敗: ' + error.message });
    }
});

// ==================== ONVIF 攝影機管理路由 V2 (重構) ====================

// ONVIF攝影機管理頁面
app.get('/onvif-cameras', async (req, res) => {
    try {
        // 頁面渲染時不需要即時的攝影機資料，前端會透過API獲取
        res.render('onvif-cameras', {
            title: 'ONVIF攝影機管理 (V2)'
        });
    } catch (error) {
        console.error('載入ONVIF頁面失敗:', error);
        res.status(500).render('error', { error: '載入頁面失敗: ' + error.message });
    }
});

// [API] 取得所有設備 (已儲存和新發現的)
app.get('/api/onvif/devices', (req, res) => {
    try {
        const devices = onvifService.getDevices();
        res.json({ success: true, devices });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// [API] 獲取簡化場域列表 (新)
app.get('/api/farms/list', async (req, res) => {
    try {
        const farms = await Farm.find({}, '_id name').lean();
        res.json({ success: true, farms });
    } catch (error) {
        res.status(500).json({ success: false, error: '無法獲取場域列表' });
    }
});

// [API] 獲取分配給特定場域的攝影機列表 (新)
app.get('/api/farms/:id/cameras', (req, res) => {
    try {
        const { id } = req.params;
        const allDevices = onvifService.getDevices();
        const farmCameras = allDevices.filter(d => d.farmId === id && d.status === 'saved');
        res.json({ success: true, cameras: farmCameras });
    } catch (error) {
        res.status(500).json({ success: false, error: '無法獲取場域攝影機列表' });
    }
});

// [API] 更新場域的輪播攝影機設定 (新)
app.post('/api/farms/:id/carousel-cameras', async (req, res) => {
    try {
        const { id } = req.params;
        const { cameraIps } = req.body;

        if (!Array.isArray(cameraIps)) {
            return res.status(400).json({ success: false, error: 'cameraIps 必須是一個陣列' });
        }
        if (cameraIps.length > 2) {
            return res.status(400).json({ success: false, error: '最多只能選擇兩隻攝影機進行輪播' });
        }

        const farm = await Farm.findById(id);
        if (!farm) {
            return res.status(404).json({ success: false, error: '找不到指定的場域' });
        }

        farm.carouselCameras = cameraIps;
        await farm.save();

        res.json({ success: true, message: `場域 ${farm.name} 的輪播攝影機已更新` });
    } catch (error) {
        console.error(`❌ 更新場域 ${req.params.id} 的輪播攝影機失敗:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// [API] 觸發探索並回傳最新設備列表
app.post('/api/onvif/discover', async (req, res) => {
    try {
        await onvifService.discoverCameras(5000);
        const devices = onvifService.getDevices();
        res.json({ success: true, devices });
    } catch (error) {
        res.status(500).json({ success: false, error: '探索攝影機失敗: ' + error.message });
    }
});

// [API] 為攝影機分配場域 (新)
app.post('/api/onvif/devices/:ip/assign-farm', (req, res) => {
    try {
        const { ip } = req.params;
        const { farmId, farmName } = req.body;
        if (!farmId || !farmName) {
            return res.status(400).json({ success: false, error: '缺少 farmId 或 farmName' });
        }
        
        const success = onvifService.assignFarm(ip, farmId, farmName);
        if (success) {
            res.json({ success: true, message: `攝影機 ${ip} 已分配至場域 ${farmName}` });
        } else {
            res.status(404).json({ success: false, error: `找不到攝影機 ${ip}` });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// [API] 新增一台攝影機到系統
app.post('/api/onvif/devices', async (req, res) => {
    try {
        const { ip, port = 80, username = 'admin', password = '' } = req.body;
        if (!ip) {
            return res.status(400).json({ success: false, error: '請提供IP位址' });
        }
        
        const device = await onvifService.addDevice({ ip, port, username, password });
        res.status(201).json({ success: true, device });
    } catch (error) {
        console.error(`❌ 新增攝影機 ${req.body.ip} 失敗:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// [API] 從系統移除一台攝影機
app.delete('/api/onvif/devices/:ip', (req, res) => {
    try {
        const { ip } = req.params;
        const success = onvifService.removeDevice(ip);
        if (success) {
            res.json({ success: true, message: `攝影機 ${ip} 已移除` });
        } else {
            res.status(404).json({ success: false, error: `找不到攝影機 ${ip}` });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// [API] 開始串流
app.post('/api/onvif/stream/start/:ip', async (req, res) => {
    try {
        const { ip } = req.params;
        const streamInfo = await onvifService.startStreamConversion(ip);
        res.json({ success: true, stream: streamInfo });
    } catch (error) {
        res.status(500).json({ success: false, error: '啟動串流失敗: ' + error.message });
    }
});

// [API] 停止串流
app.post('/api/onvif/stream/stop/:ip', (req, res) => {
    try {
        const { ip } = req.params;
        const stopped = onvifService.stopStreamConversion(ip);
        if (stopped) {
            res.json({ success: true, message: '串流已停止' });
        } else {
            res.status(404).json({ success: false, error: '找不到正在運行的串流' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: '停止串流失敗: ' + error.message });
    }
});

// [API] 獲取串流狀態 (可選，用於前端輪詢)
app.get('/api/onvif/stream/status/:ip', (req, res) => {
    const { ip } = req.params;
    const isStreaming = onvifService.getStreamStatus(ip);
    res.json({ success: true, ip, isStreaming });
});


// ==================== 輪播系統路由 ====================

// 輪播設定（暫存在記憶體中，實際應用應存在資料庫）
let carouselSettings = {
    items: [],
    interval: 10,
    autoPlay: true,
    loop: true,
    transition: 'fade'
};

// 輪播頁面
app.get('/carousel', (req, res) => {
    try {
        res.render('carousel', {
            title: '影像輪播系統',
            carouselItems: carouselSettings.items,
            interval: carouselSettings.interval,
            autoPlay: carouselSettings.autoPlay,
            loop: carouselSettings.loop,
            transition: carouselSettings.transition
        });
    } catch (error) {
        console.error('載入輪播頁面失敗:', error);
        res.status(500).render('error', { error: '載入頁面失敗: ' + error.message });
    }
});



// 感測器警報演示頁面
app.get('/alert-demo', (req, res) => {
    try {
        res.render('alert-demo', {
            title: '警報系統演示'
        });
    } catch (error) {
        console.error('載入警報演示頁面失敗:', error);
        res.status(500).render('error', { error: '載入頁面失敗: ' + error.message });
    }
});

// 新增攝影機到輪播
app.post('/api/carousel/add-camera', (req, res) => {
    try {
        const { ip, streamUrl } = req.body;
        
        if (!ip || !streamUrl) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數'
            });
        }
        
        // 檢查是否已存在
        const existingIndex = carouselSettings.items.findIndex(item => 
            item.type === 'camera' && item.source === streamUrl
        );
        
        if (existingIndex !== -1) {
            return res.json({
                success: false,
                error: '此攝影機已在輪播列表中'
            });
        }
        
        // 新增到輪播列表
        const newItem = {
            id: Date.now().toString(),
            type: 'camera',
            title: `攝影機 ${ip}`,
            source: streamUrl,
            addedAt: new Date()
        };
        
        carouselSettings.items.push(newItem);
        
        console.log(`✅ 已新增攝影機到輪播: ${ip}`);
        
        res.json({
            success: true,
            item: newItem,
            message: '已新增到輪播列表'
        });
    } catch (error) {
        console.error('新增攝影機到輪播失敗:', error);
        res.status(500).json({
            success: false,
            error: '新增失敗: ' + error.message
        });
    }
});

// 移除輪播項目
app.post('/api/carousel/remove-item', (req, res) => {
    try {
        const { index } = req.body;
        
        if (index < 0 || index >= carouselSettings.items.length) {
            return res.status(400).json({
                success: false,
                error: '無效的項目索引'
            });
        }
        
        const removedItem = carouselSettings.items.splice(index, 1)[0];
        
        console.log(`🗑️ 已移除輪播項目: ${removedItem.title}`);
        
        res.json({
            success: true,
            removedItem: removedItem,
            message: '項目已移除'
        });
    } catch (error) {
        console.error('移除輪播項目失敗:', error);
        res.status(500).json({
            success: false,
            error: '移除失敗: ' + error.message
        });
    }
});

// 移動輪播項目
app.post('/api/carousel/move-item', (req, res) => {
    try {
        const { index, direction } = req.body;
        const newIndex = index + direction;
        
        if (index < 0 || index >= carouselSettings.items.length ||
            newIndex < 0 || newIndex >= carouselSettings.items.length) {
            return res.status(400).json({
                success: false,
                error: '無效的移動操作'
            });
        }
        
        // 交換項目
        [carouselSettings.items[index], carouselSettings.items[newIndex]] = 
        [carouselSettings.items[newIndex], carouselSettings.items[index]];
        
        console.log(`🔄 已移動輪播項目: ${index} -> ${newIndex}`);
        
        res.json({
            success: true,
            message: '項目已移動'
        });
    } catch (error) {
        console.error('移動輪播項目失敗:', error);
        res.status(500).json({
            success: false,
            error: '移動失敗: ' + error.message
        });
    }
});

// 清空所有輪播項目
app.post('/api/carousel/clear-all', (req, res) => {
    try {
        const itemCount = carouselSettings.items.length;
        carouselSettings.items = [];
        
        console.log(`🧹 已清空所有輪播項目 (${itemCount} 個)`);
        
        res.json({
            success: true,
            clearedCount: itemCount,
            message: '所有項目已清空'
        });
    } catch (error) {
        console.error('清空輪播項目失敗:', error);
        res.status(500).json({
            success: false,
            error: '清空失敗: ' + error.message
        });
    }
});

// 更新輪播設定
app.post('/api/carousel/settings', (req, res) => {
    try {
        const { interval, autoPlay, loop, transition } = req.body;
        
        if (interval) carouselSettings.interval = Math.max(1, Math.min(300, interval));
        if (typeof autoPlay === 'boolean') carouselSettings.autoPlay = autoPlay;
        if (typeof loop === 'boolean') carouselSettings.loop = loop;
        if (transition) carouselSettings.transition = transition;
        
        console.log('⚙️ 已更新輪播設定:', {
            interval: carouselSettings.interval,
            autoPlay: carouselSettings.autoPlay,
            loop: carouselSettings.loop,
            transition: carouselSettings.transition
        });
        
        res.json({
            success: true,
            settings: carouselSettings,
            message: '設定已更新'
        });
    } catch (error) {
        console.error('更新輪播設定失敗:', error);
        res.status(500).json({
            success: false,
            error: '更新失敗: ' + error.message
        });
    }
});

// 獲取輪播狀態
app.get('/api/carousel/status', (req, res) => {
    try {
        res.json({
            success: true,
            itemCount: carouselSettings.items.length,
            settings: carouselSettings,
            items: carouselSettings.items
        });
    } catch (error) {
        console.error('獲取輪播狀態失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取狀態失敗: ' + error.message
        });
    }
});

// 錯誤處理頁面
app.use((req, res) => {
    res.status(404).render('error', { error: '頁面不存在' });
});

app.use((error, req, res, next) => {
    console.error('系統錯誤:', error);
    res.status(500).render('error', { error: '系統發生錯誤' });
});

// 啟動伺服器
async function startServer() {
    try {
        console.log('🚀 正在啟動畜牧業管理系統...');
        
        // 初始化資料庫
        await databaseService.initialize();
        await databaseService.initSampleData();
        
        // 啟動 MQTT Broker
        try {
            await mqttBroker.start();
            console.log('✅ MQTT Broker 已啟動');
        } catch (brokerError) {
            console.warn('⚠️ MQTT Broker 啟動失敗:', brokerError.message);
        }

        // 等待一秒讓 Broker 完全啟動
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 初始化 MQTT 客戶端
        try {
            await mqttClient.initialize();
            console.log('✅ MQTT Client 已連接');
        } catch (mqttError) {
            console.warn('⚠️ MQTT Client 連接失敗，系統將在沒有 MQTT 功能的情況下繼續運行:', mqttError.message);
        }
        
        // 啟動 HTTP 伺服器
        app.listen(port, () => {
            console.log(`✅ 畜牧業管理系統已啟動`);
            console.log(`🌐 Web 介面: http://localhost:${port}`);
            console.log(`📡 MQTT Broker: mqtt://localhost:${config.mqtt.brokerPort}`);
            console.log(`📊 系統狀態: http://localhost:${port}/api/system/status`);
            console.log('---');
            console.log('系統功能:');
            console.log('• 場域管理與監控');
            console.log('• 2D 佈局設備管理');
            console.log('• MQTT Broker + Client 服務');
            console.log('• MQTT 即時資料接收');
            console.log('• MongoDB 資料持久化');
            console.log('---');
        });
        
    } catch (error) {
        console.error('❌ 系統啟動失敗:', error);
        process.exit(1);
    }
}

// 定頻風扇控制API
app.get('/remote/constant-fan', async (req, res) => {
    try {
        const deviceNumber = req.query.N;
        if (!deviceNumber) {
            return res.status(400).json({ error: '缺少設備編號' });
        }
        
        // 從資料庫載入設定（這裡暫時使用預設值）
        const defaultSettings = {
            sensorOne: 'none',
            sensorTwo: 'none',
            startTemp: 28,
            stopTemp: 25,
            co2Threshold: 1500,
            isEnable: false,
            isCo2Enable: false,
            isIntermittentMode: false,
            onMinutes: 15,
            offMinutes: 45,
            isDailyEnable: true,
            Day: [1, 3, 4, 5, 7, 10, 15, 20, 23, 30],
            ST: [30, 29, 28, 27, 26, 25, 24, 23, 22, 21],
            ET: [27, 26, 25, 24, 23, 22, 21, 20, 19, 18],
            SMVS: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
            SMVT: [45, 45, 45, 45, 45, 45, 45, 45, 45, 45]
        };
        
        console.log(`載入定頻風扇設定 - 設備: ${deviceNumber}`);
        res.json(defaultSettings);
    } catch (error) {
        console.error('載入定頻風扇設定失敗:', error);
        res.status(500).json({ error: '載入設定失敗: ' + error.message });
    }
});

app.post('/remote/constant-fan', async (req, res) => {
    try {
        const {
            CNumber,
            deviceType,
            sensorOne,
            sensorTwo,
            startTemp,
            stopTemp,
            co2Threshold,
            isEnable,
            isCo2Enable,
            isIntermittentMode,
            onMinutes,
            offMinutes,
            isDailyEnable,
            Day,
            ST,
            ET,
            SMVS,
            SMVT
        } = req.body;
        
        console.log('收到定頻風扇設定:', {
            設備編號: CNumber,
            溫度感測器: sensorOne,
            開啟溫度: startTemp,
            關閉溫度: stopTemp,
            間歇模式: isIntermittentMode,
            開啟分鐘: onMinutes,
            關閉分鐘: offMinutes
        });
        
        // 驗證設定
        if (!sensorOne || sensorOne === 'none') {
            return res.status(400).json({ error: '請選擇溫度感測器' });
        }
        
        if (startTemp <= stopTemp) {
            return res.status(400).json({ error: '開啟溫度必須高於關閉溫度' });
        }
        
        // 儲存設定到資料庫或發送MQTT指令
        const controlCommand = {
            device: CNumber,
            type: 'constant_fan_control',
            settings: {
                sensorOne,
                sensorTwo,
                startTemp,
                stopTemp,
                co2Threshold,
                isEnable,
                isCo2Enable,
                isIntermittentMode,
                onMinutes,
                offMinutes,
                isDailyEnable,
                dailySchedule: {
                    Day,
                    startTemps: ST,
                    stopTemps: ET,
                    onMinutes: SMVS,
                    offMinutes: SMVT
                }
            },
            timestamp: new Date().toISOString()
        };
        
        // 發送MQTT控制指令
        if (mqttClient && mqttClient.isConnected) {
            const topic = `device/${CNumber}/control`;
            mqttClient.publish(topic, JSON.stringify(controlCommand));
            console.log(`✅ 已發送定頻風扇控制指令到 ${topic}`);
        }
        
        res.json({ 
            success: true, 
            message: '定頻風扇設定已儲存',
            command: controlCommand 
        });
        
    } catch (error) {
        console.error('儲存定頻風扇設定失敗:', error);
        res.status(500).json({ error: '儲存失敗: ' + error.message });
    }
});

// 定頻風扇演示頁面
app.get('/demo/constant-fan', async (req, res) => {
    try {
        const deviceNumber = req.query.N || 'DEV001';
        
        res.render('constant-fan-demo', {
            title: '定頻風扇溫控系統演示',
            CNumber: deviceNumber
        });
    } catch (error) {
        console.error('載入演示頁面失敗:', error);
        res.status(500).render('error', { error: '載入演示頁面失敗: ' + error.message });
    }
});

// 定頻風扇控制頁面
app.get('/remote/constant-fan-page', async (req, res) => {
    try {
        const deviceNumber = req.query.N || 'DEV001';
        
        // 模擬感測器資料
        const sensorsdata = [
            { SN: '11A001', DES: '溫度感測器1' },
            { SN: '11A002', DES: '溫度感測器2' },
            { SN: '16A001', DES: '溫度感測器3' },
            { SN: '21A001', DES: 'CO2感測器1' },
            { SN: '21A002', DES: 'CO2感測器2' }
        ];
        
        res.render('constant-fan', {
            title: '定頻風扇溫控設定',
            CNumber: deviceNumber,
            deviceType: 'constant_fan',
            sensorsdata: sensorsdata
        });
    } catch (error) {
        console.error('載入定頻風扇頁面失敗:', error);
        res.status(500).render('error', { error: '載入頁面失敗: ' + error.message });
    }
});

// 取得定頻風扇狀態
app.get('/remote/constant-fan-status', async (req, res) => {
    try {
        const deviceNumber = req.query.N;
        if (!deviceNumber) {
            return res.status(400).json({ error: '缺少設備編號' });
        }
        
        // 模擬風扇狀態
        const fanStatus = {
            device: deviceNumber,
            isRunning: Math.random() > 0.5,
            currentTemp: (20 + Math.random() * 15).toFixed(1),
            targetStartTemp: 28,
            targetStopTemp: 25,
            mode: 'temperature_control',
            co2Level: Math.floor(400 + Math.random() * 1000),
            lastUpdate: new Date().toISOString()
        };
        
        res.json(fanStatus);
    } catch (error) {
        console.error('取得風扇狀態失敗:', error);
        res.status(500).json({ error: '取得狀態失敗: ' + error.message });
    }
});



// 優雅關閉處理
process.on('SIGINT', async () => {
    console.log('\n收到終止信號，正在關閉系統...');
    
    try {
        if (mqttClient) {
            mqttClient.close();
        }
        
        if (onvifService) {
            onvifService.cleanup();
        }
        
        if (databaseService) {
            await databaseService.close();
        }
        
        console.log('✅ 系統已安全關閉');
        process.exit(0);
    } catch (error) {
        console.error('❌ 關閉系統時發生錯誤:', error);
        process.exit(1);
    }
});

// 啟動系統
startServer();