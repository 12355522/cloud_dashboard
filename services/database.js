const mongoose = require('mongoose');
const config = require('../system-config');

class DatabaseService {
    constructor() {
        this.connected = false;
    }

    // 檢查連接狀態
    isConnected() {
        return this.connected && mongoose.connection.readyState === 1;
    }

    // 初始化資料庫連線
    async initialize() {
        try {
            console.log('正在連接 MongoDB:', config.mongodb.uri);
            
            await mongoose.connect(config.mongodb.uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000, // 5秒超時
                socketTimeoutMS: 45000, // 45秒 socket 超時
            });

            this.connected = true;
            console.log('✅ MongoDB 連接成功');

            // 設定事件監聽器
            mongoose.connection.on('error', (error) => {
                console.error('❌ MongoDB 連接錯誤:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                console.log('⚠️ MongoDB 連接已斷開');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                console.log('✅ MongoDB 重新連接成功');
                this.connected = true;
            });

            return this;
        } catch (error) {
            console.error('❌ MongoDB 連接失敗:', error);
            this.isConnected = false;
            throw error;
        }
    }

    // 取得連接狀態
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    // 關閉資料庫連線
    async close() {
        try {
            await mongoose.connection.close();
            this.isConnected = false;
            console.log('MongoDB 連接已關閉');
        } catch (error) {
            console.error('關閉 MongoDB 連接時發生錯誤:', error);
        }
    }

    // 檢查資料庫健康狀態
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected', message: '資料庫未連接' };
            }

            // 執行簡單的查詢測試連接
            await mongoose.connection.db.admin().ping();
            
            return { 
                status: 'healthy', 
                message: '資料庫連接正常',
                details: this.getConnectionStatus()
            };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                message: '資料庫連接異常',
                error: error.message 
            };
        }
    }

    // 初始化示例資料（僅在開發環境）
    async initSampleData() {
        if (config.system.env !== 'development') {
            return;
        }

        try {
            const Farm = require('../models/Farm');
            
            // 檢查是否已有資料
            const existingFarms = await Farm.countDocuments();
            if (existingFarms > 0) {
                console.log('資料庫中已有資料，跳過初始化示例資料');
                return;
            }

            console.log('初始化示例資料...');

            const sampleFarms = [
                {
                    name: '養豬場A',
                    ip: '192.168.1.100',
                    layout_image: null,
                    sensors: [
                        {
                            id: 'sensor_001',
                            name: '溫度感測器1',
                            type: 'temperature',
                            x: 25,
                            y: 30,
                            deviceName: 'pig_farm_temp_01',
                            status: 'offline'
                        },
                        {
                            id: 'sensor_002',
                            name: '濕度感測器1',
                            type: 'humidity',
                            x: 75,
                            y: 40,
                            deviceName: 'pig_farm_hum_01',
                            status: 'offline'
                        }
                    ],
                    devices: [
                        {
                            id: 'device_001',
                            name: '風扇1',
                            type: 'fan',
                            x: 50,
                            y: 60,
                            deviceName: 'pig_farm_fan_01',
                            status: 'offline'
                        },
                        {
                            id: 'device_002',
                            name: '供水器1',
                            type: 'water_supply',
                            x: 30,
                            y: 80,
                            deviceName: 'pig_farm_water_01',
                            status: 'offline'
                        }
                    ],
                    stats: {
                        feeding_days: 45,
                        animal_count: 150,
                        water_consumption: 850,
                        fan_count: 8,
                        device_number: 'PF001'
                    },
                    mqtt_topic_prefix: 'device/',
                    status: 'active'
                },
                {
                    name: '養雞場B',
                    ip: '192.168.1.101',
                    layout_image: null,
                    sensors: [
                        {
                            id: 'sensor_003',
                            name: '溫度感測器2',
                            type: 'temperature',
                            x: 40,
                            y: 25,
                            deviceName: 'chicken_farm_temp_01',
                            status: 'offline'
                        }
                    ],
                    devices: [
                        {
                            id: 'device_003',
                            name: '風扇2',
                            type: 'fan',
                            x: 60,
                            y: 50,
                            deviceName: 'chicken_farm_fan_01',
                            status: 'offline'
                        }
                    ],
                    stats: {
                        feeding_days: 30,
                        animal_count: 500,
                        water_consumption: 320,
                        fan_count: 12,
                        device_number: 'CF001'
                    },
                    mqtt_topic_prefix: 'device/',
                    status: 'active'
                }
            ];

            await Farm.insertMany(sampleFarms);
            console.log('✅ 示例資料初始化完成');
        } catch (error) {
            console.error('❌ 初始化示例資料失敗:', error);
        }
    }
}

module.exports = new DatabaseService();
