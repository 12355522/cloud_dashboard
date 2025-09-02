#!/usr/bin/env node

const http = require('http');

const CAMERA_IP = '192.168.1.52';
const CAMERA_PORT = 80;
const CAMERA_USER = 'admin';
const CAMERA_PASS = 'admin';
const SERVER_URL = 'http://localhost:3000';

console.log('========================================');
console.log('    攝影機測試腳本 - 192.168.1.52:80');
console.log('========================================\n');

// 發送HTTP請求的輔助函數
function makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SERVER_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    resolve({ status: res.statusCode, data: result });
                } catch (error) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

// 測試網路連接
async function testNetworkConnection() {
    console.log('[1/5] 測試網路連接...');
    try {
        const result = await makeRequest('/api/onvif/test-connection', 'POST', {
            ip: CAMERA_IP,
            port: CAMERA_PORT
        });

        if (result.status === 200 && result.data.success) {
            console.log('✅ 網路連接測試成功');
            console.log(`   結果: ${result.data.message}`);
        } else {
            console.log('❌ 網路連接測試失敗');
            console.log(`   錯誤: ${result.data.error || '未知錯誤'}`);
        }
    } catch (error) {
        console.log('❌ 網路連接測試異常');
        console.log(`   錯誤: ${error.message}`);
    }
    console.log('');
}

// 測試ONVIF連接
async function testONVIFConnection() {
    console.log('[2/5] 測試ONVIF連接...');
    try {
        const result = await makeRequest('/api/onvif/connect', 'POST', {
            ip: CAMERA_IP,
            port: CAMERA_PORT,
            username: CAMERA_USER,
            password: CAMERA_PASS
        });

        if (result.status === 200 && result.data.success) {
            console.log('✅ ONVIF連接成功');
            console.log(`   攝影機: ${result.data.camera.ip}:${result.data.camera.port}`);
            console.log(`   配置檔: ${result.data.camera.profiles} 個`);
            console.log(`   訊息: ${result.data.message}`);
            return true;
        } else {
            console.log('❌ ONVIF連接失敗');
            console.log(`   錯誤: ${result.data.error || '未知錯誤'}`);
            return false;
        }
    } catch (error) {
        console.log('❌ ONVIF連接異常');
        console.log(`   錯誤: ${error.message}`);
        return false;
    }
    console.log('');
}

// 測試快照功能
async function testSnapshot() {
    console.log('[3/5] 測試快照功能...');
    try {
        const result = await makeRequest(`/api/onvif/snapshot/${CAMERA_IP}`, 'POST');

        if (result.status === 200 && result.data.success) {
            console.log('✅ 快照拍攝成功');
            console.log(`   檔案: ${result.data.snapshot.filename}`);
            console.log(`   路徑: ${result.data.snapshot.path}`);
            return true;
        } else {
            console.log('❌ 快照拍攝失敗');
            console.log(`   錯誤: ${result.data.error || '未知錯誤'}`);
            return false;
        }
    } catch (error) {
        console.log('❌ 快照測試異常');
        console.log(`   錯誤: ${error.message}`);
        return false;
    }
    console.log('');
}

// 測試串流功能
async function testStream() {
    console.log('[4/5] 測試串流功能...');
    try {
        const result = await makeRequest(`/api/onvif/stream/start/${CAMERA_IP}`, 'POST');

        if (result.status === 200 && result.data.success) {
            console.log('✅ 串流啟動成功');
            console.log(`   串流URL: ${result.data.stream.playlistUrl}`);
            console.log(`   狀態: ${result.data.stream.status}`);
            return true;
        } else {
            console.log('❌ 串流啟動失敗');
            console.log(`   錯誤: ${result.data.error || '未知錯誤'}`);
            return false;
        }
    } catch (error) {
        console.log('❌ 串流測試異常');
        console.log(`   錯誤: ${error.message}`);
        return false;
    }
    console.log('');
}

// 測試串流播放
async function testStreamPlayback() {
    console.log('[5/5] 測試串流播放...');
    try {
        const streamUrl = `${SERVER_URL}/streams/${CAMERA_IP}/playlist.m3u8`;
        console.log(`   串流地址: ${streamUrl}`);
        console.log('   請在瀏覽器中打開以下網址測試播放:');
        console.log(`   ${SERVER_URL}/test-camera-stream.html`);
        console.log('   或直接訪問攝影機管理頁面:');
        console.log(`   ${SERVER_URL}/onvif-cameras`);
        return true;
    } catch (error) {
        console.log('❌ 串流播放測試異常');
        console.log(`   錯誤: ${error.message}`);
        return false;
    }
    console.log('');
}

// 主測試函數
async function runTests() {
    console.log('開始測試攝影機功能...\n');
    
    await testNetworkConnection();
    const connected = await testONVIFConnection();
    
    if (connected) {
        await testSnapshot();
        await testStream();
        await testStreamPlayback();
    } else {
        console.log('⚠️  由於ONVIF連接失敗，跳過後續測試');
    }
    
    console.log('========================================');
    console.log('           測試完成');
    console.log('========================================');
    console.log('\n如果測試成功，您可以:');
    console.log('1. 訪問攝影機管理頁面查看攝影機狀態');
    console.log('2. 使用測試頁面播放即時影像');
    console.log('3. 查看快照檔案');
    console.log('\n測試頁面: http://localhost:3000/test-camera-stream.html');
    console.log('管理頁面: http://localhost:3000/onvif-cameras');
}

// 執行測試
if (require.main === module) {
    runTests().catch(console.error);
}
