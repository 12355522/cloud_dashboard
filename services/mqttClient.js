const mqtt = require('mqtt');
const config = require('../config');
const Farm = require('../models/Farm');

class MQTTClient {
    constructor() {
        this.client = null;
        this.subscribedTopics = new Set();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    // 初始化 MQTT 連線
    async initialize() {
        try {
            console.log('正在連接 MQTT Broker:', config.mqtt.broker);
            
                    this.client = mqtt.connect(config.mqtt.broker, {
            ...config.mqtt.options,
            username: config.mqtt.username || undefined,
            password: config.mqtt.password || undefined,
            reconnectPeriod: 10000, // 10秒重連間隔
            connectTimeout: 5000,   // 5秒連接超時
            keepalive: 60
        });

            this.setupEventHandlers();
            
            return new Promise((resolve, reject) => {
                this.client.on('connect', () => {
                    this.isConnected = true;
                    console.log('✅ MQTT 客戶端連接成功');
                    this.subscribeToDeviceTopics();
                    resolve(this);
                });

                this.client.on('error', (error) => {
                    console.error('❌ MQTT 連接錯誤:', error);
                    reject(error);
                });

                // 設定連接超時
                setTimeout(() => {
                    if (!this.isConnected) {
                        reject(new Error('MQTT 連接超時'));
                    }
                }, 30000);
            });
        } catch (error) {
            console.error('MQTT 初始化失敗:', error);
            throw error;
        }
    }

    // 設定事件處理器
    setupEventHandlers() {
        this.client.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            console.log('MQTT 客戶端已連接');
        });

        this.client.on('disconnect', () => {
            this.isConnected = false;
            console.log('MQTT 客戶端已斷線');
        });

