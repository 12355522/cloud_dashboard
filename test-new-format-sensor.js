#!/usr/bin/env node
// 新格式感測器配置測試工具

const mqtt = require('mqtt');

// 連接到本地 MQTT Broker
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'new_format_sensor_test_' + Date.now()
});

// 模擬新格式的感測器配置資料
const newFormatSensorData = {
    "device_info": {
        "device_name": "R02b5165",
        "total_sensors": 9,
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
            "sensor_values": [
                {
                    "_id": "603db20ab7d71486ab441e20",
                    "name": "溫度",
                    "max": 60,
                    "min": -1,
                    "code": "A",
                    "current_value": 25.5
                }
            ],
            "profile": "",
            "metadata": {
                "last_calibration": "2025-01-01T00:00:00Z",
                "firmware_version": "1.2.3"
            }
        },
        {
            "device_info": {
                "serial_number": "08A5384303",
                "description": "水錶",
                "address": 8,
                "name": "飲用水量感測器",
                "status": "active"
            },
            "sensor_values": [
                {
                    "_id": "603e027b99f69104f0df97f3",
                    "name": "飲用水量",
                    "max": 200000,
                    "min": 0,
                    "code": "L",
                    "current_value": 1250.75
                }
            ],
            "profile": "",
            "metadata": {
                "last_calibration": "2025-01-15T00:00:00Z",
                "firmware_version": "2.1.0"
            }
        },
        {
            "device_info": {
                "serial_number": "11A5388520",
                "description": "舍內前溫濕度",
                "address": 3,
                "name": "溫濕度感測器",
                "status": "active"
            },
            "sensor_values": [
                {
                    "_id": "5e7086ad64feec388ea70959",
                    "name": "溫度",
                    "max": 42,
                    "min": 5,
                    "code": "A",
                    "current_value": 28.3
                },
                {
                    "_id": "5e7086ad64feec388ea70958",
                    "name": "濕度",
                    "max": 95,
                    "min": 10,
                    "code": "B",
                    "current_value": 65.2
                }
            ],
            "profile": "let arg1 = data.buffer.readInt16BE(0, 2) / 10; let arg2 = data.buffer.readUInt16BE(2, 4) / 10; sdata = { B: arg1, A: arg2};",
            "metadata": {
                "last_calibration": "2024-12-20T00:00:00Z",
                "firmware_version": "1.5.2"
            }
        },
        {
            "device_info": {
                "serial_number": "21A5384746",
                "description": "二氧化碳",
                "address": 6,
                "name": "二氧化碳感測器",
                "status": "active"
            },
            "sensor_values": [
                {
                    "_id": "603db20ab7d71486ab441e20",
                    "name": "二氧化碳",
                    "max": 10000,
                    "min": 200,
                    "code": "C",
                    "current_value": 850
                }
            ],
            "profile": "",
            "metadata": {
                "last_calibration": "2024-11-30T00:00:00Z",
                "firmware_version": "1.0.8"
            }
        },
        {
            "device_info": {
                "serial_number": "17A5381690",
                "description": "壓差計",
                "address": 7,
                "name": "負壓感測器",
                "status": "active"
            },
            "sensor_values": [
                {
                    "_id": "603db20ab7d71486ab441e20",
                    "name": "負壓",
                    "max": 100,
                    "min": -1,
                    "code": "S",
                    "current_value": -15.2
                }
            ],
            "profile": "",
            "metadata": {
                "last_calibration": "2025-01-10T00:00:00Z",
                "firmware_version": "1.1.5"
            }
        },
        {
            "device_info": {
                "serial_number": "15A5388078",
                "description": "風速計",
                "address": 9,
                "name": "風速感測器",
                "status": "active"
            },
            "sensor_values": [
                {
                    "_id": "603db20ab7d71486ab441e20",
                    "name": "風速",
                    "max": 60,
                    "min": -1,
                    "code": "R",
                    "current_value": 2.8
                }
            ],
            "profile": "",
            "metadata": {
                "last_calibration": "2024-12-05T00:00:00Z",
                "firmware_version": "1.3.1"
            }
        }
    ],
    "timestamp": "2025-08-28T15:37:25.653Z",
    "published_by": "mqtt-push-service"
};

client.on('connect', () => {
    console.log('✅ 已連接到 MQTT Broker');
    
    console.log('📡 模擬新格式設備註冊...');
    
    // 先註冊設備
    const deviceRegistration = {
        deviceSN: 'R02b5165',
        ip: '192.168.1.165'
    };
    
    client.publish('device/name', JSON.stringify(deviceRegistration));
    console.log('📱 已註冊設備:', deviceRegistration.deviceSN);
    
    // 等待2秒後發送新格式感測器配置
    setTimeout(() => {
        console.log('🔧 發送新格式感測器配置資料...');
        console.log(`📊 設備: ${newFormatSensorData.device_info.device_name}`);
        console.log(`📡 感測器總數: ${newFormatSensorData.device_info.total_sensors}`);
        console.log(`🔋 設備狀態: ${newFormatSensorData.device_info.status}`);
        console.log(`⏰ 時間戳記: ${newFormatSensorData.timestamp}`);
        
        client.publish('device/R02b5165/seninf', JSON.stringify(newFormatSensorData));
        console.log('✅ 新格式感測器配置已發送');
        
        // 顯示感測器資訊
        console.log('\n📋 感測器列表:');
        newFormatSensorData.sensors.forEach((sensor, index) => {
            const info = sensor.device_info;
            console.log(`  ${index + 1}. ${info.name} (${info.serial_number})`);
            console.log(`     - 描述: ${info.description}`);
            console.log(`     - 地址: ${info.address}, 狀態: ${info.status}`);
            console.log(`     - 數值: ${sensor.sensor_values.map(v => `${v.name}=${v.current_value}`).join(', ')}`);
        });
        
    }, 2000);
    
    // 12秒後斷開連接
    setTimeout(() => {
        console.log('\n🔌 測試完成，斷開連接');
        client.end();
        process.exit(0);
    }, 15000);
});

client.on('error', (error) => {
    console.error('❌ MQTT 連接錯誤:', error);
    process.exit(1);
});

console.log('🔌 正在連接 MQTT Broker 進行新格式感測器配置測試...');
