#!/usr/bin/env node
// MQTT 測試工具

const mqtt = require('mqtt');

// 連接到本地 MQTT Broker
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'mqtt_test_' + Date.now()
});

client.on('connect', () => {
    console.log('✅ 已連接到 MQTT Broker');
    
    // 測試發布一些範例訊息
    console.log('📤 發送測試訊息...');
    
    // 模擬感測器資料
    const sensorData = {
        temperature: 25.5,
        humidity: 60.2,
        timestamp: new Date().toISOString()
    };
    
    // 模擬設備資訊
    const deviceInfo = {
        feeding_days: 30,
        device_number: 'DEV001',
        fan_count: 4
    };
    
    // 模擬控制設備狀態
    const nodeInfo = {
        status: 'online',
        controls: {
            fan: 'on',
            feeder: 'auto',
            water: 'on'
        }
    };
    
    // 發布測試訊息
    client.publish('device/farm001/seninf', JSON.stringify(sensorData));
    client.publish('device/farm001/deviceinf', JSON.stringify(deviceInfo));
    client.publish('device/farm001/nodeinf', JSON.stringify(nodeInfo));
    
    console.log('📨 測試訊息已發送');
    
    // 5秒後斷開連接
    setTimeout(() => {
        console.log('🔌 斷開連接');
        client.end();
        process.exit(0);
    }, 5000);
});

client.on('error', (error) => {
    console.error('❌ MQTT 連接錯誤:', error);
    process.exit(1);
});

client.on('message', (topic, message) => {
    console.log(`📩 收到訊息: ${topic} -> ${message.toString()}`);
});

console.log('🔌 正在連接 MQTT Broker...');
