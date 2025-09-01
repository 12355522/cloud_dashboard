#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('\n========================================');
console.log('       FFmpeg 安裝工具 (Node.js版)');
console.log('========================================\n');

const FFMPEG_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
const TEMP_DIR = require('os').tmpdir();
const ZIP_PATH = path.join(TEMP_DIR, 'ffmpeg.zip');
const EXTRACT_DIR = path.join(TEMP_DIR, 'ffmpeg-extract');
const INSTALL_DIR = path.join(__dirname, 'ffmpeg');

async function checkExisting() {
    console.log('[1/4] 檢查現有安裝...');
    
    // 檢查系統FFmpeg
    try {
        const version = execSync('ffmpeg -version', { encoding: 'utf8', stdio: 'pipe' });
        if (version.includes('ffmpeg version')) {
            console.log('[✓] 系統已安裝FFmpeg');
            console.log(version.split('\n')[0]);
            return true;
        }
    } catch (e) {
        // 系統未安裝FFmpeg
    }
    
    // 檢查本地安裝
    const localFFmpeg = path.join(INSTALL_DIR, 'bin', 'ffmpeg.exe');
    if (fs.existsSync(localFFmpeg)) {
        console.log('[✓] 本地已安裝FFmpeg');
        console.log(`位置: ${localFFmpeg}`);
        return true;
    }
    
    console.log('[!] 未找到FFmpeg，需要安裝');
    return false;
}

async function downloadFFmpeg() {
    console.log('\n[2/4] 下載FFmpeg...');
    console.log(`下載地址: ${FFMPEG_URL}`);
    console.log('正在下載，請稍候...');
    
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(ZIP_PATH);
        
        const request = https.get(FFMPEG_URL, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // 處理重定向
                return https.get(response.headers.location, (redirectResponse) => {
                    const totalSize = parseInt(redirectResponse.headers['content-length'], 10);
                    let downloadedSize = 0;
                    
                    redirectResponse.on('data', (chunk) => {
                        downloadedSize += chunk.length;
                        const progress = Math.round((downloadedSize / totalSize) * 100);
                        process.stdout.write(`\r進度: ${progress}% (${Math.round(downloadedSize / 1024 / 1024)}MB)`);
                    });
                    
                    redirectResponse.pipe(file);
                    
                    file.on('finish', () => {
                        console.log('\n[✓] 下載完成');
                        file.close();
                        resolve();
                    });
                });
            } else {
                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;
                
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize) {
                        const progress = Math.round((downloadedSize / totalSize) * 100);
                        process.stdout.write(`\r進度: ${progress}% (${Math.round(downloadedSize / 1024 / 1024)}MB)`);
                    }
                });
                
                response.pipe(file);
            }
            
            file.on('finish', () => {
                console.log('\n[✓] 下載完成');
                file.close();
                resolve();
            });
        });
        
        request.on('error', (err) => {
            fs.unlink(ZIP_PATH, () => {}); // 清理文件
            reject(new Error(`下載失敗: ${err.message}`));
        });
        
        file.on('error', (err) => {
            fs.unlink(ZIP_PATH, () => {}); // 清理文件
            reject(err);
        });
    });
}

async function extractFFmpeg() {
    console.log('\n[3/4] 解壓FFmpeg...');
    
    try {
        // 使用PowerShell解壓
        const psCommand = `Expand-Archive -Path "${ZIP_PATH}" -DestinationPath "${EXTRACT_DIR}" -Force`;
        execSync(`powershell -Command "& {${psCommand}}"`, { stdio: 'pipe' });
        console.log('[✓] 解壓完成');
        
        // 查找解壓後的目錄
        const extractedDirs = fs.readdirSync(EXTRACT_DIR).filter(name => name.startsWith('ffmpeg-'));
        if (extractedDirs.length === 0) {
            throw new Error('找不到解壓後的FFmpeg目錄');
        }
        
        const sourceDir = path.join(EXTRACT_DIR, extractedDirs[0]);
        
        // 移動文件到目標目錄
        if (fs.existsSync(INSTALL_DIR)) {
            fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
        }
        
        // 複製文件
        copyDirectory(sourceDir, INSTALL_DIR);
        console.log(`[✓] 安裝到: ${INSTALL_DIR}`);
        
    } catch (error) {
        throw new Error(`解壓失敗: ${error.message}`);
    }
}

function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

async function verifyInstallation() {
    console.log('\n[4/4] 驗證安裝...');
    
    const ffmpegExe = path.join(INSTALL_DIR, 'bin', 'ffmpeg.exe');
    
    if (!fs.existsSync(ffmpegExe)) {
        throw new Error('FFmpeg安裝失敗：找不到執行文件');
    }
    
    try {
        const version = execSync(`"${ffmpegExe}" -version`, { encoding: 'utf8', stdio: 'pipe' });
        console.log('[✓] FFmpeg安裝成功！');
        console.log(version.split('\n')[0]);
        console.log(`安裝位置: ${ffmpegExe}`);
        return true;
    } catch (error) {
        throw new Error('FFmpeg無法運行');
    }
}

async function cleanup() {
    // 清理臨時文件
    try {
        if (fs.existsSync(ZIP_PATH)) {
            fs.unlinkSync(ZIP_PATH);
        }
        if (fs.existsSync(EXTRACT_DIR)) {
            fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
        }
    } catch (error) {
        console.log('[警告] 清理臨時文件失敗:', error.message);
    }
}

async function main() {
    try {
        const existing = await checkExisting();
        
        if (existing) {
            console.log('\n[INFO] FFmpeg已安裝，無需重複安裝');
            console.log('[INFO] 如需重新安裝，請先刪除現有安裝');
            return;
        }
        
        await downloadFFmpeg();
        await extractFFmpeg();
        await verifyInstallation();
        await cleanup();
        
        console.log('\n========================================');
        console.log('           安裝完成！');
        console.log('========================================');
        console.log('[INFO] 現在可以使用影像串流功能');
        console.log('[INFO] 運行: npm start 啟動系統');
        
    } catch (error) {
        console.error('\n[錯誤]', error.message);
        console.log('\n[建議解決方案]:');
        console.log('1. 檢查網路連接');
        console.log('2. 確保有足夠磁碟空間');
        console.log('3. 檢查防毒軟體是否阻擋');
        console.log('4. 以管理員權限運行');
        
        await cleanup();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
