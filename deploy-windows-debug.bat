@echo off
chcp 65001 > nul
title 畜牧業管理系統 - Windows部署腳本（調試版）

echo.
echo ==========================================
echo  畜牧業管理系統 - Windows部署腳本（調試版）
echo ==========================================
echo.
echo [INFO] 此版本包含詳細的調試信息，幫助診斷問題
echo [INFO] 如果遇到問題，請截圖所有輸出信息
echo.

:: 基本信息
echo [DEBUG] =========================
echo [DEBUG] 系統基本信息
echo [DEBUG] =========================
echo [DEBUG] 當前用戶: %USERNAME%
echo [DEBUG] 當前目錄: %CD%
echo [DEBUG] 腳本目錄: %~dp0
echo [DEBUG] 系統版本:
ver
echo [DEBUG] =========================
echo.

:: 暫停讓用戶看清信息
echo 按任意鍵繼續...
pause

:: 檢查管理員權限（非強制）
echo [1/7] 檢查權限...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] 以管理員身份運行
) else (
    echo [!] 未以管理員身份運行
    echo [!] 某些功能可能無法正常使用（如FFmpeg安裝）
    echo [!] 建議右鍵點擊"以管理員身份運行"
    echo.
    echo 是否繼續？(Y/N)
    set /p CONTINUE=
    if /i not "%CONTINUE%"=="Y" exit /b 1
)

:: 檢查Node.js
echo.
echo [2/7] 檢查Node.js...
where node >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] 找到Node.js
    node --version 2>&1
    if %errorLevel% == 0 (
        echo [✓] Node.js運行正常
    ) else (
        echo [!] Node.js無法運行
        goto :node_error
    )
) else (
    echo [!] 未找到Node.js
    :node_error
    echo.
    echo [ERROR] Node.js問題
    echo [FIX] 請訪問 https://nodejs.org/ 下載並安裝Node.js LTS版本
    echo [FIX] 安裝完成後重新運行此腳本
    echo.
    pause
    exit /b 1
)

:: 檢查npm
echo.
echo [3/7] 檢查npm...
where npm >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] 找到npm
    npm --version 2>&1
    if %errorLevel__ == 0 (
        echo [✓] npm運行正常
    ) else (
        echo [!] npm無法運行，請重新安裝Node.js
        pause
        exit /b 1
    )
) else (
    echo [!] 未找到npm，請重新安裝Node.js
    pause
    exit /b 1
)

:: 檢查專案文件
echo.
echo [4/7] 檢查專案文件...
if exist package.json (
    echo [✓] 找到package.json
    echo [DEBUG] package.json內容預覽:
    type package.json | findstr /i "name\|version\|main"
) else (
    echo [!] 找不到package.json
    echo [ERROR] 請確保在正確的專案目錄中運行此腳本
    echo [DEBUG] 當前目錄內容:
    dir /b
    echo.
    pause
    exit /b 1
)

if exist server.js (
    echo [✓] 找到server.js
) else (
    echo [!] 找不到server.js，可能不在正確目錄
)

:: 創建必要目錄
echo.
echo [5/7] 創建目錄...
if not exist "public\snapshots" (
    mkdir "public\snapshots" 2>nul
    if exist "public\snapshots" (
        echo [✓] 創建snapshots目錄
    ) else (
        echo [!] 無法創建snapshots目錄
    )
) else (
    echo [✓] snapshots目錄已存在
)

if not exist "public\streams" (
    mkdir "public\streams" 2>nul
    if exist "public\streams" (
        echo [✓] 創建streams目錄
    ) else (
        echo [!] 無法創建streams目錄
    )
) else (
    echo [✓] streams目錄已存在
)

:: 安裝依賴
echo.
echo [6/7] 安裝依賴...
echo [INFO] 這可能需要幾分鐘時間，請耐心等待...
echo [DEBUG] 執行命令: npm install

npm install
set INSTALL_RESULT=%errorLevel%

if %INSTALL_RESULT__ == 0 (
    echo [✓] 依賴安裝成功
) else (
    echo [!] 依賴安裝失敗，錯誤代碼: %INSTALL_RESULT%
    echo.
    echo [DEBUG] 可能的解決方案:
    echo [FIX] 1. 檢查網路連接
    echo [FIX] 2. 清除npm緩存: npm cache clean --force
    echo [FIX] 3. 刪除node_modules資料夾後重試
    echo [FIX] 4. 使用國內鏡像: npm config set registry https://registry.npmmirror.com
    echo.
    echo 是否繼續啟動（忽略安裝錯誤）？(Y/N)
    set /p CONTINUE_ANYWAY=
    if /i not "%CONTINUE_ANYWAY%"=="Y" (
        pause
        exit /b 1
    )
)

:: 檢查FFmpeg（可選）
echo.
echo [7/7] 檢查FFmpeg（影像串流功能）...
where ffmpeg >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] 系統已安裝FFmpeg
    ffmpeg -version 2>nul | findstr "ffmpeg version"
) else (
    if exist "ffmpeg\bin\ffmpeg.exe" (
        echo [✓] 找到本地FFmpeg
        set PATH=ffmpeg\bin;%PATH%
    ) else (
        echo [!] 未找到FFmpeg
        echo [INFO] FFmpeg用於影像串流功能
        echo [INFO] 如不需要串流功能可以跳過
        echo [INFO] 手動安裝: 下載FFmpeg到 ffmpeg\bin\ 目錄
    )
)

:: 最終檢查
echo.
echo ==========================================
echo              部署檢查完成
echo ==========================================
echo.
echo [INFO] 準備啟動系統...
echo [INFO] 啟動後請訪問: http://localhost:3000
echo [INFO] 攝影機管理: http://localhost:3000/onvif-cameras
echo.
echo [WARNING] 如果啟動失敗，請檢查:
echo [WARNING] 1. 端口3000是否被占用
echo [WARNING] 2. MongoDB是否運行（如果使用數據庫）
echo [WARNING] 3. 防火牆是否阻擋
echo.

set /p START_NOW=是否現在啟動系統？(Y/N): 
if /i not "%START_NOW%"=="Y" (
    echo [INFO] 部署檢查完成，您可以稍後運行 start-windows.bat 啟動系統
    pause
    exit /b 0
)

:: 啟動應用
echo.
echo ==========================================
echo               啟動系統
echo ==========================================
echo.
echo [INFO] 正在啟動...
echo [INFO] 按 Ctrl+C 停止服務

:: 設置環境
set NODE_ENV=production
if exist "ffmpeg\bin" set PATH=ffmpeg\bin;%PATH%

:: 啟動
npm start

:: 應用停止後
echo.
echo [INFO] 系統已停止
echo [INFO] 感謝使用畜牧業管理系統！
pause
