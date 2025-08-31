const onvif = require('onvif');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

class ONVIFService {
    constructor() {
        this.cameras = new Map();
        this.streams = new Map();
        this.snapshots = new Map();
        this.snapshotDir = path.join(__dirname, '../public/snapshots');
        
        // 確保快照目錄存在
        if (!fs.existsSync(this.snapshotDir)) {
            fs.mkdirSync(this.snapshotDir, { recursive: true });
        }
    }

    /**
     * 發現網路上的ONVIF攝影機
     */
    async discoverCameras(timeout = 5000) {
        return new Promise((resolve, reject) => {
            console.log('🔍 開始搜尋ONVIF攝影機...');
            
            // 清空之前的發現結果
            const discoveredCameras = new Map();
            
            onvif.Discovery.on('device', (cam, rinfo, xml) => {
                const cameraInfo = {
                    ip: rinfo.address,
                    port: cam.port || 80,
                    hostname: cam.hostname,
                    urn: cam.urn,
                    xaddrs: cam.xaddrs,
                    types: cam.types,
                    scopes: cam.scopes,
                    connected: false, // 發現但未連接
                    discovered: true, // 標記為已發現
                    lastUpdate: new Date()
                };
                
                console.log('📹 發現攝影機:', cameraInfo);
                discoveredCameras.set(rinfo.address, cameraInfo);
                
                // 同時保存到主攝影機列表
                this.cameras.set(rinfo.address, cameraInfo);
            });

            onvif.Discovery.on('error', (err, xml) => {
                console.error('ONVIF發現錯誤:', err);
            });

            onvif.Discovery.probe();

            setTimeout(() => {
                const cameras = Array.from(discoveredCameras.values());
                console.log(`✅ 發現 ${cameras.length} 台攝影機`);
                resolve(cameras);
            }, timeout);
        });
    }

    /**
     * 連接到指定的ONVIF攝影機
     */
    async connectCamera(ip, port, username, password) {
        return new Promise((resolve, reject) => {
            const cam = new onvif.Cam({
                hostname: ip,
                username: username,
                password: password,
                port: port || 80,
                timeout: 5000
            }, (err) => {
                if (err) {
                    console.error(`❌ 連接攝影機失敗 ${ip}:`, err.message);
                    reject(err);
                    return;
                }

                console.log(`✅ 成功連接攝影機 ${ip}`);
                
                // 獲取攝影機資訊
                cam.getDeviceInformation((err, info) => {
                    if (err) {
                        console.warn('無法獲取設備資訊:', err.message);
                    }
                    
                    const cameraData = {
                        ip: ip,
                        port: port,
                        username: username,
                        password: password,
                        cam: cam,
                        info: info || {},
                        profiles: [],
                        streamUri: null,
                        snapshotUri: null,
                        connected: true,
                        lastUpdate: new Date()
                    };

                    this.cameras.set(ip, cameraData);
                    resolve(cameraData);
                });
            });
        });
    }

    /**
     * 獲取攝影機的串流配置檔
     */
    async getCameraProfiles(ip) {
        const camera = this.cameras.get(ip);
        if (!camera || !camera.cam) {
            throw new Error('攝影機未連接');
        }

        return new Promise((resolve, reject) => {
            camera.cam.getProfiles((err, profiles) => {
                if (err) {
                    reject(err);
                    return;
                }

                camera.profiles = profiles;
                console.log(`📋 獲取到 ${profiles.length} 個配置檔`);
                resolve(profiles);
            });
        });
    }

