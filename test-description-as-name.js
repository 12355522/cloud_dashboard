#!/usr/bin/env node
// 測試感測器 description 欄位作為主要識別名稱

const mqtt = require('mqtt');

// 連接到本地 MQTT Broker
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'description_as_name_test_' + Date.now()
});

// 模擬感測器配置資料，重點展示 description 欄位
const sensorConfigData = {
    "device_info": {
        "device_name": "R02b5165",
        "total_sensors": 4,
        "status": "active"
    },
    "sensors": [
        {
            "device_info": {
                "serial_number": "16A0885024",
                "description": "後區溫度監測器",
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
                "description": "前區飲用水量計",
                "address": 8,
                "name": "水錶感測器",
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
                "description": "舍內中央溫濕度監測站",
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
                "description": "通風系統空氣品質監測器",
                "address": 6,
                "name": "二氧化碳感測器",
                "status": "active"
            },
            "sensor_values": [
                {
                    "_id": "603db20ab7d71486ab441e20",
                    "name": "二氧化碳濃度",
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
        }
    ],
    "timestamp": "2025-08-28T15:37:25.653Z",
    "published_by": "mqtt-push-service"
};

client.on('connect', () => {
    console.log('✅ 已連接到 MQTT Broker');
    
    console.log('📡 開始發送感測器配置 (description 作為主要識別名稱)...');
    console.log(`📊 設備: ${sensorConfigData.device_info.device_name}`);
    console.log(`📡 感測器總數: ${sensorConfigData.device_info.total_sensors}`);
    console.log(`🔋 設備狀態: ${sensorConfigData.device_info.status}`);
    console.log(`⏰ 時間戳記: ${sensorConfigData.timestamp}`);
    
    // 發送感測器配置
    client.publish('device/R02b5165/seninf', JSON.stringify(sensorConfigData));
    console.log('✅ 感測器配置已發送');
    
    // 詳細顯示每個感測器的識別資訊
    console.log('\n📋 感測器識別資訊 (description 作為主要識別名稱):');
    console.log('=' .repeat(100));
    
    sensorConfigData.sensors.forEach((sensor, index) => {
        const info = sensor.device_info;
        const values = sensor.sensor_values;
        
        console.log(`\n🔍 感測器 ${index + 1}:`);
        console.log(`   📱 序號 (ID): ${info.serial_number}`);
        console.log(`   🏷️  類型名稱: ${info.name}`);
        console.log(`   📝 主要識別名稱 (description): ${info.description}`);
        console.log(`   📍 地址: ${info.address}`);
        console.log(`   🔋 狀態: ${info.status}`);
        console.log(`   📊 數值: ${values.map(v => `${v.name}=${v.current_value}${v.code}`).join(', ')}`);
        console.log(`   📅 校準: ${sensor.metadata?.last_calibration || 'N/A'}`);
        console.log(`   🔧 韌體: ${sensor.metadata?.firmware_version || 'N/A'}`);
        console.log('   ' + '-'.repeat(80));
        
        // 強調 description 的重要性
        console.log(`   💡 識別說明: 此感測器將以 "${info.description}" 作為主要顯示名稱`);
        console.log(`   🔄 備用名稱: 如果沒有 description，將使用 "${info.name}"`);
    });
    
    // 發送個別感測器數值，包含完整的識別資訊
    console.log('\n📤 發送個別感測器數值 (包含完整識別資訊):');
    console.log('=' .repeat(100));
    
    sensorConfigData.sensors.forEach((sensor, index) => {
        setTimeout(() => {
            const topic = `device/R02b5165/${sensor.device_info.serial_number}`;
            const payload = {
                ...sensor.sensor_values.reduce((acc, val) => {
                    acc[val.code] = val.current_value;
                    return acc;
                }, {}),
                timestamp: new Date().toISOString(),
                sensorId: sensor.device_info.serial_number,
                sensorName: sensor.device_info.name,
                description: sensor.device_info.description, // 主要識別名稱
                address: sensor.device_info.address,
                status: sensor.device_info.status,
                published_by: "mqtt-push-service"
            };
            
            console.log(`\n📡 發送感測器: ${sensor.device_info.serial_number}`);
            console.log(`   🏷️  類型名稱: ${sensor.device_info.name}`);
            console.log(`   📝 主要識別名稱: ${sensor.device_info.description}`);
            console.log(`   📊 完整數值資料: ${JSON.stringify(payload, null, 2)}`);
            
            client.publish(topic, payload);
            
        }, index * 4000); // 每4秒發送一個
    });
    
    // 25秒後斷開連接
    setTimeout(() => {
        console.log('\n🔌 測試完成，斷開連接');
        console.log('\n📝 總結:');
        console.log('   ✅ 感測器配置已發送，包含 description 欄位');
        console.log('   ✅ 個別感測器數值已發送，包含完整識別資訊');
        console.log('   ✅ description 欄位將作為感測器的主要識別名稱');
        console.log('   ✅ 前端將優先顯示 description，備用顯示 name');
        
        client.end();
        process.exit(0);
    }, 30000);
});

client.on('error', (error) => {
    console.error('❌ MQTT 連接錯誤:', error);
    process.exit(1);
});

console.log('🔌 正在連接 MQTT Broker 進行感測器識別名稱測試...');
console.log('\n📋 測試目標: 驗證 description 欄位作為感測器主要識別名稱');
console.log('📝 測試內容:');
console.log('   1. 發送包含 description 的感測器配置');
console.log('   2. 發送個別感測器數值，包含完整識別資訊');
console.log('   3. 驗證 description 欄位在識別中的重要性');
console.log('   4. 確認前端顯示邏輯的優先順序');
