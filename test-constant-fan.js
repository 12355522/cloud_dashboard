#!/usr/bin/env node
// 定頻風扇控制測試工具

const mqtt = require('mqtt');

// 連接到本地 MQTT Broker
const client = mqtt.connect('mqtt://localhost:1883', {
    clientId: 'constant_fan_test_' + Date.now()
});

client.on('connect', () => {
    console.log('✅ 已連接到 MQTT Broker');
    
    // 訂閱控制指令主題
    const deviceNumber = 'DEV001';
    const controlTopic = `device/${deviceNumber}/control`;
    
    client.subscribe(controlTopic, (err) => {
        if (err) {
            console.error('❌ 訂閱失敗:', err);
        } else {
            console.log(`📡 已訂閱控制主題: ${controlTopic}`);
        }
    });
    
    // 模擬發送溫度感測器資料
    console.log('📊 開始發送模擬溫度資料...');
    
    let temperature = 20; // 起始溫度
    let isHeating = true; // 模擬溫度變化方向
    
    const temperatureInterval = setInterval(() => {
        // 模擬溫度變化
        if (isHeating) {
            temperature += 0.5;
            if (temperature >= 35) {
                isHeating = false;
            }
        } else {
            temperature -= 0.3;
            if (temperature <= 18) {
                isHeating = true;
            }
        }
        
        const sensorData = {
            temperature: parseFloat(temperature.toFixed(1)),
            humidity: 60 + Math.random() * 20,
            timestamp: new Date().toISOString(),
            published_by: '11A001'
        };
        
        // 發送到感測器主題
        client.publish(`device/${deviceNumber}/11A001`, JSON.stringify(sensorData));
        console.log(`🌡️  當前溫度: ${sensorData.temperature}°C`);
        
    }, 3000); // 每3秒更新一次溫度
    
    // 模擬CO2感測器資料
    const co2Interval = setInterval(() => {
        const co2Data = {
            co2: Math.floor(400 + Math.random() * 1200), // 400-1600 ppm
            timestamp: new Date().toISOString(),
            published_by: '21A001'
        };
        
        client.publish(`device/${deviceNumber}/21A001`, JSON.stringify(co2Data));
        console.log(`💨 CO2濃度: ${co2Data.co2} ppm`);
        
    }, 5000); // 每5秒更新一次CO2
    
    // 30秒後清理並結束
    setTimeout(() => {
        clearInterval(temperatureInterval);
        clearInterval(co2Interval);
        console.log('🔌 測試完成，斷開連接');
        client.end();
        process.exit(0);
    }, 30000);
});

// 監聽接收到的控制指令
client.on('message', (topic, message) => {
    try {
        const controlData = JSON.parse(message.toString());
        console.log('🎛️  收到控制指令:', {
            主題: topic,
            設備: controlData.device,
            類型: controlData.type,
            設定: {
                開啟溫度: controlData.settings?.startTemp,
                關閉溫度: controlData.settings?.stopTemp,
                間歇模式: controlData.settings?.isIntermittentMode,
                開啟分鐘: controlData.settings?.onMinutes,
                關閉分鐘: controlData.settings?.offMinutes
            }
        });
        
        // 模擬風扇狀態回應
        const fanResponse = {
            device: controlData.device,
            type: 'fan_status_response',
            status: {
                isRunning: Math.random() > 0.5,
                currentTemp: 25.5,
                mode: controlData.settings?.isIntermittentMode ? 'intermittent' : 'temperature',
                lastUpdate: new Date().toISOString()
            }
        };
        
        // 回傳風扇狀態
        const statusTopic = `device/${controlData.device}/status`;
        client.publish(statusTopic, JSON.stringify(fanResponse));
        console.log(`📤 已回傳風扇狀態到 ${statusTopic}`);
        
    } catch (error) {
        console.error('❌ 處理控制指令失敗:', error);
    }
});

client.on('error', (error) => {
    console.error('❌ MQTT 連接錯誤:', error);
    process.exit(1);
});

console.log('🚀 定頻風扇測試程式啟動');
console.log('📝 使用方法:');
console.log('   1. 確保系統運行: npm start');
console.log('   2. 開啟瀏覽器: http://localhost:3000/remote/constant-fan-page?N=DEV001');
console.log('   3. 測試設定儲存和控制指令');
console.log('');

