const express = require('express');
const path = require('path');
const { engine } = require('express-handlebars');

const app = express();
const port = 3000;

// 基本中介軟體
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/snapshots', express.static(path.join(__dirname, 'public/snapshots')));
app.use('/streams', express.static(path.join(__dirname, 'public/streams')));

// 設定 Handlebars 模板引擎
app.engine('.hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

// 模擬攝影機資料
let discoveredCameras = [
    {
        ip: '192.168.1.45',
        port: 80,
        hostname: '192.168.1.45',
        connected: false,
        discovered: true,
        profiles: 0,
        hasStream: false,
        hasSnapshot: false,
        isStreaming: false,
        lastSnapshot: null
    }
];

// 頁面路由
app.get('/onvif-cameras', (req, res) => {
    res.render('onvif-cameras', {
        title: 'ONVIF攝影機管理',
        connectedCount: 0,
        streamingCount: 0,
        snapshotCount: 0
    });
});

// ONVIF API路由
app.post('/api/onvif/discover', (req, res) => {
    console.log('🔍 發現攝影機請求');
    res.json({
        success: true,
        cameras: discoveredCameras,
        message: `發現 ${discoveredCameras.length} 台攝影機`
    });
});

app.post('/api/onvif/test-connection', (req, res) => {
    const { ip, port = 80 } = req.body;
    console.log(`🔍 測試攝影機連接: ${ip}:${port}`);
    
    // 模擬網路測試
    const reachable = Math.random() > 0.3; // 70% 機率可達
    
    res.json({
        success: true,
        reachable: reachable,
        ip: ip,
        port: port,
        message: reachable ? '攝影機可達' : '攝影機不可達',
        error: reachable ? null : '網路超時'
    });
});

app.post('/api/onvif/connect', (req, res) => {
    const { ip, port, username, password } = req.body;
    console.log(`🔗 連接攝影機: ${ip}:${port}`);
    
    // 模擬連接過程
    setTimeout(() => {
        const success = Math.random() > 0.2; // 80% 機率成功
        
        if (success) {
            // 更新攝影機狀態
            const camera = discoveredCameras.find(cam => cam.ip === ip);
            if (camera) {
                camera.connected = true;
                camera.username = username;
                camera.password = password;
            }
            
            res.json({
                success: true,
                camera: {
                    ip: ip,
                    port: port,
                    info: { name: `攝影機 ${ip}` },
                    profiles: 2
                },
                message: '攝影機連接成功'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '連接失敗: 認證錯誤'
            });
        }
    }, 1000);
});

app.post('/api/onvif/disconnect/:ip', (req, res) => {
    const { ip } = req.params;
    console.log(`🔌 斷開攝影機: ${ip}`);
    
    // 更新攝影機狀態
    const camera = discoveredCameras.find(cam => cam.ip === ip);
    if (camera) {
        camera.connected = false;
    }
    
    res.json({
        success: true,
        message: '攝影機已斷開'
    });
});

app.post('/api/onvif/snapshot/:ip', (req, res) => {
    const { ip } = req.params;
    console.log(`📸 拍攝快照: ${ip}`);
    
    res.json({
        success: true,
        snapshot: {
            path: `/snapshots/snapshot_${ip}_${Date.now()}.jpg`,
            timestamp: new Date()
        },
        message: '快照拍攝成功'
    });
});

app.post('/api/onvif/stream/start/:ip', (req, res) => {
    const { ip } = req.params;
    console.log(`🎬 啟動串流: ${ip}`);
    
    // 更新攝影機狀態
    const camera = discoveredCameras.find(cam => cam.ip === ip);
    if (camera) {
        camera.isStreaming = true;
    }
    
    res.json({
        success: true,
        message: '串流啟動成功'
    });
});

app.post('/api/onvif/stream/stop/:ip', (req, res) => {
    const { ip } = req.params;
    console.log(`⏹️ 停止串流: ${ip}`);
    
    // 更新攝影機狀態
    const camera = discoveredCameras.find(cam => cam.ip === ip);
    if (camera) {
        camera.isStreaming = false;
    }
    
    res.json({
        success: true,
        message: '串流已停止'
    });
});

app.get('/api/onvif/status', (req, res) => {
    const connectedCount = discoveredCameras.filter(cam => cam.connected).length;
    const streamingCount = discoveredCameras.filter(cam => cam.isStreaming).length;
    const snapshotCount = discoveredCameras.filter(cam => cam.lastSnapshot).length;
    
    res.json({
        success: true,
        connectedCount: connectedCount,
        streamingCount: streamingCount,
        snapshotCount: snapshotCount,
        cameras: discoveredCameras
    });
});

// 其他必要路由
app.get('/', (req, res) => {
    res.redirect('/onvif-cameras');
});

app.get('/farms', (req, res) => {
    res.render('farms', { title: '場域管理' });
});

app.get('/carousel', (req, res) => {
    res.render('carousel', { title: '影像輪播' });
});

// 404錯誤處理
app.use((req, res) => {
    console.log(`❌ 404錯誤: ${req.method} ${req.url}`);
    res.status(404).render('error', { error: '頁面不存在' });
});

// 啟動伺服器
app.listen(port, () => {
    console.log(`🚀 簡化ONVIF伺服器啟動成功！`);
    console.log(`🌐 網址: http://localhost:${port}`);
    console.log(`📹 ONVIF管理: http://localhost:${port}/onvif-cameras`);
    console.log('');
    console.log('📋 可用的API端點:');
    console.log('  POST /api/onvif/discover - 發現攝影機');
    console.log('  POST /api/onvif/test-connection - 測試網路連接');
    console.log('  POST /api/onvif/connect - 連接攝影機');
    console.log('  POST /api/onvif/disconnect/:ip - 斷開攝影機');
    console.log('  POST /api/onvif/snapshot/:ip - 拍攝快照');
    console.log('  POST /api/onvif/stream/start/:ip - 啟動串流');
    console.log('  POST /api/onvif/stream/stop/:ip - 停止串流');
    console.log('  GET  /api/onvif/status - 獲取狀態');
    console.log('');
    console.log('🧪 測試命令:');
    console.log(`curl -X POST http://localhost:${port}/api/onvif/test-connection -H "Content-Type: application/json" -d '{"ip":"192.168.1.45"}'`);
});
