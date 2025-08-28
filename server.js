const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// 載入設定和服務
const config = require('./config');
const databaseService = require('./services/database');
const mqttBroker = require('./services/mqttBroker');
const mqttClient = require('./services/mqttClient');
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

// 錯誤處理頁面
app.use((req, res) => {
    res.status(404).render('error', { error: '頁面不存在' });
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

// 優雅關閉處理
process.on('SIGINT', async () => {
    console.log('\n收到終止信號，正在關閉系統...');
    
    try {
        if (mqttClient) {
            mqttClient.close();
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