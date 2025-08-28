// 系統配置檔案
try {
    require('dotenv').config();
} catch (error) {
    // dotenv 檔案不存在時繼續運行
}

module.exports = {
    // MongoDB 設定
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/livestock_management'
    },
    
    // MQTT 設定
    mqtt: {
        // MQTT Broker 設定
        brokerPort: process.env.MQTT_BROKER_PORT || 1883,
        brokerHost: process.env.MQTT_BROKER_HOST || '0.0.0.0',
        
        // MQTT Client 設定
        broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
        username: process.env.MQTT_USERNAME || '',
        password: process.env.MQTT_PASSWORD || '',
        options: {
            clientId: 'livestock_management_' + Date.now(),
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            will: {
                topic: 'WillMsg',
                payload: 'Connection Closed abnormally..!',
                qos: 0,
                retain: false
            }
        }
    },
    
    // 伺服器設定
    server: {
        port: process.env.PORT || 3000
    },
    
    // 系統設定
    system: {
        env: process.env.NODE_ENV || 'development'
    }
};
