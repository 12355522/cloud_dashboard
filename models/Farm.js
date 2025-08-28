const mongoose = require('mongoose');

// 感測器資料結構
const sensorSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    x: { type: Number, required: true, min: 0, max: 100 },
    y: { type: Number, required: true, min: 0, max: 100 },
    deviceName: { type: String }, // MQTT 設備名稱
    ip: { type: String }, // 設備 IP 位址
    status: { type: String, enum: ['online', 'offline', 'error'], default: 'offline' },
    lastValue: { type: mongoose.Schema.Types.Mixed }, // 最新感測器數值
    lastUpdate: { type: Date, default: Date.now }
});

// 設備資料結構
const deviceSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    x: { type: Number, required: true, min: 0, max: 100 },
    y: { type: Number, required: true, min: 0, max: 100 },
    deviceName: { type: String }, // MQTT 設備名稱
    ip: { type: String }, // 設備 IP 位址
    status: { type: String, enum: ['online', 'offline', 'error'], default: 'offline' },
    controlState: { type: mongoose.Schema.Types.Mixed }, // 設備控制狀態
    lastUpdate: { type: Date, default: Date.now }
});

// 場域統計資料結構
const statsSchema = new mongoose.Schema({
    feeding_days: { type: Number, default: 0, min: 0 },
    animal_count: { type: Number, default: 0, min: 0 },
    water_consumption: { type: Number, default: 0, min: 0 },
    fan_count: { type: Number, default: 0, min: 0 },
    device_number: { type: String }, // 設備編號
    last_updated: { type: Date, default: Date.now }
});

// 場域主要資料結構
const farmSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 100
    },
    ip: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v) {
                // IPv4 驗證
                return /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(v);
            },
            message: props => `${props.value} 不是有效的 IP 位址格式！`
        }
    },
    layout_image: { type: String },
    sensors: [sensorSchema],
    devices: [deviceSchema],
    stats: { type: statsSchema, default: () => ({}) },
    mqtt_topic_prefix: { type: String }, // MQTT 主題前綴
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'maintenance'], 
        default: 'active' 
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// 更新時間自動更新
farmSchema.pre('save', function(next) {
    this.updated_at = Date.now();
    next();
});

// 實例方法：取得線上感測器數量
farmSchema.methods.getOnlineSensorsCount = function() {
    return this.sensors.filter(sensor => sensor.status === 'online').length;
};

// 實例方法：取得線上設備數量
farmSchema.methods.getOnlineDevicesCount = function() {
    return this.devices.filter(device => device.status === 'online').length;
};

// 實例方法：更新感測器狀態
farmSchema.methods.updateSensorData = function(deviceName, data) {
    const sensor = this.sensors.find(s => s.deviceName === deviceName);
    if (sensor) {
        sensor.lastValue = data;
        sensor.lastUpdate = new Date();
        sensor.status = 'online';
        return this.save();
    }
    return Promise.resolve(this);
};

// 實例方法：更新設備狀態
farmSchema.methods.updateDeviceData = function(deviceName, data) {
    const device = this.devices.find(d => d.deviceName === deviceName);
    if (device) {
        device.controlState = data;
        device.lastUpdate = new Date();
        device.status = 'online';
        return this.save();
    }
    return Promise.resolve(this);
};

// 靜態方法：根據設備名稱查找場域
farmSchema.statics.findByDeviceName = function(deviceName) {
    return this.findOne({
        $or: [
            { 'sensors.deviceName': deviceName },
            { 'devices.deviceName': deviceName }
        ]
    });
};

module.exports = mongoose.model('Farm', farmSchema);
