@echo off
chcp 65001 > nul
title FFmpeg 安裝 (Node.js版)

echo.
echo ========================================
echo      FFmpeg 安裝 (Node.js版)
echo ========================================
echo.

:: 檢查Node.js
node --version >nul 2>&1
if not %errorLevel% == 0 (
    echo [錯誤] 請先安裝Node.js
    echo 下載地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] 使用Node.js安裝FFmpeg...
echo [INFO] 這將自動下載並安裝FFmpeg到本地目錄
echo.

:: 運行Node.js安裝腳本
node install-ffmpeg.js

if %errorLevel% == 0 (
    echo.
    echo [✓] FFmpeg安裝完成！
) else (
    echo.
    echo [!] 安裝過程中出現問題
)

echo.
pause
