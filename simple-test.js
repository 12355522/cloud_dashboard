#!/usr/bin/env node
// 簡化測試

const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883', { clientId: 'simple_test' });

const testData = {
    "device_info": {
        "device_name": "R02b5165",
        "total_sensors": 2,
        "status": "active"
    },
    "sensors": [
        {
            "device_info": {
                "serial_number": "16A0885024",
                "description": "後溫度",
                "address": 1,
                "name": "溫度感測器",
                "status": "active"
            },
            "sensor_values": [],
            "profile": "",
            "metadata": {}
        }
    ],
    "timestamp": "2025-08-28T15:37:25.653Z"
};

client.on('connect', () => {
    console.log('Connected to MQTT');
    
    // 發送測試訊息
    client.publish('device/R02b5165/seninf', JSON.stringify(testData));
    console.log('Test message sent');
    
    setTimeout(() => {
        client.end();
        process.exit(0);
    }, 3000);
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
    process.exit(1);
});
