#!/usr/bin/env node
// 使用正確感測器ID的個別感測器數值測試

const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883', { clientId: 'correct_sensor_test_' + Date.now() });

// 使用正確的感測器ID
const sensorDataMessages = [
    {
        topic: 'device/R02b5165/16A0885024',
        payload: {
            "A": 32.9,
            "timestamp": "2025-08-28T15:37:25.653Z",
            "sensorId": "16A0885024",
            "published_by": "mqtt-push-service"
        }
    },
    {
        topic: 'device/R02b5165/11A5388520',
        payload: {
            "A": 28.3,
            "B": 65.2,
            "timestamp": "2025-08-28T15:37:30.123Z",
            "sensorId": "11A5388520",
            "published_by": "mqtt-push-service"
        }
    },
    {
        topic: 'device/R02b5165/21A5384746',
        payload: {
            "C": 850,
            "timestamp": "2025-08-28T15:37:35.456Z",
            "sensorId": "21A5384746",
            "published_by": "mqtt-push-service"
        }
    },
    {
        topic: 'device/R02b5165/08A5384303',
        payload: {
            "L": 1250.75,
            "timestamp": "2025-08-28T15:37:40.789Z",
            "sensorId": "08A5384303",
            "published_by": "mqtt-push-service"
        }
    }
];

client.on('connect', () => {
    console.log('✅ 已連接到 MQTT Broker');
    console.log('📊 使用正確的感測器ID發送數值...');
    
    sensorDataMessages.forEach((message, index) => {
        setTimeout(() => {
            const sensorId = message.topic.split('/')[2];
            const values = Object.entries(message.payload)
                .filter(([key]) => !['timestamp', 'sensorId', 'published_by'].includes(key))
                .map(([code, value]) => `${code}=${value}`)
                .join(', ');
                
            console.log(`📤 發送感測器 ${sensorId}: ${values}`);
            client.publish(message.topic, JSON.stringify(message.payload));
            
        }, index * 2000);
    });
    
    setTimeout(() => {
        console.log('🔌 測試完成，斷開連接');
        client.end();
        process.exit(0);
    }, 12000);
});

client.on('error', (err) => {
    console.error('❌ MQTT 錯誤:', err);
    process.exit(1);
});

console.log('🔌 正在連接到 MQTT Broker...');
