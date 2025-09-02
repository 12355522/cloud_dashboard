const onvif = require('onvif');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// 新增：明確指定FFmpeg路徑
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

// 新增：持久化儲存路徑
const DEVICES_FILE = path.join(__dirname, 'onvif-devices.json');

class ONVIFService {
    constructor() {
        this.devices = new Map(); // 用於儲存已設定的設備
        this.discoveredDevices = new Map(); // 僅儲存當次發現的設備
        this.streams = new Map();
        this.snapshots = new Map();
        this.snapshotDir = path.join(__dirname, '../public/snapshots');
        this.isSaving = false; // 新增：寫入鎖
        
        if (!fs.existsSync(this.snapshotDir)) {
            fs.mkdirSync(this.snapshotDir, { recursive: true });
        }
        
        // 新增：啟動時載入已儲存的設備
        this.loadDevices();
    }

    // 新增：從檔案載入設備
    loadDevices() {
        try {
            if (fs.existsSync(DEVICES_FILE)) {
                const data = fs.readFileSync(DEVICES_FILE, 'utf8');
                const devicesArray = JSON.parse(data);
                this.devices.clear();
                devicesArray.forEach(device => {
                    // 將 cam 物件設定為 null，因為它不能被序列化
                    device.cam = null;
                    this.devices.set(device.ip, device);
                });
                console.log(`✅ 成功從 ${DEVICES_FILE} 載入 ${this.devices.size} 台攝影機`);
            } else {
                console.log(`📝 ${DEVICES_FILE} 不存在，將在新增設備時自動建立`);
            }
        } catch (error) {
            console.error(`❌ 載入攝影機設定檔失敗:`, error);
        }
    }

    // 新增：儲存設備到檔案
    saveDevices() {
        if (this.isSaving) {
            console.warn('⚠️  另一個儲存操作正在進行中，本次儲存已跳過以防止衝突。');
            return;
        }
        this.isSaving = true;

        try {
            console.log('💾 [1/2] 開始序列化設備資料...');
            const devicesArray = Array.from(this.devices.values()).map(device => {
                const { cam, ...deviceToSave } = device;
                return deviceToSave;
            });
            
            console.log(`💾 [2/2] 準備將 ${devicesArray.length} 台攝影機寫入 ${DEVICES_FILE}...`);
            fs.writeFileSync(DEVICES_FILE, JSON.stringify(devicesArray, null, 2), 'utf8');
            console.log(`✅ 攝影機設定檔儲存成功！`);

        } catch (error) {
            console.error(`❌ 儲存攝影機設定檔失敗:`, error);
        } finally {
            this.isSaving = false; // 解除鎖定
        }
    }

    /**
     * 發現網路上的ONVIF攝影機
     */
    async discoverCameras(timeout = 5000) {
        return new Promise((resolve) => {
            this.discoveredDevices.clear();
            const discovered = new Map();

            const deviceHandler = (cam, rinfo) => {
                if (discovered.has(rinfo.address)) return;

                const deviceInfo = {
                    ip: rinfo.address,
                    port: cam.port || 80,
                    hostname: cam.hostname,
                    serviceUrl: cam.xaddrs?.[0]?.href,
                };
                discovered.set(rinfo.address, deviceInfo);
                console.log(`📹 發現攝影機: ${deviceInfo.ip}`);
            };

            onvif.Discovery.once('error', (err) => {
                console.error('ONVIF 發現錯誤:', err);
                onvif.Discovery.removeListener('device', deviceHandler);
                resolve(Array.from(this.discoveredDevices.values()));
            });
            
            onvif.Discovery.on('device', deviceHandler);

            onvif.Discovery.probe();

            setTimeout(() => {
                onvif.Discovery.removeListener('device', deviceHandler);
                this.discoveredDevices = discovered;
                console.log(`✅ 發現結束，共找到 ${this.discoveredDevices.size} 台獨特攝影機`);
                resolve(Array.from(this.discoveredDevices.values()));
            }, timeout);
        });
    }