        this.client.on('reconnect', () => {
            this.reconnectAttempts++;
            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                console.log(`MQTT 客戶端重新連接中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            } else {
                console.log('MQTT 重連次數已達上限，停止重連');
                this.client.end();
            }
        });

        this.client.on('error', (error) => {
            if (this.reconnectAttempts <= this.maxReconnectAttempts) {
                console.error('MQTT 連接錯誤，將重試連接');
            }
        });

        this.client.on('message', (topic, message) => {
            this.handleMessage(topic, message);
        });
    }

    // 訂閱設備主題
    async subscribeToDeviceTopics() {
        try {
            // 取得所有場域的設備名稱
            const farms = await Farm.find({});
            const deviceNames = new Set();

            farms.forEach(farm => {
                farm.sensors.forEach(sensor => {
                    if (sensor.deviceName) {
                        deviceNames.add(sensor.deviceName);
                    }
                });
                farm.devices.forEach(device => {
                    if (device.deviceName) {
                        deviceNames.add(device.deviceName);
                    }
                });
            });

            // 為每個設備訂閱相關主題
            for (const deviceName of deviceNames) {
                await this.subscribeToDeviceAll(deviceName);
            }

            console.log(`已訂閱 ${deviceNames.size} 個設備的 MQTT 主題`);
        } catch (error) {
            console.error('訂閱設備主題失敗:', error);
        }
    }

    // 訂閱特定設備的所有主題
    async subscribeToDeviceAll(deviceName) {
        const topics = [
            `device/${deviceName}/nodeinf`,    // 控制設備狀態
            `device/${deviceName}/seninf`,     // 感測器設備狀態
            `device/${deviceName}/deviceinf`   // 設備資訊
        ];

        for (const topic of topics) {
            if (!this.subscribedTopics.has(topic)) {
                this.client.subscribe(topic, (err) => {
                    if (err) {
                        console.error(`訂閱主題 ${topic} 失敗:`, err);
                    } else {
                        this.subscribedTopics.add(topic);
                        console.log(`✅ 已訂閱主題: ${topic}`);
                    }
                });
            }
        }
    }

    // 新增設備時訂閱
    async addDeviceSubscription(deviceName) {
        if (this.isConnected) {
            await this.subscribeToDeviceAll(deviceName);
        }
    }

    // 處理接收到的訊息
    async handleMessage(topic, message) {
        try {
            const messageStr = message.toString();
            console.log(`收到 MQTT 訊息: ${topic} -> ${messageStr}`);

            // 解析主題
            const topicParts = topic.split('/');
            if (topicParts.length !== 3 || topicParts[0] !== 'device') {
                console.warn('未知的主題格式:', topic);
                return;
            }

            const deviceName = topicParts[1];
            const messageType = topicParts[2];

            // 嘗試解析 JSON 訊息
            let data;
            try {
                data = JSON.parse(messageStr);
            } catch (jsonError) {
                console.warn('無法解析 JSON 訊息，將作為字串處理:', messageStr);
                data = { raw: messageStr };
            }

            // 根據訊息類型處理
            switch (messageType) {
                case 'nodeinf':
                    await this.handleNodeInfo(deviceName, data);
                    break;
                case 'seninf':
                    await this.handleSensorInfo(deviceName, data);
                    break;
                case 'deviceinf':
                    await this.handleDeviceInfo(deviceName, data);
                    break;
                default:
                    console.warn('未知的訊息類型:', messageType);
            }
        } catch (error) {
            console.error('處理 MQTT 訊息時發生錯誤:', error);
        }
    }

    // 處理控制設備狀態訊息
    async handleNodeInfo(deviceName, data) {
        try {
            console.log(`處理控制設備狀態 - 設備: ${deviceName}`, data);
            
            const farm = await Farm.findByDeviceName(deviceName);
            if (farm) {
                await farm.updateDeviceData(deviceName, {
                    type: 'nodeinf',
                    data: data,
                    timestamp: new Date()
                });
                console.log(`✅ 已更新設備 ${deviceName} 的控制狀態`);
            } else {
                console.warn(`找不到設備 ${deviceName} 對應的場域`);
            }
        } catch (error) {
            console.error('處理控制設備狀態失敗:', error);
        }
    }

    // 處理感測器設備狀態訊息
    async handleSensorInfo(deviceName, data) {
        try {
            console.log(`處理感測器狀態 - 設備: ${deviceName}`, data);
            
            const farm = await Farm.findByDeviceName(deviceName);
            if (farm) {
                await farm.updateSensorData(deviceName, {
                    type: 'seninf',
                    data: data,
                    timestamp: new Date()
                });
                console.log(`✅ 已更新感測器 ${deviceName} 的狀態`);
            } else {
                console.warn(`找不到感測器 ${deviceName} 對應的場域`);
            }
        } catch (error) {
            console.error('處理感測器狀態失敗:', error);
        }
    }

    // 處理設備資訊訊息
    async handleDeviceInfo(deviceName, data) {
        try {
            console.log(`處理設備資訊 - 設備: ${deviceName}`, data);
            
            const farm = await Farm.findByDeviceName(deviceName);
            if (farm && data) {
                // 更新設備相關統計資料
                if (data.feeding_days !== undefined) {
                    farm.stats.feeding_days = data.feeding_days;
                }
                if (data.device_number !== undefined) {
                    farm.stats.device_number = data.device_number;
                }
                if (data.fan_count !== undefined) {
                    farm.stats.fan_count = data.fan_count;
                }
                
                farm.stats.last_updated = new Date();
                await farm.save();
                
                console.log(`✅ 已更新設備 ${deviceName} 的資訊`);
            } else {
                console.warn(`找不到設備 ${deviceName} 對應的場域或資料為空`);
            }
        } catch (error) {
            console.error('處理設備資訊失敗:', error);
        }
    }

    // 發布訊息到 MQTT
    publish(topic, message) {
        if (this.isConnected && this.client) {
            const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
            this.client.publish(topic, messageStr, (err) => {
                if (err) {
                    console.error(`發布訊息到 ${topic} 失敗:`, err);
                } else {
                    console.log(`✅ 已發布訊息到 ${topic}: ${messageStr}`);
                }
            });
        } else {
            console.warn('MQTT 客戶端未連接，無法發布訊息');
        }
    }

    // 關閉連線
    close() {
        if (this.client) {
            this.client.end();
            this.isConnected = false;
            console.log('MQTT 客戶端已關閉');
        }
    }

    // 取得連接狀態
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            subscribedTopics: Array.from(this.subscribedTopics)
        };
    }
}

module.exports = new MQTTClient();
