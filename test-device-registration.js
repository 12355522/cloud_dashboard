#!/usr/bin/env node
// 設備註冊測試工具

const mqtt = require('mqtt');

// 連接到本地 MQTT Broker
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'device_registration_test_' + Date.now()
});

client.on('connect', () => {
    console.log('✅ 已連接到 MQTT Broker');
    
    console.log('📡 模擬設備註冊...');
    
    // 模擬不同設備的註冊訊息
    const devices = [
        {
            deviceSN: 'FARM001_TEMP_01',
            ip: '192.168.1.100'
        },
        {
            deviceSN: 'FARM001_HUM_01', 
            ip: '192.168.1.101'
        },
        {
            deviceSN: 'FARM002_FAN_01',
            ip: '192.168.1.102'
        },
        {
            deviceSN: 'FARM002_WATER_01',
            ip: '192.168.1.103'
        }
    ];
    
    // 依序註冊設備
    devices.forEach((device, index) => {
        setTimeout(() => {
            console.log(`📱 註冊設備: ${device.deviceSN} (IP: ${device.ip})`);
            client.publish('device/name', JSON.stringify(device));
        }, index * 2000); // 每2秒註冊一個設備
    });
    
    // 5秒後開始發送設備資料
    setTimeout(() => {
        console.log('📊 開始發送設備資料...');
        
        devices.forEach((device, index) => {
            // 感測器資料
            const sensorData = {
                temperature: 20 + Math.random() * 15,
                humidity: 50 + Math.random() * 30,
                timestamp: new Date().toISOString()
            };
            
            // 設備資訊
            const deviceInfo = {
                feeding_days: Math.floor(Math.random() * 60),
                device_number: device.deviceSN,
                fan_count: Math.floor(Math.random() * 5) + 1
            };
            
            // 控制狀態
            const nodeInfo = {
                status: 'online',
                controls: {
                    fan: Math.random() > 0.5 ? 'on' : 'off',
                    feeder: 'auto',
                    water: 'on'
                }
            };
            
            setTimeout(() => {
                client.publish(`device/${device.deviceSN}/seninf`, JSON.stringify(sensorData));
                client.publish(`device/${device.deviceSN}/deviceinf`, JSON.stringify(deviceInfo));
                client.publish(`device/${device.deviceSN}/nodeinf`, JSON.stringify(nodeInfo));
                
                console.log(`📤 已發送 ${device.deviceSN} 的資料`);
            }, index * 1000);
        });
    }, 10000);
    
    // 20秒後斷開連接
    setTimeout(() => {
        console.log('🔌 測試完成，斷開連接');
        client.end();
        process.exit(0);
    }, 25000);
});

client.on('error', (error) => {
    console.error('❌ MQTT 連接錯誤:', error);
    process.exit(1);
});

console.log('🔌 正在連接 MQTT Broker 進行設備註冊測試...');
