#!/usr/bin/env node
// 感測器配置測試工具

const mqtt = require('mqtt');

// 連接到本地 MQTT Broker
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'sensor_config_test_' + Date.now()
});

// 模擬真實的感測器配置資料
const sensorConfigData = [
    {
        "SN": "16A5381722",
        "DES": "\\xe5\\xbe\\x8c\\xe6\\xba\\xab\\xe5\\xba\\xa6",
        "ADDRESS": 1,
        "value": [{
            "_id": "603db20ab7d71486ab441e20",
            "name": "\\xe6\\xba\\xab\\xe5\\xba\\xa6",
            "max": 60,
            "min": -1,
            "code": "A"
        }],
        "name": "\\xe6\\xba\\xab\\xe5\\xba\\xa6\\xe6\\x84\\x9f\\xe6\\xb8\\xac\\xe5\\x99\\xa8",
        "profile": ""
    },
    {
        "SN": "16A5388982",
        "DES": "\\xe5\\x89\\x8d\\xe6\\xba\\xab\\xe5\\xba\\xa6",
        "ADDRESS": 2,
        "value": [{
            "_id": "603db20ab7d71486ab441e20",
            "name": "\\xe6\\xba\\xab\\xe5\\xba\\xa6",
            "max": 60,
            "min": -1,
            "code": "A"
        }],
        "name": "\\xe6\\xba\\xab\\xe5\\xba\\xa6\\xe6\\x84\\x9f\\xe6\\xb8\\xac\\xe5\\x99\\xa8",
        "profile": ""
    },
    {
        "SN": "11A5388520",
        "DES": "\\xe8\\x88\\x8d\\xe5\\x85\\xa7\\xe5\\x89\\x8d\\xe6\\xba\\xab\\xe6\\xbf\\x95\\xe5\\xba\\xa6",
        "ADDRESS": 3,
        "value": [
            {
                "_id": "5e7086ad64feec388ea70959",
                "name": "\\xe6\\xba\\xab\\xe5\\xba\\xa6",
                "max": 42,
                "min": 5,
                "code": "A"
            },
            {
                "_id": "5e7086ad64feec388ea70958",
                "name": "\\xe6\\xbf\\x95\\xe5\\xba\\xa6",
                "max": 95,
                "min": 10,
                "code": "B"
            }
        ],
        "name": "\\xe6\\xba\\xab\\xe6\\xbf\\x95\\xe5\\xba\\xa6\\xe6\\x84\\x9f\\xe6\\xb8\\xac\\xe5\\x99\\xa8",
        "profile": "let arg1 = data.buffer.readInt16BE(0, 2) / 10; let arg2 = data.buffer.readUInt16BE(2, 4) / 10; sdata = { B: arg1, A: arg2};"
    },
    {
        "SN": "11A5380466",
        "DES": "\\xe8\\x88\\x8d\\xe5\\x85\\xa7\\xe5\\xbe\\x8c\\xe6\\xba\\xab\\xe6\\xbf\\x95\\xe5\\xba\\xa6",
        "ADDRESS": 4,
        "value": [
            {
                "_id": "5e7086ad64feec388ea70959",
                "name": "\\xe6\\xba\\xab\\xe5\\xba\\xa6",
                "max": 42,
                "min": 5,
                "code": "A"
            },
            {
                "_id": "5e7086ad64feec388ea70958",
                "name": "\\xe6\\xbf\\x95\\xe5\\xba\\xa6",
                "max": 95,
                "min": 10,
                "code": "B"
            }
        ],
        "name": "\\xe6\\xba\\xab\\xe6\\xbf\\x95\\xe5\\xba\\xa6\\xe6\\x84\\x9f\\xe6\\xb8\\xac\\xe5\\x99\\xa8",
        "profile": "let arg1 = data.buffer.readInt16BE(0, 2) / 10; let arg2 = data.buffer.readUInt16BE(2, 4) / 10; sdata = { B: arg1, A: arg2};"
    },
    {
        "SN": "21A5384746",
        "DES": "\\xe4\\xba\\x8c\\xe6\\xb0\\xa7\\xe5\\x8c\\x96\\xe7\\xa2\\xb3",
        "ADDRESS": 6,
        "value": [{
            "_id": "603db20ab7d71486ab441e20",
            "name": "\\xe4\\xba\\x8c\\xe6\\xb0\\xa7\\xe5\\x8c\\x96\\xe7\\xa2\\xb3",
            "max": 10000,
            "min": 200,
            "code": "C"
        }],
        "name": "\\xe4\\xba\\x8c\\xe6\\xb0\\xa7\\xe5\\x8c\\x96\\xe7\\xa2\\xb3",
        "profile": ""
    },
    {
        "SN": "17A5381690",
        "DES": "\\xe5\\xa3\\x93\\xe5\\xb7\\xae\\xe8\\xa8\\x88",
        "ADDRESS": 7,
        "value": [{
            "_id": "603db20ab7d71486ab441e20",
            "name": "\\xe8\\xb2\\xa0\\xe5\\xa3\\x93",
            "max": 100,
            "min": -1,
            "code": "S"
        }],
        "name": "\\xe8\\xb2\\xa0\\xe5\\xa3\\x93\\xe6\\x84\\x9f\\xe6\\xb8\\xac\\xe5\\x99\\xa8",
        "profile": ""
    },
    {
        "SN": "15A5388078",
        "DES": "\\xe9\\xa2\\xa8\\xe9\\x80\\x9f\\xe8\\xa8\\x88",
        "ADDRESS": 9,
        "value": [{
            "_id": "603db20ab7d71486ab441e20",
            "name": "\\xe9\\xa2\\xa8\\xe9\\x80\\x9f",
            "max": 60,
            "min": -1,
            "code": "R"
        }],
        "name": "\\xe9\\xa2\\xa8\\xe9\\x80\\x9f\\xe6\\x84\\x9f\\xe6\\xb8\\xac\\xe5\\x99\\xa8",
        "profile": ""
    },
    {
        "SN": "08A5384303",
        "DES": "\\xe6\\xb0\\xb4\\xe9\\x8c\\xb6",
        "ADDRESS": 8,
        "value": [{
            "_id": "603e027b99f69104f0df97f3",
            "name": "\\xe9\\xa3\\xb2\\xe7\\x94\\xa8\\xe6\\xb0\\xb4\\xe9\\x87\\x8f",
            "max": 200000,
            "min": 0,
            "code": "L"
        }],
        "name": "\\xe9\\xa3\\xb2\\xe7\\x94\\xa8\\xe6\\xb0\\xb4\\xe9\\x87\\x8f\\xe6\\x84\\x9f\\xe6\\xb8\\xac\\xe5\\x99\\xa8",
        "profile": ""
    }
];

