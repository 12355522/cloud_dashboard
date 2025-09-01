@echo off
chcp 65001 > nul
title 畜牧業管理系統 - 快速啟動

echo.
echo ========================================
echo      畜牧業管理系統 - 快速啟動
echo ========================================
echo.

:: 檢查Node.js
echo [檢查] Node.js...
node --version >nul 2>&1
if not %errorLevel% == 0 (
    echo [錯誤] 請先安裝Node.js: https://nodejs.org/
    pause
    exit
)
echo [✓] Node.js 已安裝

:: 檢查依賴
echo [檢查] 專案依賴...
if not exist node_modules (
    echo [安裝] 正在安裝依賴...
    npm install --silent
    if not %errorLevel% == 0 (
        echo [錯誤] 依賴安裝失敗
        pause
        exit
    )
)
echo [✓] 依賴已安裝

:: 檢查FFmpeg
echo [檢查] FFmpeg...
where ffmpeg >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] 系統FFmpeg已安裝
) else (
    if exist "ffmpeg\bin\ffmpeg.exe" (
        echo [✓] 本地FFmpeg已安裝
        set PATH=ffmpeg\bin;%PATH%
    ) else (
        echo [!] 未找到FFmpeg
        echo [INFO] 影像串流功能將不可用
        echo [FIX] 運行 install-ffmpeg-only.bat 安裝FFmpeg
        echo.
        echo 是否繼續啟動（無串流功能）？(Y/N)
        set /p CONTINUE=
        if /i not "%CONTINUE%"=="Y" exit
    )
)

:: 創建目錄
if not exist "public\snapshots" mkdir "public\snapshots" >nul 2>&1
if not exist "public\streams" mkdir "public\streams" >nul 2>&1

:: 啟動系統
echo.
echo ========================================
echo            系統啟動中...
echo ========================================
echo.
echo [INFO] 系統地址: http://localhost:3000
echo [INFO] 攝影機管理: http://localhost:3000/onvif-cameras
echo [INFO] 按 Ctrl+C 停止服務
echo.

:: 設置環境
set NODE_ENV=production
if exist "ffmpeg\bin" set PATH=ffmpeg\bin;%PATH%

:: 啟動
npm start

echo.
echo [INFO] 系統已停止
pause
