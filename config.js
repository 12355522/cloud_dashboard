// 系統配置檔案
const dotenv = require('dotenv');
const path = require('path'); // 新增 path 模組

dotenv.config();

const config = {
    server: {
        port: process.env.PORT || 3000
    },
    database: {
        url: process.env.DB_URL || 'mongodb://localhost:27017/livestock_management'
    },
    mqtt: {
        broker: process.env.MQTT_BROKER || 'mqtt://localhost',
        brokerPort: process.env.MQTT_PORT || 1883
    },
    // 新增 FFmpeg 設定
    ffmpeg: {
        path: process.env.FFMPEG_PATH || '' // 留空，優先使用 install-ffmpeg.js 的路徑
    }
};

module.exports = config;
