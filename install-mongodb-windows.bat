@echo off
chcp 65001 > nul
title MongoDB安裝腳本

echo.
echo ==========================================
echo      MongoDB Community Edition 安裝
echo ==========================================
echo.

:: 檢查管理員權限
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] 管理員權限確認
) else (
    echo [!] 需要管理員權限，請右鍵點擊"以管理員身份運行"
    pause
    exit /b 1
)

:: MongoDB下載連結 (7.0版本)
set MONGODB_URL=https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.12-signed.msi
set TEMP_MSI=%TEMP%\mongodb-installer.msi

echo [1/4] 下載MongoDB安裝包...
echo [i] 下載地址: %MONGODB_URL%
powershell -Command "& {Invoke-WebRequest -Uri '%MONGODB_URL%' -OutFile '%TEMP_MSI%'}"
if %errorLevel% neq 0 (
    echo [!] MongoDB下載失敗
    echo [i] 請手動下載並安裝MongoDB Community Edition
    echo [i] 下載地址: https://www.mongodb.com/try/download/community
    pause
    exit /b 1
)

echo [2/4] 安裝MongoDB...
echo [i] 正在執行靜默安裝...
msiexec /i "%TEMP_MSI%" /quiet /norestart
if %errorLevel% neq 0 (
    echo [!] MongoDB安裝失敗
    echo [i] 請手動運行安裝程序: %TEMP_MSI%
    pause
    exit /b 1
)

echo [3/4] 配置MongoDB服務...
:: 等待安裝完成
timeout /t 10 /nobreak >nul

:: 檢查服務是否存在
sc query MongoDB >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] MongoDB服務已安裝
    
    :: 啟動服務
    net start MongoDB
    if %errorLevel__ == 0 (
        echo [✓] MongoDB服務已啟動
    ) else (
        echo [i] MongoDB服務啟動失敗，請手動啟動
    )
) else (
    echo [!] MongoDB服務未找到
    echo [i] 請檢查安裝是否成功
)

echo [4/4] 驗證安裝...
:: 檢查mongod命令
where mongod >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] MongoDB已添加到系統PATH
) else (
    echo [i] MongoDB可能需要手動添加到PATH
    echo [i] 默認安裝路徑: C:\Program Files\MongoDB\Server\7.0\bin
)

:: 清理安裝包
del "%TEMP_MSI%" >nul 2>&1

echo.
echo ==========================================
echo           MongoDB安裝完成！
echo ==========================================
echo.
echo [i] 服務名稱: MongoDB
echo [i] 默認端口: 27017
echo [i] 數據目錄: C:\data\db
echo [i] 日誌目錄: C:\data\log
echo.
echo [i] 啟動服務: net start MongoDB
echo [i] 停止服務: net stop MongoDB
echo [i] 連接測試: mongo 或 mongosh
echo.

pause
