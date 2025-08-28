#!/usr/bin/env node
// 個別感測器數值測試工具

const mqtt = require('mqtt');

// 連接到本地 MQTT Broker
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'individual_sensor_test_' + Date.now()
});

// 模擬個別感測器數值訊息
const sensorDataMessages = [
    {
        topic: 'device/R02b5165/16A5388982',
        payload: {
            "A": 32.9,
            "timestamp": "2025-08-28T15:37:25.653Z",
            "sensorId": "16A5388982",
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
    },
    {
        topic: 'device/R02b5165/17A5381690',
        payload: {
            "S": -15.2,
            "timestamp": "2025-08-28T15:37:45.012Z",
            "sensorId": "17A5381690",
            "published_by": "mqtt-push-service"
        }
    },
    {
        topic: 'device/R02b5165/15A5388078',
        payload: {
            "R": 2.8,
            "timestamp": "2025-08-28T15:37:50.345Z",
            "sensorId": "15A5388078",
            "published_by": "mqtt-push-service"
        }
    }
];

client.on('connect', () => {
    console.log('✅ 已連接到 MQTT Broker');
    
    console.log('📊 開始發送個別感測器數值訊息...');
    console.log(`📡 準備發送 ${sensorDataMessages.length} 個感測器的數值`);
    
    // 依序發送感測器數值
    sensorDataMessages.forEach((message, index) => {
        setTimeout(() => {
            const topic = message.topic;
            const sensorId = topic.split('/')[2];
            const payload = JSON.stringify(message.payload);
            
            console.log(`\n📤 發送感測器 ${sensorId} 的數值:`);
            console.log(`   主題: ${topic}`);
            console.log(`   數值: ${Object.entries(message.payload)
                .filter(([key]) => !['timestamp', 'sensorId', 'published_by'].includes(key))
                .map(([code, value]) => `${code}=${value}`)
                .join(', ')}`);
            
            client.publish(topic, payload);
            
        }, index * 2000); // 每2秒發送一個
    });
    
    // 15秒後斷開連接
    setTimeout(() => {
        console.log('\n🔌 測試完成，斷開連接');
        client.end();
        process.exit(0);
    }, 20000);
});

client.on('error', (error) => {
    console.error('❌ MQTT 連接錯誤:', error);
    process.exit(1);
});

console.log('🔌 正在連接 MQTT Broker 進行個別感測器數值測試...');
console.log('\n📋 測試感測器列表:');
sensorDataMessages.forEach((msg, i) => {
    const sensorId = msg.topic.split('/')[2];
    const values = Object.entries(msg.payload)
        .filter(([key]) => !['timestamp', 'sensorId', 'published_by'].includes(key))
        .map(([code, value]) => `${code}=${value}`)
        .join(', ');
    console.log(`  ${i + 1}. ${sensorId}: ${values}`);
});
