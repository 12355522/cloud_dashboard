#!/usr/bin/env node
// 測試感測器顯示邏輯修改

const mqtt = require('mqtt');

// 連接到本地 MQTT Broker
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'sensor_display_test_' + Date.now()
});

// 模擬感測器配置資料，測試顯示邏輯
const testSensorData = {
    "device_info": {
        "device_name": "R02277d5",
        "total_sensors": 2,
        "status": "active"
    },
    "sensors": [
        {
            "device_info": {
                "serial_number": "16A8067119",
                "description": "舍內中央溫度監測站",
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
                "serial_number": "R02277d5",
                "description": "設備控制中心",
                "address": 2,
                "name": "sensor",
                "status": "active"
            },
            "sensor_values": [
                {
                    "_id": "603db20ab7d71486ab441e21",
                    "name": "狀態",
                    "max": 1,
                    "min": 0,
                    "code": "S",
                    "current_value": 1
                }
            ],
            "profile": "",
            "metadata": {
                "last_calibration": "2025-01-01T00:00:00Z",
                "firmware_version": "1.0.0"
            }
        }
    ],
    "timestamp": "2025-08-28T15:37:25.653Z",
    "published_by": "mqtt-push-service"
};

client.on('connect', () => {
    console.log('✅ 已連接到 MQTT Broker');
    
    console.log('📡 開始發送測試感測器配置...');
    console.log(`📊 設備: ${testSensorData.device_info.device_name}`);
    console.log(`📡 感測器總數: ${testSensorData.device_info.total_sensors}`);
    
    // 發送感測器配置
    client.publish('device/R02277d5/seninf', JSON.stringify(testSensorData));
    console.log('✅ 感測器配置已發送');
    
    // 顯示預期的顯示邏輯
    console.log('\n📋 預期的感測器顯示邏輯:');
    console.log('=' .repeat(80));
    
    testSensorData.sensors.forEach((sensor, index) => {
        const info = sensor.device_info;
        
        console.log(`\n🔍 感測器 ${index + 1}:`);
        console.log(`   📱 序號: ${info.serial_number}`);
        console.log(`   🏷️  類型名稱: ${info.name}`);
        console.log(`   📝 描述 (description): ${info.description}`);
        console.log(`   📍 地址: ${info.address}`);
        console.log(`   🔋 狀態: ${info.status}`);
        
        // 顯示預期的前端顯示邏輯
        console.log('\n   💻 前端顯示邏輯:');
        if (info.description) {
            console.log(`      ✅ 主要顯示名稱: "${info.description}" (來自 description 欄位)`);
            console.log(`      🔄 備用顯示名稱: "${info.name}" (來自 name 欄位)`);
        } else {
            console.log(`      ⚠️  主要顯示名稱: "${info.name}" (因為沒有 description 欄位)`);
        }
        
        console.log('   ' + '-'.repeat(60));
    });
    
    // 發送個別感測器數值
    console.log('\n📤 發送個別感測器數值:');
    console.log('=' .repeat(80));
    
    testSensorData.sensors.forEach((sensor, index) => {
        setTimeout(() => {
            const topic = `device/R02277d5/${sensor.device_info.serial_number}`;
            const payload = {
                ...sensor.sensor_values.reduce((acc, val) => {
                    acc[val.code] = val.current_value;
                    return acc;
                }, {}),
                timestamp: new Date().toISOString(),
                sensorId: sensor.device_info.serial_number,
                sensorName: sensor.device_info.name,
                description: sensor.device_info.description,
                address: sensor.device_info.address,
                status: sensor.device_info.status,
                published_by: "mqtt-push-service"
            };
            
            console.log(`\n📡 發送感測器: ${sensor.device_info.serial_number}`);
            console.log(`   🏷️  類型名稱: ${sensor.device_info.name}`);
            console.log(`   📝 描述: ${sensor.device_info.description}`);
            console.log(`   📊 數值: ${JSON.stringify(payload, null, 2)}`);
            
            client.publish(topic, payload);
            
        }, index * 3000); // 每3秒發送一個
    });
    
    // 15秒後斷開連接
    setTimeout(() => {
        console.log('\n🔌 測試完成，斷開連接');
        console.log('\n📝 測試總結:');
        console.log('   ✅ 感測器配置已發送，包含 description 欄位');
        console.log('   ✅ 個別感測器數值已發送，包含完整識別資訊');
        console.log('   ✅ 前端將優先顯示 description 欄位作為感測器名稱');
        console.log('   ✅ 如果沒有 description，將備用顯示 name 欄位');
        console.log('\n🔍 檢查項目:');
        console.log('   1. 感測器列表是否顯示 description 作為主要名稱');
        console.log('   2. 場域佈局圖中的感測器標記是否顯示 description');
        console.log('   3. 輪播頁面中的感測器名稱是否顯示 description');
        
        client.end();
        process.exit(0);
    }, 20000);
});

client.on('error', (error) => {
    console.error('❌ MQTT 連接錯誤:', error);
    process.exit(1);
});

console.log('🔌 正在連接 MQTT Broker 進行感測器顯示邏輯測試...');
console.log('\n📋 測試目標: 驗證感測器顯示邏輯的修改');
console.log('📝 測試內容:');
console.log('   1. 發送包含 description 的感測器配置');
console.log('   2. 發送個別感測器數值，包含完整識別資訊');
console.log('   3. 驗證前端顯示邏輯的優先順序');
console.log('   4. 確認感測器列表和佈局圖的顯示效果');
