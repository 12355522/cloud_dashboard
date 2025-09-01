@echo off
chcp 65001 > nul
title 畜牧業管理系統 - Windows部署腳本

:: 設置錯誤處理
setlocal enabledelayedexpansion

echo.
echo ==========================================
echo    畜牧業管理系統 - Windows部署腳本
echo ==========================================
echo.

:: 添加調試信息
echo [DEBUG] 腳本開始執行...
echo [DEBUG] 當前用戶: %USERNAME%
echo [DEBUG] 系統版本: 
ver

:: 檢查是否以管理員權限運行
echo [DEBUG] 檢查管理員權限...
net session >nul 2>&1
set ADMIN_CHECK=%errorLevel%
echo [DEBUG] 管理員權限檢查結果: %ADMIN_CHECK%

if %ADMIN_CHECK% == 0 (
    echo [✓] 管理員權限確認
) else (
    echo [!] 需要管理員權限，請右鍵點擊"以管理員身份運行"
    echo [!] 按任意鍵退出...
    pause
    exit /b 1
)

:: 設置變數
set SCRIPT_DIR=%~dp0
set LOG_FILE=%SCRIPT_DIR%deploy.log
set FFMPEG_URL=https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip
set FFMPEG_DIR=%SCRIPT_DIR%ffmpeg

echo [1/8] 檢查系統環境...
echo 當前目錄: %SCRIPT_DIR%
echo 日誌文件: %LOG_FILE%

:: 檢查Node.js
echo.
echo [2/8] 檢查Node.js安裝...
echo [DEBUG] 嘗試執行 node --version...
node --version >nul 2>&1
set NODE_CHECK=%errorLevel%
echo [DEBUG] Node.js檢查結果: %NODE_CHECK%

if %NODE_CHECK% == 0 (
    echo [✓] Node.js已安裝
    for /f "tokens=*" %%i in ('node --version') do echo [INFO] Node.js版本: %%i
) else (
    echo [!] Node.js未安裝
    echo [!] 請先安裝Node.js: https://nodejs.org/
    echo [!] 下載LTS版本並安裝後重新運行此腳本
    echo [!] 按任意鍵退出...
    pause
    exit /b 1
)

:: 檢查npm
echo [DEBUG] 嘗試執行 npm --version...
npm --version >nul 2>&1
set NPM_CHECK=%errorLevel%
echo [DEBUG] npm檢查結果: %NPM_CHECK%

if %NPM_CHECK% == 0 (
    echo [✓] npm已安裝
    for /f "tokens=*" %%i in ('npm --version') do echo [INFO] npm版本: %%i
) else (
    echo [!] npm未安裝，請重新安裝Node.js
    echo [!] 按任意鍵退出...
    pause
    exit /b 1
)

:: 安裝依賴
echo.
echo [3/8] 安裝Node.js依賴...
echo [DEBUG] 檢查package.json文件...

if exist package.json (
    echo [✓] 找到package.json
    echo [DEBUG] 開始執行 npm install...
    echo [INFO] 正在安裝依賴，這可能需要幾分鐘時間...
    
    npm install
    set INSTALL_RESULT=%errorLevel%
    echo [DEBUG] npm install 結果: %INSTALL_RESULT%
    
    if %INSTALL_RESULT% == 0 (
        echo [✓] 依賴安裝完成
    ) else (
        echo [!] 依賴安裝失敗，錯誤代碼: %INSTALL_RESULT%
        echo [!] 請檢查網路連接和npm配置
        echo [!] 按任意鍵退出...
        pause
        exit /b 1
    )
) else (
    echo [!] 找不到package.json文件
    echo [!] 請確保在正確的專案目錄中運行此腳本
    echo [!] 當前目錄: %CD%
    echo [!] 按任意鍵退出...
    pause
    exit /b 1
)

:: 檢查並安裝FFmpeg
echo.
echo [4/8] 檢查FFmpeg...
ffmpeg -version >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] FFmpeg已在系統PATH中
    ffmpeg -version | findstr "ffmpeg version"
) else (
    echo [!] 系統PATH中未找到FFmpeg，檢查本地安裝...
    if exist "%FFMPEG_DIR%\bin\ffmpeg.exe" (
        echo [✓] 找到本地FFmpeg安裝
        set PATH=%FFMPEG_DIR%\bin;%PATH%
    ) else (
        echo [!] 正在下載並安裝FFmpeg...
        call :install_ffmpeg
    )
)

:: 創建必要目錄
echo.
echo [5/8] 創建必要目錄...
if not exist "public\snapshots" mkdir "public\snapshots"
if not exist "public\streams" mkdir "public\streams"
if not exist "uploads" mkdir "uploads"
echo [✓] 目錄創建完成

