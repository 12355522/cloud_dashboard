@echo off
title 畜牧業管理系統 - 簡易部署

echo.
echo ========================================
echo      畜牧業管理系統 - 簡易部署
echo ========================================
echo.

:: 基本檢查
echo [1/4] 檢查Node.js...
node --version >nul 2>&1
if not %errorLevel% == 0 (
    echo [錯誤] 請先安裝Node.js
    echo 下載地址: https://nodejs.org/
    pause
    exit
)
echo [完成] Node.js已安裝

echo.
echo [2/4] 檢查專案文件...
if not exist package.json (
    echo [錯誤] 找不到package.json，請確認在正確目錄
    pause
    exit
)
echo [完成] 專案文件正常

echo.
echo [3/4] 安裝依賴...
echo 正在安裝，請稍候...
npm install --silent
if not %errorLevel% == 0 (
    echo [錯誤] 依賴安裝失敗
    pause
    exit
)
echo [完成] 依賴安裝完成

echo.
echo [4/4] 創建目錄...
if not exist "public\snapshots" mkdir "public\snapshots"
if not exist "public\streams" mkdir "public\streams"
echo [完成] 目錄創建完成

echo.
echo ========================================
echo              部署完成！
echo ========================================
echo.
echo 系統地址: http://localhost:3000
echo 攝影機管理: http://localhost:3000/onvif-cameras
echo.
echo 按任意鍵啟動系統...
pause

echo.
echo 正在啟動系統...
npm start

pause