client.on('connect', () => {
    console.log('✅ 已連接到 MQTT Broker');
    
    console.log('📡 模擬設備註冊...');
    
    // 先註冊設備
    const deviceRegistration = {
        deviceSN: 'FARM_CONTROLLER_01',
        ip: '192.168.1.200'
    };
    
    client.publish('device/name', JSON.stringify(deviceRegistration));
    console.log('📱 已註冊設備:', deviceRegistration.deviceSN);
    
    // 等待2秒後發送感測器配置
    setTimeout(() => {
        console.log('🔧 發送感測器配置資料...');
        console.log(`📊 包含 ${sensorConfigData.length} 個感測器配置`);
        
        client.publish('device/FARM_CONTROLLER_01/seninf', JSON.stringify(sensorConfigData));
        console.log('✅ 感測器配置已發送');
        
        // 顯示感測器資訊
        sensorConfigData.forEach((sensor, index) => {
            console.log(`  ${index + 1}. SN: ${sensor.SN}, 地址: ${sensor.ADDRESS}`);
        });
        
    }, 2000);
    
    // 10秒後斷開連接
    setTimeout(() => {
        console.log('🔌 測試完成，斷開連接');
        client.end();
        process.exit(0);
    }, 15000);
});

client.on('error', (error) => {
    console.error('❌ MQTT 連接錯誤:', error);
    process.exit(1);
});

console.log('🔌 正在連接 MQTT Broker 進行感測器配置測試...');