:: 檢查MongoDB連接
echo.
echo [6/8] 檢查數據庫連接...
echo [i] 請確保MongoDB服務正在運行
echo [i] 默認連接: mongodb://localhost:27017/livestock_management

:: 檢查配置文件
echo.
echo [7/8] 檢查配置...
if exist config.js (
    echo [✓] 找到配置文件
) else (
    echo [!] 創建默認配置文件...
    call :create_config
)

:: 啟動服務
echo.
echo [8/8] 啟動系統...
echo [i] 系統將在 http://localhost:3000 啟動
echo [i] ONVIF攝影機管理: http://localhost:3000/onvif-cameras
echo.
echo 按Ctrl+C停止服務
echo.

:: 設置環境變數
set PATH=%FFMPEG_DIR%\bin;%PATH%
set NODE_ENV=production

:: 啟動應用
echo [DEBUG] 準備啟動應用...
echo [INFO] 如果出現錯誤，請檢查上述所有步驟是否成功完成
echo [INFO] 啟動後請訪問: http://localhost:3000
echo.

npm start

:: 如果到達這裡，說明應用已停止
echo.
echo [INFO] 應用已停止運行
echo [INFO] 按任意鍵退出...
pause

goto :eof

:: 安裝FFmpeg函數
:install_ffmpeg
echo [i] 開始下載FFmpeg...
echo [DEBUG] 下載URL: %FFMPEG_URL%
echo [DEBUG] 目標文件: %TEMP%\ffmpeg.zip

if not exist "%TEMP%\ffmpeg.zip" (
    echo [INFO] 正在下載FFmpeg，這可能需要幾分鐘時間...
    powershell -Command "& {try { Invoke-WebRequest -Uri '%FFMPEG_URL%' -OutFile '%TEMP%\ffmpeg.zip' -UseBasicParsing } catch { Write-Host 'Download failed:' $_.Exception.Message; exit 1 }}"
    set DOWNLOAD_RESULT=%errorLevel%
    echo [DEBUG] 下載結果: %DOWNLOAD_RESULT%
    
    if %DOWNLOAD_RESULT% neq 0 (
        echo [!] FFmpeg下載失敗
        echo [!] 可能的原因：網路連接問題或URL不可用
        echo [!] 請手動下載並解壓到 %FFMPEG_DIR%
        echo [!] 下載地址: %FFMPEG_URL%
        echo [!] 按任意鍵繼續（跳過FFmpeg安裝）...
        pause
        goto :eof
    )
) else (
    echo [INFO] 發現已存在的FFmpeg下載文件，跳過下載
)

echo [i] 解壓FFmpeg...
powershell -Command "& {Expand-Archive -Path '%TEMP%\ffmpeg.zip' -DestinationPath '%TEMP%\ffmpeg-extract' -Force}"
if %errorLevel% neq 0 (
    echo [!] FFmpeg解壓失敗
    pause
    exit /b 1
)

:: 移動文件到目標目錄
for /d %%i in ("%TEMP%\ffmpeg-extract\ffmpeg-*") do (
    if not exist "%FFMPEG_DIR%" mkdir "%FFMPEG_DIR%"
    xcopy "%%i\*" "%FFMPEG_DIR%" /E /I /Y
)

:: 清理臨時文件
del "%TEMP%\ffmpeg.zip" >nul 2>&1
rmdir /s /q "%TEMP%\ffmpeg-extract" >nul 2>&1

if exist "%FFMPEG_DIR%\bin\ffmpeg.exe" (
    echo [✓] FFmpeg安裝完成
    set PATH=%FFMPEG_DIR%\bin;%PATH%
) else (
    echo [!] FFmpeg安裝失敗
    pause
    exit /b 1
)
goto :eof

:: 創建配置文件函數
:create_config
echo // 系統配置文件 > config.js
echo module.exports = { >> config.js
echo     port: process.env.PORT ^|^| 3000, >> config.js
echo     mongodb: { >> config.js
echo         uri: process.env.MONGODB_URI ^|^| 'mongodb://localhost:27017/livestock_management' >> config.js
echo     }, >> config.js
echo     mqtt: { >> config.js
echo         broker: { >> config.js
echo             port: process.env.MQTT_PORT ^|^| 1883 >> config.js
echo         }, >> config.js
echo         client: { >> config.js
echo             host: process.env.MQTT_HOST ^|^| 'localhost', >> config.js
echo             port: process.env.MQTT_PORT ^|^| 1883 >> config.js
echo         } >> config.js
echo     }, >> config.js
echo     onvif: { >> config.js
echo         timeout: 5000, >> config.js
echo         discoveryTimeout: 8000 >> config.js
echo     } >> config.js
echo }; >> config.js
echo [✓] 配置文件創建完成
goto :eof
