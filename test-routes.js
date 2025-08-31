const express = require('express');
const app = express();

// 測試路由
app.post('/api/onvif/test-connection', (req, res) => {
    res.json({
        success: true,
        message: '測試路由工作正常'
    });
});

app.listen(3001, () => {
    console.log('測試伺服器啟動在端口 3001');
});