    /**
     * 獲取串流URI
     */
    async getStreamUri(ip, profileIndex = 0) {
        const camera = this.cameras.get(ip);
        if (!camera || !camera.cam) {
            throw new Error('攝影機未連接');
        }

        if (camera.profiles.length === 0) {
            await this.getCameraProfiles(ip);
        }

        const profile = camera.profiles[profileIndex];
        if (!profile) {
            throw new Error('配置檔不存在');
        }

        return new Promise((resolve, reject) => {
            camera.cam.getStreamUri({
                stream: 'RTP-Unicast',
                protocol: 'RTSP',
                profileToken: profile.token
            }, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }

                camera.streamUri = stream.uri;
                console.log(`🎥 獲取串流URI: ${stream.uri}`);
                resolve(stream.uri);
            });
        });
    }

    /**
     * 獲取快照URI
     */
    async getSnapshotUri(ip, profileIndex = 0) {
        const camera = this.cameras.get(ip);
        if (!camera || !camera.cam) {
            throw new Error('攝影機未連接');
        }

        if (camera.profiles.length === 0) {
            await this.getCameraProfiles(ip);
        }

        const profile = camera.profiles[profileIndex];
        if (!profile) {
            throw new Error('配置檔不存在');
        }

        return new Promise((resolve, reject) => {
            camera.cam.getSnapshotUri({
                profileToken: profile.token
            }, (err, snapshot) => {
                if (err) {
                    reject(err);
                    return;
                }

                camera.snapshotUri = snapshot.uri;
                console.log(`📸 獲取快照URI: ${snapshot.uri}`);
                resolve(snapshot.uri);
            });
        });
    }

    /**
     * 拍攝快照並儲存到本地
     */
    async captureSnapshot(ip, filename) {
        const camera = this.cameras.get(ip);
        if (!camera || !camera.snapshotUri) {
            throw new Error('攝影機未連接或無快照URI');
        }

        const snapshotPath = path.join(this.snapshotDir, filename || `snapshot_${ip}_${Date.now()}.jpg`);
        
        return new Promise((resolve, reject) => {
            const https = require('https');
            const http = require('http');
            const url = require('url');
            
            const parsedUrl = url.parse(camera.snapshotUri);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.path,
                method: 'GET',
                auth: `${camera.username}:${camera.password}`
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
     * 開始串流轉換（RTSP轉HLS）
     */
    async startStreamConversion(ip, outputPath) {
        const camera = this.cameras.get(ip);
        if (!camera || !camera.streamUri) {
            throw new Error('攝影機未連接或無串流URI');
        }

        const outputDir = path.join(__dirname, '../public/streams', ip);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const playlistPath = path.join(outputDir, 'playlist.m3u8');

        return new Promise((resolve, reject) => {
            const ffmpegProcess = ffmpeg(camera.streamUri)
                .inputOptions([
                    '-rtsp_transport', 'tcp',
                    '-re'
                ])
                .outputOptions([
                    '-c:v', 'libx264',
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
                    console.log('FFmpeg命令:', commandLine);
                })
                .on('error', (err) => {
                    console.error(`❌ 串流轉換錯誤 ${ip}:`, err.message);
                    reject(err);
                })
                .on('end', () => {
                    console.log(`✅ 串流轉換結束: ${ip}`);
                });

            ffmpegProcess.run();
            
            this.streams.set(ip, {
                process: ffmpegProcess,
                playlistPath: `/streams/${ip}/playlist.m3u8`,
                startTime: new Date()
            });

            // 等待一段時間讓串流開始
            setTimeout(() => {
                resolve({
                    playlistUrl: `/streams/${ip}/playlist.m3u8`,
                    status: 'streaming'
                });
            }, 3000);
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
     * 獲取所有攝影機（包括已連接和已發現的）
     */
    getConnectedCameras() {
        const cameras = [];
        for (const [ip, camera] of this.cameras) {
            // 返回所有攝影機，包括已連接和已發現的
            cameras.push({
                ip: ip,
                port: camera.port || 80,
                info: camera.info || {},
                profiles: camera.profiles ? camera.profiles.length : 0,
                hasStream: !!camera.streamUri,
                hasSnapshot: !!camera.snapshotUri,
                isStreaming: this.streams.has(ip),
                lastSnapshot: this.snapshots.get(ip),
                lastUpdate: camera.lastUpdate,
                connected: camera.connected || false,
                discovered: camera.discovered || false,
                hostname: camera.hostname,
                urn: camera.urn
            });
        }
        return cameras;
    }

    /**
     * 斷開攝影機連接
     */
    disconnectCamera(ip) {
        this.stopStreamConversion(ip);
        
        const camera = this.cameras.get(ip);
        if (camera) {
            camera.connected = false;
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
}

module.exports = new ONVIFService();
