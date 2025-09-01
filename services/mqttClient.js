const mqtt = require('mqtt');
const config = require('../config');
const Farm = require('../models/Farm');
const { getUnitByCode } = require('../unit');

//disable console.log
console.log = function() {};

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
            // 首先訂閱通用主題來監聽新設備
            await this.subscribeToGeneralTopics();
            
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

    // 訂閱通用主題來監聽新設備
    async subscribeToGeneralTopics() {
        const generalTopics = [
            'device/+/#',              // 監聽所有設備主題
            'device/name'              // 監聽設備註冊主題
            // 注意：MQTT 通配符不支援 R+ 語法，改用 device/+/# 通用匹配，在處理時過濾
        ];

        for (const topic of generalTopics) {
            if (!this.subscribedTopics.has(topic)) {
                this.client.subscribe(topic, (err) => {
                    if (err) {
                        console.error(`訂閱通用主題 ${topic} 失敗:`, err);
                    } else {
                        this.subscribedTopics.add(topic);
                        console.log(`✅ 已訂閱通用主題: ${topic}`);
                    }
                });
            }
        }
    }

    // 訂閱特定設備的所有主題
    async subscribeToDeviceAll(deviceName) {
        const topics = [
            `device/${deviceName}/nodeinf`,    // 控制設備狀態
            `device/${deviceName}/seninf`,     // 感測器設備狀態
            `device/${deviceName}/deviceinf`   // 設備資訊
        ];

        // 只有 R 開頭的設備（主機）才訂閱 feeding 主題
        if (deviceName.startsWith('R')) {
            topics.push(`device/${deviceName}/feeding`);
            console.log(`📡 主機設備 ${deviceName} 將訂閱 feeding 主題`);
        }

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

    // 手動重新訂閱所有主機設備（R開頭）的 feeding 主題
    async resubscribeAllFeedingTopics() {
        try {
            console.log('🔄 開始重新訂閱所有主機設備的 feeding 主題...');
            
            // 取得所有場域的設備名稱
            const farms = await Farm.find({});
            const allDeviceNames = new Set();
            const hostDeviceNames = new Set(); // R 開頭的主機設備

            farms.forEach(farm => {
                if (farm.sensors && Array.isArray(farm.sensors)) {
                    farm.sensors.forEach(sensor => {
                        if (sensor.deviceName) {
                            allDeviceNames.add(sensor.deviceName);
                            // 只有 R 開頭的設備才是主機，需要 feeding
                            if (sensor.deviceName.startsWith('R')) {
                                hostDeviceNames.add(sensor.deviceName);
                            }
                        }
                    });
                }
                if (farm.devices && Array.isArray(farm.devices)) {
                    farm.devices.forEach(device => {
                        if (device.deviceName) {
                            allDeviceNames.add(device.deviceName);
                            // 只有 R 開頭的設備才是主機，需要 feeding
                            if (device.deviceName.startsWith('R')) {
                                hostDeviceNames.add(device.deviceName);
                            }
                        }
                    });
                }
            });

            // 只為主機設備（R開頭）訂閱 feeding 主題
            let subscribeCount = 0;
            for (const deviceName of hostDeviceNames) {
                const feedingTopic = `device/${deviceName}/feeding`;
                
                if (!this.subscribedTopics.has(feedingTopic)) {
                    this.client.subscribe(feedingTopic, (err) => {
                        if (err) {
                            console.error(`訂閱主機 feeding 主題 ${feedingTopic} 失敗:`, err);
                        } else {
                            this.subscribedTopics.add(feedingTopic);
                            console.log(`✅ 已訂閱主機 feeding 主題: ${feedingTopic}`);
                        }
                    });
                    subscribeCount++;
                } else {
                    console.log(`⏭️ 主機 feeding 主題已存在: ${feedingTopic}`);
                }
            }

            console.log(`🎯 完成重新訂閱，新增了 ${subscribeCount} 個主機 feeding 主題訂閱`);
            console.log(`📊 總共 ${allDeviceNames.size} 個設備名稱，其中 ${hostDeviceNames.size} 個主機設備`);
            
            return { 
                allDeviceNames: Array.from(allDeviceNames), 
                hostDeviceNames: Array.from(hostDeviceNames),
                newSubscriptions: subscribeCount 
            };
        } catch (error) {
            console.error('重新訂閱主機 feeding 主題失敗:', error);
            throw error;
        }
    }

    // 處理接收到的訊息
    async handleMessage(topic, message) {
        try {
            const messageStr = message.toString();
            console.log(`收到 MQTT 訊息: ${topic} -> ${messageStr}`);

            // 特殊處理設備註冊訊息
            if (topic === 'device/name') {
                await this.handleDeviceRegistration(messageStr);
                return;
            }

            // 解析主題
            const topicParts = topic.split('/');
            if (topicParts.length < 2 || topicParts[0] !== 'device') {
                console.warn('未知的主題格式:', topic);
                return;
            }

            // 如果是個別感測器數值訊息 (device/deviceName/sensorId)
            if (topicParts.length === 3 && !['nodeinf', 'seninf', 'deviceinf' , 'feeding'].includes(topicParts[2])) {
                const deviceName = topicParts[1];
                const sensorId = topicParts[2];
                
                // 嘗試解析 JSON 訊息
                let data;
                try {
                    data = JSON.parse(messageStr);
                } catch (jsonError) {
                    console.warn('無法解析個別感測器訊息:', messageStr);
                    return;
                }
                
                await this.handleIndividualSensorData(deviceName, sensorId, data);
                return;
            }

            // 如果是特定設備的訊息
            if (topicParts.length === 3) {
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
                    case 'feeding':
                        await this.handleFeedingInfo(deviceName, data);
                        break;
                    default:
                        console.warn('未知的訊息類型:', messageType);
                }
            }
        } catch (error) {
            console.error('處理 MQTT 訊息時發生錯誤:', error);
        }
    }

    // 處理個別感測器數值訊息
    async handleIndividualSensorData(deviceName, sensorId, data) {
        try {
            const { timestamp, published_by, ...sensorValues } = data;
            
            console.log(`📊 處理個別感測器數值 - 設備: ${deviceName}, 感測器: ${sensorId}`);
            console.log(`📈 數值:`, sensorValues);
            console.log(`⏰ 時間: ${timestamp}`);
            
            // 找到對應的場域
            const farm = await Farm.findByDeviceName(sensorId);
            if (!farm) {
                console.warn(`找不到感測器 ${sensorId} 對應的場域`);
                return;
            }

            // 找到對應的感測器
            const sensor = farm.sensors.find(s => s.deviceName === sensorId);
            if (!sensor) {
                console.warn(`在場域 ${farm.name} 中找不到感測器 ${sensorId}`);
                return;
            }

            // 處理感測器數值
            const processedValues = this.processSensorValues(sensorValues);
            
            // 更新感測器數值
            sensor.lastValue = {
                ...sensor.lastValue,
                currentValues: processedValues,
                rawData: sensorValues,
                timestamp: timestamp,
                published_by: published_by
            };
            sensor.lastUpdate = new Date();
            sensor.status = 'online';

            await farm.save();
            
            console.log(`✅ 已更新感測器 ${sensorId} 的數值:`, processedValues.map(v => `${v.name}=${v.value}${v.unit}`).join(', '));
            
        } catch (error) {
            console.error('處理個別感測器數值失敗:', error);
        }
    }

    // 處理感測器數值並添加單位資訊
    processSensorValues(sensorValues) {
        const processedValues = [];
        
        for (const [code, value] of Object.entries(sensorValues)) {
            if (code === 'sensorId' || code === 'timestamp' || code === 'published_by') {
                continue; // 跳過非數值欄位
            }
            
            // 從 unit.js 獲取感測器類型資訊
            const unitInfo = getUnitByCode(code);
            
            if (unitInfo) {
                processedValues.push({
                    code: code,
                    name: unitInfo.name,
                    value: value,
                    unit: unitInfo.unit,
                    img: unitInfo.img
                });
                console.log(`📐 ${code} -> ${unitInfo.name}: ${value} ${unitInfo.unit}`);
            } else {
                // 未知代碼，使用原始值
                processedValues.push({
                    code: code,
                    name: `未知感測器_${code}`,
                    value: value,
                    unit: '',
                    img: 'unknown.png'
                });
                console.warn(`⚠️ 未知感測器代碼: ${code}`);
            }
        }
        
        return processedValues;
    }

    // 處理設備註冊
    async handleDeviceRegistration(messageStr) {
        try {
            console.log('🔍 收到設備註冊訊息:', messageStr);
            
            // 解析設備註冊資料
            let deviceData;
            try {
                deviceData = JSON.parse(messageStr);
            } catch (jsonError) {
                console.error('❌ 設備註冊訊息格式錯誤:', messageStr);
                return;
            }

            const { deviceSN, ip } = deviceData;
            
            if (!deviceSN || !ip) {
                console.error('❌ 設備註冊訊息缺少必要欄位 (deviceSN, ip):', deviceData);
                return;
            }

            console.log(`📱 註冊新設備: ${deviceSN}, IP: ${ip}`);

            // 檢查是否已存在此設備
            const existingFarm = await Farm.findByDeviceName(deviceSN);
            
            if (existingFarm) {
                console.log(`✅ 設備 ${deviceSN} 已存在於場域 ${existingFarm.name}`);
                // 更新 IP 位址
                const device = existingFarm.devices.find(d => d.deviceName === deviceSN) ||
                              existingFarm.sensors.find(s => s.deviceName === deviceSN);
                              
                if (device && device.ip !== ip) {
                    device.ip = ip;
                    device.lastUpdate = new Date();
                    await existingFarm.save();
                    console.log(`🔄 已更新設備 ${deviceSN} 的 IP 位址為 ${ip}`);
                }
            } else {
                // 建立新的場域或添加到預設場域
                const defaultFarmName = `場域_${deviceSN.substring(0, 8)}`;
                
                let farm = await Farm.findOne({ name: defaultFarmName });
                
                if (!farm) {
                    // 建立新場域
                    farm = new Farm({
                        name: defaultFarmName,
                        ip: ip,
                        sensors: [],
                        devices: [],
                        stats: {
                            feeding_days: 0,
                            animal_count: 0,
                            water_consumption: 0,
                            fan_count: 0
                        }
                    });
                    console.log(`🏗️ 建立新場域: ${defaultFarmName}`);
                }

                // 添加設備到場域
                const newDevice = {
                    id: deviceSN,
                    name: `設備_${deviceSN}`,
                    type: 'sensor', // 預設為感測器，可根據後續訊息調整
                    x: Math.random() * 100,
                    y: Math.random() * 100,
                    deviceName: deviceSN,
                    ip: ip,
                    status: 'online',
                    lastUpdate: new Date()
                };

                farm.sensors.push(newDevice);
                await farm.save();
                
                console.log(`✅ 已將設備 ${deviceSN} 添加到場域 ${farm.name}`);
            }

            // 為新設備訂閱 MQTT 主題
            await this.subscribeToDeviceAll(deviceSN);
            console.log(`📡 已為設備 ${deviceSN} 訂閱 MQTT 主題`);
            
        } catch (error) {
            console.error('❌ 處理設備註冊失敗:', error);
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
            console.log(`處理感測器狀態 - 設備: ${deviceName}`);
            
            // 檢查是否為新格式的感測器配置資料（包含 device_info 和 sensors）
            if (data && data.device_info && data.sensors && Array.isArray(data.sensors)) {
                await this.handleNewFormatSensorConfiguration(deviceName, data);
                return;
            }
            
            // 檢查是否為舊格式的感測器配置資料（陣列格式）
            if (Array.isArray(data)) {
                await this.handleSensorConfiguration(deviceName, data);
                return;
            }
            
            // 處理一般感測器資料
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

    // 處理感測器配置資料（自動創建感測器）
    async handleSensorConfiguration(deviceName, sensorsData) {
        try {
            console.log(`🔧 處理感測器配置 - 設備: ${deviceName}, 感測器數量: ${sensorsData.length}`);
            
            // 找到對應的場域
            let farm = await Farm.findByDeviceName(deviceName);
            
            if (!farm) {
                // 如果沒有找到場域，創建新場域
                const defaultFarmName = `場域_${deviceName.substring(0, 8)}`;
                farm = new Farm({
                    name: defaultFarmName,
                    ip: '0.0.0.0', // 預設 IP，稍後可更新
                    sensors: [],
                    devices: [],
                    stats: {
                        feeding_days: 0,
                        animal_count: 0,
                        water_consumption: 0,
                        fan_count: 0
                    }
                });
                console.log(`🏗️ 為感測器配置建立新場域: ${defaultFarmName}`);
            }

            // 處理每個感測器
            for (const sensorConfig of sensorsData) {
                await this.createSensorFromConfig(farm, sensorConfig);
            }

            await farm.save();
            console.log(`✅ 已為設備 ${deviceName} 自動創建 ${sensorsData.length} 個感測器`);
            
        } catch (error) {
            console.error('處理感測器配置失敗:', error);
        }
    }

    // 從配置資料創建單個感測器
    async createSensorFromConfig(farm, sensorConfig) {
        try {
            const { SN, DES, ADDRESS, value, name, profile } = sensorConfig;
            
            // 解碼中文描述
            let description = '';
            let sensorName = '';
            
            try {
                // 嘗試解碼 UTF-8 編碼的中文
                description = this.decodeChineseText(DES);
                sensorName = this.decodeChineseText(name);
            } catch (decodeError) {
                console.warn('中文解碼失敗，使用原始文字:', decodeError);
                description = DES || '';
                sensorName = name || '';
            }

            // 檢查是否已存在相同 SN 的感測器
            const existingSensor = farm.sensors.find(s => s.deviceName === SN);
            
            if (existingSensor) {
                console.log(`📡 感測器 ${SN} 已存在，更新配置`);
                existingSensor.name = sensorName || `感測器_${SN}`;
                existingSensor.description = description; // 更新描述欄位
                existingSensor.lastUpdate = new Date();
                existingSensor.status = 'online';
                return;
            }

            // 創建新感測器
            const newSensor = {
                id: SN,
                name: sensorName || `感測器_${SN}`,
                description: description, // 將描述作為主要識別名稱
                type: this.determineSensorType(value),
                x: (ADDRESS * 10) % 100, // 根據地址分配位置
                y: Math.floor(ADDRESS * 8) % 100,
                deviceName: SN,
                status: 'online',
                lastValue: {
                    description: description,
                    address: ADDRESS,
                    values: value,
                    profile: profile
                },
                lastUpdate: new Date()
            };

            farm.sensors.push(newSensor);
            console.log(`✅ 已創建感測器: ${sensorName} (${SN}) - ${description}`);
            
        } catch (error) {
            console.error('創建感測器失敗:', error);
        }
    }

    // 解碼中文文字
    decodeChineseText(encodedText) {
        if (!encodedText) return '';
        
        try {
            // 如果包含 \xe 格式的編碼，嘗試解碼
            if (encodedText.includes('\\x')) {
                // 將 \xe5\xbe\x8c 格式轉換為 Buffer
                const hexString = encodedText.replace(/\\x/g, '');
                const buffer = Buffer.from(hexString, 'hex');
                return buffer.toString('utf8');
            }
            
            return encodedText;
        } catch (error) {
            console.warn('解碼中文失敗:', error);
            return encodedText;
        }
    }

    // 根據感測器值類型判斷感測器類型
    determineSensorType(values) {
        if (!Array.isArray(values) || values.length === 0) {
            return 'unknown';
        }

        const firstValue = values[0];
        const name = firstValue.name || '';
        
        // 嘗試解碼名稱來判斷類型
        try {
            const decodedName = this.decodeChineseText(name);
            
            if (decodedName.includes('溫度')) return 'temperature';
            if (decodedName.includes('濕度')) return 'humidity';
            if (decodedName.includes('二氧化碳')) return 'co2';
            if (decodedName.includes('壓')) return 'pressure';
            if (decodedName.includes('風速')) return 'wind';
            if (decodedName.includes('水')) return 'water';
            
        } catch (error) {
            console.warn('判斷感測器類型失敗:', error);
        }

        return 'sensor';
    }

    // 處理新格式的感測器配置資料
    async handleNewFormatSensorConfiguration(deviceName, data) {
        try {
            const { device_info, sensors, timestamp } = data;
            
            console.log(`🔧 處理新格式感測器配置 - 設備: ${device_info.device_name}, 感測器數量: ${device_info.total_sensors}`);
            console.log(`📊 設備狀態: ${device_info.status}, 時間戳記: ${timestamp}`);
            
            // 找到對應的場域，如果沒有則創建
            let farm = await Farm.findByDeviceName(deviceName);
            
            if (!farm) {
                // 創建新場域
                const defaultFarmName = `場域_${device_info.device_name}`;
                farm = new Farm({
                    name: defaultFarmName,
                    ip: '0.0.0.0', // 預設 IP，稍後可更新
                    sensors: [],
                    devices: [],
                    stats: {
                        feeding_days: 0,
                        animal_count: 0,
                        water_consumption: 0,
                        fan_count: 0
                    }
                });
                console.log(`🏗️ 為新格式感測器配置建立新場域: ${defaultFarmName}`);
            }

            // 處理每個感測器
            for (const sensorData of sensors) {
                await this.createSensorFromNewFormat(farm, sensorData);
            }

            // 更新場域的設備狀態
            await this.updateFarmDeviceStatus(farm, deviceName, device_info);

            await farm.save();
            console.log(`✅ 已為設備 ${device_info.device_name} 自動創建/更新 ${sensors.length} 個感測器`);
            
        } catch (error) {
            console.error('處理新格式感測器配置失敗:', error);
        }
    }

    // 從新格式配置資料創建單個感測器
    async createSensorFromNewFormat(farm, sensorData) {
        try {
            const { device_info, sensor_values, profile, metadata } = sensorData;
            const { serial_number, description, address, name, status } = device_info;
            
            console.log(`📡 處理感測器: ${name} (${serial_number}) - ${description}`);
            
            // 檢查是否已存在相同序號的感測器
            const existingSensor = farm.sensors.find(s => s.deviceName === serial_number);
            
            if (existingSensor) {
                console.log(`📡 感測器 ${serial_number} 已存在，更新配置`);
                existingSensor.name = name || `感測器_${serial_number}`;
                existingSensor.description = description; // 更新描述欄位
                existingSensor.status = status === 'active' ? 'online' : 'offline';
                existingSensor.lastUpdate = new Date();
                existingSensor.lastValue = {
                    description: description,
                    address: address,
                    sensor_values: sensor_values,
                    profile: profile,
                    metadata: metadata
                };
                return;
            }

            // 創建新感測器
            const newSensor = {
                id: serial_number,
                name: name || `感測器_${serial_number}`,
                description: description, // 將描述作為主要識別名稱
                type: this.determineSensorTypeFromName(name, description),
                x: (address * 10) % 100, // 根據地址分配位置
                y: Math.floor(address * 8) % 100,
                deviceName: serial_number,
                status: status === 'active' ? 'online' : 'offline',
                lastValue: {
                    description: description,
                    address: address,
                    sensor_values: sensor_values,
                    profile: profile,
                    metadata: metadata
                },
                lastUpdate: new Date()
            };

            farm.sensors.push(newSensor);
            console.log(`✅ 已創建感測器: ${name} (${serial_number}) - ${description} [${newSensor.type}]`);
            
        } catch (error) {
            console.error('創建新格式感測器失敗:', error);
        }
    }

    // 根據感測器名稱和描述判斷類型
    determineSensorTypeFromName(name, description) {
        const text = (name + ' ' + description).toLowerCase();
        
        if (text.includes('溫度')) return 'temperature';
        if (text.includes('濕度')) return 'humidity';
        if (text.includes('二氧化碳') || text.includes('co2')) return 'co2';
        if (text.includes('壓') || text.includes('pressure')) return 'pressure';
        if (text.includes('風速') || text.includes('wind')) return 'wind';
        if (text.includes('水') || text.includes('water')) return 'water';
        if (text.includes('溫濕度')) return 'temperature'; // 溫濕度感測器歸類為溫度
        
        return 'sensor';
    }

    // 更新場域設備狀態
    async updateFarmDeviceStatus(farm, deviceName, deviceInfo) {
        try {
            // 檢查是否已有對應的設備記錄
            let device = farm.devices.find(d => d.deviceName === deviceName);
            
            if (!device) {
                // 創建新的設備記錄
                const newDevice = {
                    id: deviceName,
                    name: deviceInfo.device_name || deviceName,
                    type: 'controller',
                    x: 50, // 中央位置
                    y: 50,
                    deviceName: deviceName,
                    status: deviceInfo.status === 'active' ? 'online' : 'offline',
                    lastUpdate: new Date()
                };
                
                farm.devices.push(newDevice);
                console.log(`✅ 已創建控制器設備: ${deviceInfo.device_name}`);
            } else {
                // 更新現有設備
                device.status = deviceInfo.status === 'active' ? 'online' : 'offline';
                device.lastUpdate = new Date();
                console.log(`🔄 已更新控制器狀態: ${deviceInfo.status}`);
            }
        } catch (error) {
            console.error('更新場域設備狀態失敗:', error);
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

    // 處理飼養天數資訊訊息
    async handleFeedingInfo(deviceName, data) {
        try {
            console.log(`🐷 處理飼養天數資訊 - 設備: ${deviceName}`, data);
            
            let farm = await Farm.findByDeviceName(deviceName);
            
            // 如果找不到場域，且是 R 開頭的主機設備，自動創建場域
            if (!farm && deviceName.startsWith('R')) {
                console.log(`🏗️ 為新主機設備 ${deviceName} 自動創建場域`);
                
                const defaultFarmName = `場域_${deviceName}`;
                farm = new Farm({
                    name: defaultFarmName,
                    ip: '0.0.0.0', // 預設 IP，稍後可更新
                    sensors: [],
                    devices: [{
                        deviceName: deviceName,
                        type: 'controller',
                        name: `主機_${deviceName}`,
                        status: 'online',
                        lastUpdate: new Date()
                    }],
                    stats: {
                        feeding_days: 0,
                        animal_count: 0,
                        water_consumption: 0,
                        fan_count: 0
                    }
                });
                
                await farm.save();
                console.log(`✅ 已為主機設備 ${deviceName} 創建新場域: ${defaultFarmName}`);
            }
            
            if (!farm) {
                console.warn(`找不到設備 ${deviceName} 對應的場域，且無法自動創建`);
                return;
            }

            // 解析飼養天數資料
            const { feedDay, timestamp } = data;
            
            if (feedDay === undefined) {
                console.warn('飼養天數資料格式不正確，缺少 feedDay 欄位:', data);
                return;
            }

            const oldFeedingDays = farm.stats.feeding_days;
            const newFeedingDays = parseInt(feedDay);
            
            // 更新飼養天數
            farm.stats.feeding_days = newFeedingDays;
            farm.stats.last_updated = new Date(timestamp || new Date());
            
            await farm.save();
            
            console.log(`🎯 已更新場域 ${farm.name} 的飼養天數: ${oldFeedingDays} → ${newFeedingDays} 天`);
            console.log(`📅 更新時間: ${timestamp || new Date().toISOString()}`);
            
            // 如果有顯著變化，記錄特殊事件
            if (Math.abs(newFeedingDays - oldFeedingDays) > 1) {
                console.log(`⚠️ 飼養天數發生顯著變化，可能為新一批飼養開始或數據重置`);
            }
            
            // 觸發即時更新事件（可供其他模組監聽）
            this.notifyFeedingDaysUpdate(farm._id, {
                farmName: farm.name,
                deviceName: deviceName,
                oldFeedingDays: oldFeedingDays,
                newFeedingDays: newFeedingDays,
                timestamp: timestamp || new Date().toISOString()
            });
            
        } catch (error) {
            console.error('處理飼養天數資訊失敗:', error);
        }
    }

    // 通知飼養天數更新（事件發送）
    notifyFeedingDaysUpdate(farmId, updateInfo) {
        try {
            // 如果有其他模組需要監聽飼養天數更新，可以在這裡發送事件
            console.log(`📡 飼養天數更新事件: 場域 ${updateInfo.farmName} (${farmId})`);
            console.log(`   設備: ${updateInfo.deviceName}`);
            console.log(`   天數變化: ${updateInfo.oldFeedingDays} → ${updateInfo.newFeedingDays}`);
            console.log(`   時間: ${updateInfo.timestamp}`);
            
            // 這裡可以添加 WebSocket 或 Socket.IO 推送
            // 或是發送到其他通知系統
            // 例如：this.broadcastToClients('feeding_days_update', updateInfo);
            
        } catch (error) {
            console.error('發送飼養天數更新通知失敗:', error);
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
