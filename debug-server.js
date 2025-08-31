const express = require('express');
const app = express();

// 基本中介軟體
app.use(express.json());
app.use(express.static('public'));

// 簡單的ONVIF測試路由
app.post('/api/onvif/test-connection', (req, res) => {
    console.log('🔍 測試路由被調用');
    res.json({
        success: true,
        message: 'ONVIF測試路由工作正常'
    });
});

app.post('/api/onvif/discover', (req, res) => {
    console.log('🔍 發現路由被調用');
    res.json({
        success: true,
        cameras: [],
        message: 'ONVIF發現路由工作正常'
    });
});

// 404處理器
app.use((req, res) => {
    console.log('❌ 404錯誤:', req.method, req.url);
    res.status(404).json({
        error: '頁面不存在',
        method: req.method,
        url: req.url
    });
});

const port = 3002;
app.listen(port, () => {
    console.log(`🚀 調試伺服器啟動在端口 ${port}`);
    console.log('測試命令:');
    console.log(`curl -X POST http://localhost:${port}/api/onvif/test-connection -H "Content-Type: application/json" -d '{"ip":"192.168.1.42"}'`);
});
