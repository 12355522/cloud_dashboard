const onvif = require('onvif');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// 新增：持久化儲存路徑
const DEVICES_FILE = path.join(__dirname, 'onvif-devices.json');

class ONVIFService {
    constructor() {
        this.devices = new Map(); // 用於儲存已設定的設備
        this.discoveredDevices = new Map(); // 僅儲存當次發現的設備
        this.streams = new Map();
        this.snapshots = new Map();
        this.snapshotDir = path.join(__dirname, '../public/snapshots');
        
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
        try {
            const devicesArray = Array.from(this.devices.values()).map(device => {
                // 移除不可序列化的 cam 物件
                const { cam, ...deviceToSave } = device;
                return deviceToSave;
            });
            fs.writeFileSync(DEVICES_FILE, JSON.stringify(devicesArray, null, 2), 'utf8');
            console.log(`💾 已儲存 ${devicesArray.length} 台攝影機到 ${DEVICES_FILE}`);
        } catch (error) {
            console.error(`❌ 儲存攝影機設定檔失敗:`, error);
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
                // 避免重複
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
                if (err) {
                    return reject(new Error(`攝影機連接失敗: ${err.message}`));
                }
                console.log(`[2/5] 攝影機 ${ip} 連接成功`);
                resolve(this);
            });
        });

        const deviceData = {
            ip, port, username, password,
            cam: cam, info: {}, profiles: [], streamUri: null, snapshotUri: null,
            connected: true, lastUpdate: new Date(), saved: true
        };

        console.log(`[3/5] 正在獲取 ${ip} 的媒體配置檔...`);
        deviceData.profiles = await new Promise((resolve, reject) => {
            cam.getProfiles((err, profiles) => {
                if (err || !profiles || profiles.length === 0) {
                    return reject(new Error('獲取媒體配置檔失敗或配置檔為空'));
                }
                console.log(`📋 ${ip} 找到 ${profiles.length} 個配置檔`);
                resolve(profiles);
            });
        });

        const mainProfile = deviceData.profiles[0];

        console.log(`[4/5] 正在獲取 ${ip} 的串流 URI...`);
        deviceData.streamUri = await new Promise((resolve, reject) => {
            cam.getStreamUri({ profileToken: mainProfile.token }, (err, stream) => {
                if (err || !stream || !stream.uri) {
                    return reject(new Error('獲取串流 URI 失敗'));
                }
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
        
        // 返回不包含 cam 物件的純資料
        const { cam: camInstance, ...deviceToReturn } = deviceData;
        return deviceToReturn;
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
        
        // 先加入所有已儲存的設備
        for (const device of this.devices.values()) {
            const { cam, ...deviceData } = device;
            allDevices.set(device.ip, { ...deviceData, status: 'saved' });
        }

        // 再加入新發現且未儲存的設備
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

        // 重新實例化 cam 物件以確保連線
        if (!device.cam) {
            console.log(`Re-instantiating cam for ${ip}`);
            device.cam = new onvif.Cam({
                hostname: ip,
                username: device.username,
                password: device.password,
                port: device.port
            });
        }
        
        const outputDir = path.join(__dirname, '../public/streams', ip);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const playlistPath = path.join(outputDir, 'playlist.m3u8');

        return new Promise((resolve, reject) => {
            const ffmpegProcess = ffmpeg(device.streamUri)
                .inputOptions(['-rtsp_transport', 'tcp', '-re'])
                .outputOptions([
                    '-c:v', 'copy', // 嘗試直接複製視訊流以降低CPU負載
                    '-c:a', 'aac',
                    '-preset', 'ultrafast',
                    '-tune', 'zerolatency',
                    '-f', 'hls',
                    '-hls_time', '2',
                    '-hls_list_size', '3',
                    '-hls_flags', 'delete_segments'
                ])
                .output(playlistPath)
                .on('start', (commandLine) => {
                    console.log(`🎬 開始串流轉換: ${ip}`);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error(`❌ 串流轉換錯誤 ${ip}:`, err.message);
                     // 如果 'copy' 失敗，嘗試重新編碼
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
            this.streams.set(ip, { process: ffmpegProcess, playlistPath: `/streams/${ip}/playlist.m3u8` });
            setTimeout(() => resolve({ playlistUrl: `/streams/${ip}/playlist.m3u8`, status: 'streaming' }), 3000);
        });
    }

    /**
     * 使用重新編碼來啟動串流 (備用方法)
     */
    async startStreamWithReencode(ip) {
         const device = this.devices.get(ip);
        if (!device || !device.streamUri) {
            throw new Error('攝影機未設定或無串流URI');
        }
        const outputDir = path.join(__dirname, '../public/streams', ip);
        const playlistPath = path.join(outputDir, 'playlist.m3u8');

        return new Promise((resolve, reject) => {
            const ffmpegProcess = ffmpeg(device.streamUri)
                .inputOptions(['-rtsp_transport', 'tcp', '-re'])
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions(['-preset', 'ultrafast', '-tune', 'zerolatency', '-f', 'hls', '-hls_time', '2', '-hls_list_size', '3', '-hls_flags', 'delete_segments'])
                .output(playlistPath)
                .on('start', (commandLine) => console.log(`🎬 [Re-encode] 開始串流轉換: ${ip}`))
                .on('error', (err) => {
                    console.error(`❌ [Re-encode] 串流轉換錯誤 ${ip}:`, err.message);
                    reject(err);
                })
                .on('end', () => console.log(`✅ [Re-encode] 串流轉換結束: ${ip}`));

            ffmpegProcess.run();
            this.streams.set(ip, { process: ffmpegProcess, playlistPath: `/streams/${ip}/playlist.m3u8` });
            setTimeout(() => resolve({ playlistUrl: `/streams/${ip}/playlist.m3u8`, status: 'streaming' }), 5000); // 重新編碼需要更長啟動時間
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

    /**
     * 拍攝快照並儲存到本地
     */
    async captureSnapshot(ip, filename) {
        const device = this.devices.get(ip);
        if (!device || !device.snapshotUri) {
            throw new Error('攝影機未設定或無快照URI');
        }

        const snapshotPath = path.join(this.snapshotDir, filename || `snapshot_${ip}_${Date.now()}.jpg`);
        
        return new Promise((resolve, reject) => {
            const https = require('https');
            const http = require('http');
            const url = require('url');
            
            const parsedUrl = url.parse(device.snapshotUri);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.path,
                method: 'GET',
                auth: `${device.username}:${device.password}`
            };

            const req = client.request(options, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }

                const fileStream = fs.createWriteStream(snapshotPath);
                res.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`📸 快照已儲存: ${snapshotPath}`);
                    
                    // 儲存快照資訊
                    this.snapshots.set(ip, {
                        filename: path.basename(snapshotPath),
                        path: snapshotPath,
                        timestamp: new Date(),
                        size: fs.statSync(snapshotPath).size
                    });
                    
                    resolve({
                        filename: path.basename(snapshotPath),
                        path: `/snapshots/${path.basename(snapshotPath)}`,
                        timestamp: new Date()
                    });
                });

                fileStream.on('error', reject);
            });

            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('請求超時'));
            });
            
            req.end();
        });
    }

    /**
     * 獲取攝影機的串流配置檔
     */
    async getCameraProfiles(ip) {
        const device = this.devices.get(ip);
        if (!device || !device.cam) {
            throw new Error('攝影機未連接');
        }

        return new Promise((resolve, reject) => {
            device.cam.getProfiles((err, profiles) => {
                if (err) {
                    reject(err);
                    return;
                }

                device.profiles = profiles;
                console.log(`📋 獲取到 ${profiles.length} 個配置檔`);
                resolve(profiles);
            });
        });
    }

    /**
     * 獲取串流URI
     */
    async getStreamUri(ip, profileIndex = 0) {
        const device = this.devices.get(ip);
        if (!device || !device.cam) {
            throw new Error('攝影機未連接');
        }

        if (device.profiles.length === 0) {
            await this.getCameraProfiles(ip);
        }

        const profile = device.profiles[profileIndex];
        if (!profile) {
            throw new Error('配置檔不存在');
        }

        return new Promise((resolve, reject) => {
            device.cam.getStreamUri({
                stream: 'RTP-Unicast',
                protocol: 'RTSP',
                profileToken: profile.token
            }, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }

                device.streamUri = stream.uri;
                console.log(`🎥 獲取串流URI: ${stream.uri}`);
                resolve(stream.uri);
            });
        });
    }

    /**
     * 獲取快照URI
     */
    async getSnapshotUri(ip, profileIndex = 0) {
        const device = this.devices.get(ip);
        if (!device || !device.cam) {
            throw new Error('攝影機未連接');
        }

        if (device.profiles.length === 0) {
            await this.getCameraProfiles(ip);
        }

        const profile = device.profiles[profileIndex];
        if (!profile) {
            throw new Error('配置檔不存在');
        }

        return new Promise((resolve, reject) => {
            device.cam.getSnapshotUri({
                profileToken: profile.token
            }, (err, snapshot) => {
                if (err) {
                    reject(err);
                    return;
                }

                device.snapshotUri = snapshot.uri;
                console.log(`📸 獲取快照URI: ${snapshot.uri}`);
                resolve(snapshot.uri);
            });
        });
    }

    /**
     * 獲取所有攝影機（包括已連接和已發現的）
     */
    getConnectedCameras() {
        const cameras = [];
        for (const [ip, device] of this.devices) {
            // 返回所有攝影機，包括已連接和已發現的
            cameras.push({
                ip: ip,
                port: device.port || 80,
                info: device.info || {},
                profiles: device.profiles ? device.profiles.length : 0,
                hasStream: !!device.streamUri,
                hasSnapshot: !!device.snapshotUri,
                isStreaming: this.streams.has(ip),
                lastSnapshot: this.snapshots.get(ip),
                lastUpdate: device.lastUpdate,
                connected: device.connected || false,
                discovered: this.discoveredDevices.has(ip), // 檢查是否是新發現的
                hostname: device.hostname,
                urn: device.urn
            });
        }
        return cameras;
    }

    /**
     * 斷開攝影機連接
     */
    disconnectCamera(ip) {
        this.stopStreamConversion(ip);
        
        const device = this.devices.get(ip);
        if (device) {
            device.connected = false;
            console.log(`🔌 已斷開攝影機連接: ${ip}`);
        }
    }

    /**
     * 清理資源
     */
    cleanup() {
        console.log('🧹 清理ONVIF服務資源...');
        
        // 停止所有串流
        for (const ip of this.streams.keys()) {
            this.stopStreamConversion(ip);
        }
        
        // 清理快照檔案（保留最近的）
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24小時
        
        for (const [ip, snapshot] of this.snapshots) {
            if (now - snapshot.timestamp.getTime() > maxAge) {
                try {
                    fs.unlinkSync(snapshot.path);
                    this.snapshots.delete(ip);
                    console.log(`🗑️ 已清理過期快照: ${snapshot.filename}`);
                } catch (err) {
                    console.warn('清理快照失敗:', err.message);
                }
            }
        }
    }

    getStreamStatus(ip) {
        return this.streams.has(ip);
    }
}

module.exports = new ONVIFService();
