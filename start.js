// 設定環境變數並啟動系統
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/livestock_management';
process.env.MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// 載入主程式
require('./server.js');