    /**
     * 新增並設定一台攝影機
     */
    async addDevice({ ip, port, username, password }) {
        if (this.devices.has(ip)) {
            console.log(`📹 攝影機 ${ip} 已存在，將進行更新`);
        }

        console.log(`[1/5] 正在連接攝影機 ${ip}...`);
        const cam = await new Promise((resolve, reject) => {
            new onvif.Cam({
                hostname: ip, username, password, port,
                timeout: 10000
            }, function(err) {
                if (err) return reject(new Error(`攝影機連接失敗: ${err.message}`));
                console.log(`[2/5] 攝影機 ${ip} 連接成功`);
                resolve(this);
            });
        });

        const deviceData = {
            ip, port, username, password,
            farmId: null, // 新增：場域ID
            farmName: '未分配', // 新增：場域名稱
            cam: cam, info: {}, profiles: [], streamUri: null, snapshotUri: null,
            connected: true, lastUpdate: new Date(), saved: true
        };

        console.log(`[3/5] 正在獲取 ${ip} 的媒體配置檔...`);
        deviceData.profiles = await new Promise((resolve, reject) => {
            cam.getProfiles((err, profiles) => {
                if (err || !profiles || profiles.length === 0) return reject(new Error('獲取媒體配置檔失敗或配置檔為空'));
                console.log(`📋 ${ip} 找到 ${profiles.length} 個配置檔`);
                resolve(profiles);
            });
        });

        const mainProfile = deviceData.profiles[0];

        console.log(`[4/5] 正在獲取 ${ip} 的串流 URI...`);
        deviceData.streamUri = await new Promise((resolve, reject) => {
            cam.getStreamUri({ profileToken: mainProfile.token }, (err, stream) => {
                if (err || !stream || !stream.uri) return reject(new Error('獲取串流 URI 失敗'));
                console.log(`🎥 ${ip} 的串流 URI: ${stream.uri}`);
                resolve(stream.uri);
            });
        });

        console.log(`[5/5] 正在獲取 ${ip} 的快照 URI (可選)...`);
        try {
            deviceData.snapshotUri = await new Promise((resolve) => {
                cam.getSnapshotUri({ profileToken: mainProfile.token }, (err, snapshot) => {
                    if (err || !snapshot || !snapshot.uri) {
                        console.warn(`無法獲取 ${ip} 的快照 URI，將忽略此錯誤`);
                        return resolve(null);
                    }
                    console.log(`📸 ${ip} 的快照 URI: ${snapshot.uri}`);
                    resolve(snapshot.uri);
                });
            });
        } catch (e) { /* 忽略快照錯誤 */ }

        this.devices.set(ip, deviceData);
        this.saveDevices();
        console.log(`✅ 攝影機 ${ip} 已成功新增並儲存`);
        
        const { cam: camInstance, ...deviceToReturn } = deviceData;
        return deviceToReturn;
    }

    /**
     * 為攝影機分配場域
     */
    assignFarm(ip, farmId, farmName) {
        if (this.devices.has(ip)) {
            const device = this.devices.get(ip);
            console.log(`🔄 正在為 ${ip} 分配場域: ${device.farmName} -> ${farmName}`);
            device.farmId = farmId;
            device.farmName = farmName;
            this.saveDevices(); // 呼叫帶有日誌和鎖的新版儲存函數
            console.log(`✅ 分配操作完成 for ${ip}.`);
            return true;
        }
        console.warn(`⚠️  嘗試分配場域失敗: 找不到攝影機 ${ip}`);
        return false;
    }

    /**
     * 移除一台攝影機
     */
    removeDevice(ip) {
        if (this.devices.has(ip)) {
            this.stopStreamConversion(ip);
            this.devices.delete(ip);
            this.saveDevices();
            console.log(`🗑️ 攝影機 ${ip} 已被移除`);
            return true;
        }
        return false;
    }

    /**
     * 取得所有設備（已儲存和新發現的）
     */
    getDevices() {
        const allDevices = new Map();
        
        for (const device of this.devices.values()) {
            const { cam, ...deviceData } = device;
            allDevices.set(device.ip, { ...deviceData, status: 'saved' });
        }

        for (const discovered of this.discoveredDevices.values()) {
            if (!allDevices.has(discovered.ip)) {
                allDevices.set(discovered.ip, { ...discovered, status: 'discovered' });
            }
        }
        return Array.from(allDevices.values());
    }

    /**
     * 開始串流轉換
     */
    async startStreamConversion(ip) {
        const device = this.devices.get(ip);
        if (!device || !device.streamUri) {
            throw new Error('攝影機未設定或無串流URI');
        }
        
        const outputDir = path.join(__dirname, '../public/streams', ip);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        } else {
            try {
                fs.readdirSync(outputDir).forEach(file => {
                    if (file.endsWith('.ts') || file.endsWith('.m3u8')) {
                        fs.unlinkSync(path.join(outputDir, file));
                    }
                });
            } catch (e) {
                console.warn(`清理舊串流檔案時出錯 for ${ip}:`, e.message);
            }
        }
        const playlistPath = path.join(outputDir, 'playlist.m3u8');
        const playlistUrl = `/streams/${ip}/playlist.m3u8`;

