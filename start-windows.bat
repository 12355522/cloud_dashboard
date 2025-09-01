@echo off
chcp 65001 > nul
title 畜牧業管理系統

echo.
echo ==========================================
echo        畜牧業管理系統 - 快速啟動
echo ==========================================
echo.

:: 設置環境變數
set SCRIPT_DIR=%~dp0
set PATH=%SCRIPT_DIR%ffmpeg\bin;%PATH%
set NODE_ENV=production

echo [i] 當前目錄: %SCRIPT_DIR%
echo [i] 系統將在 http://localhost:3000 啟動
echo [i] ONVIF攝影機管理: http://localhost:3000/onvif-cameras
echo [i] 按Ctrl+C停止服務
echo.

:: 檢查FFmpeg
if exist "%SCRIPT_DIR%ffmpeg\bin\ffmpeg.exe" (
    echo [✓] FFmpeg已就緒
) else (
    echo [!] FFmpeg未找到，請先運行 deploy-windows.bat
)

:: 檢查Node.js
node --version >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] Node.js已就緒
) else (
    echo [!] Node.js未安裝，請先運行 deploy-windows.bat
    pause
    exit /b 1
)

:: 啟動應用
npm start

pause