        return new Promise((resolve, reject) => {
            const ffmpegProcess = ffmpeg(device.streamUri)
                .inputOptions(['-rtsp_transport', 'tcp', '-re'])
                .outputOptions([
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-preset', 'ultrafast',
                    '-tune', 'zerolatency',
                    '-f', 'hls',
                    '-hls_time', '2',
                    '-hls_list_size', '3',
                    '-hls_flags', 'delete_segments'
                ])
                .output(playlistPath)
                .on('start', () => console.log(`🎬 開始串流轉換: ${ip}`))
                .on('error', (err) => {
                    console.error(`❌ 串流轉換錯誤 ${ip}:`, err.message);
                    if (err.message.includes('copy')) {
                        console.log(`⚠️  'copy' 模式失敗，嘗試使用 'libx264' 重新編碼 for ${ip}`);
                        this.stopStreamConversion(ip);
                        this.startStreamWithReencode(ip).then(resolve).catch(reject);
                    } else {
                        reject(err);
                    }
                })
                .on('end', () => console.log(`✅ 串流轉換結束: ${ip}`));

            ffmpegProcess.run();
            this.streams.set(ip, { process: ffmpegProcess, playlistPath: playlistUrl });
            
            const checkInterval = 500;
            const timeout = 15000;
            let elapsedTime = 0;

            const checkFile = setInterval(() => {
                fs.access(playlistPath, fs.constants.F_OK, (err) => {
                    if (!err) {
                        clearInterval(checkFile);
                        console.log(`✅ 播放列表 for ${ip} 已生成`);
                        resolve({ playlistUrl, status: 'streaming' });
                    } else {
                        elapsedTime += checkInterval;
                        if (elapsedTime >= timeout) {
                            clearInterval(checkFile);
                            console.error(`❌ 啟動串流超時 for ${ip}`);
                            this.stopStreamConversion(ip);
                            reject(new Error('啟動串流超時'));
                        }
                    }
                });
            }, checkInterval);
        });
    }

    /**
     * 使用重新編碼來啟動串流 (備用方法)
     */
    async startStreamWithReencode(ip) {
        const device = this.devices.get(ip);
        if (!device || !device.streamUri) throw new Error('攝影機未設定或無串流URI');
        
        const outputDir = path.join(__dirname, '../public/streams', ip);
        const playlistPath = path.join(outputDir, 'playlist.m3u8');
        const playlistUrl = `/streams/${ip}/playlist.m3u8`;

        return new Promise((resolve, reject) => {
            const ffmpegProcess = ffmpeg(device.streamUri)
                .inputOptions(['-rtsp_transport', 'tcp', '-re'])
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions(['-preset', 'ultrafast', '-tune', 'zerolatency', '-f', 'hls', '-hls_time', '2', '-hls_list_size', '3', '-hls_flags', 'delete_segments'])
                .output(playlistPath)
                .on('start', () => console.log(`🎬 [Re-encode] 開始串流轉換: ${ip}`))
                .on('error', (err) => {
                    console.error(`❌ [Re-encode] 串流轉換錯誤 ${ip}:`, err.message);
                    reject(err);
                })
                .on('end', () => console.log(`✅ [Re-encode] 串流轉換結束: ${ip}`));

            ffmpegProcess.run();
            this.streams.set(ip, { process: ffmpegProcess, playlistPath: playlistUrl });
            
            const checkInterval = 500;
            const timeout = 20000;
            let elapsedTime = 0;

            const checkFile = setInterval(() => {
                fs.access(playlistPath, fs.constants.F_OK, (err) => {
                    if (!err) {
                        clearInterval(checkFile);
                        console.log(`✅ [Re-encode] 播放列表 for ${ip} 已生成`);
                        resolve({ playlistUrl, status: 'streaming' });
                    } else {
                        elapsedTime += checkInterval;
                        if (elapsedTime >= timeout) {
                            clearInterval(checkFile);
                            console.error(`❌ [Re-encode] 啟動串流超時 for ${ip}`);
                            this.stopStreamConversion(ip);
                            reject(new Error('啟動串流超時 (Re-encode)'));
                        }
                    }
                });
            }, checkInterval);
        });
    }

    /**
     * 停止串流轉換
     */
    stopStreamConversion(ip) {
        const stream = this.streams.get(ip);
        if (stream && stream.process) {
            stream.process.kill('SIGTERM');
            this.streams.delete(ip);
            console.log(`⏹️ 已停止串流轉換: ${ip}`);
            return true;
        }
        return false;
    }

    getStreamStatus(ip) {
        return this.streams.has(ip);
    }
    
    cleanup() {
        console.log('🧹 清理ONVIF服務資源...');
        for (const ip of this.streams.keys()) {
            this.stopStreamConversion(ip);
        }
    }
}

module.exports = new ONVIFService();
