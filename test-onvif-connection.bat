@echo off
chcp 65001 > nul
title ONVIF連接測試

echo.
echo ========================================
echo        ONVIF連接測試工具
echo ========================================
echo.

echo [1/3] 檢查系統狀態...
echo 請確保系統正在運行在 http://localhost:3000
echo.

set /p TEST_IP=請輸入要測試的攝影機IP位址: 
if "%TEST_IP%"=="" (
    echo [!] 未輸入IP位址
    pause
    exit /b 1
)

set /p TEST_PORT=請輸入端口 (預設80): 
if "%TEST_PORT%"=="" set TEST_PORT=80

echo.
echo [2/3] 測試網路連接...
echo 正在測試 %TEST_IP%:%TEST_PORT% 的網路連接...

powershell -Command "& {try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/onvif/test-connection' -Method Post -Body '{\"ip\":\"%TEST_IP%\",\"port\":%TEST_PORT%}' -ContentType 'application/json'; $result = $response.Content | ConvertFrom-Json; if ($result.success) { Write-Host '[✓] 網路連接測試成功' -ForegroundColor Green; Write-Host '結果:' $result.message } else { Write-Host '[!] 網路連接測試失敗' -ForegroundColor Red; Write-Host '錯誤:' $result.error } } catch { Write-Host '[!] 測試失敗:' $_.Exception.Message -ForegroundColor Red }}"

echo.
echo [3/3] 測試攝影機連接...
echo 正在測試 %TEST_IP%:%TEST_PORT% 的ONVIF連接...

set /p TEST_USER=請輸入用戶名 (預設admin): 
if "%TEST_USER%"=="" set TEST_USER=admin

set /p TEST_PASS=請輸入密碼: 
if "%TEST_PASS%"=="" (
    echo [!] 密碼不能為空
    pause
    exit /b 1
)

echo.
echo 正在連接攝影機...

powershell -Command "& {try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/onvif/connect' -Method Post -Body '{\"ip\":\"%TEST_IP%\",\"port\":%TEST_PORT%,\"username\":\"%TEST_USER%\",\"password\":\"%TEST_PASS%\"}' -ContentType 'application/json'; $result = $response.Content | ConvertFrom-Json; if ($result.success) { Write-Host '[✓] 攝影機連接成功！' -ForegroundColor Green; Write-Host '攝影機資訊:' $result.camera.ip ':' $result.camera.port; Write-Host '配置檔數量:' $result.profiles; Write-Host '訊息:' $result.message } else { Write-Host '[!] 攝影機連接失敗' -ForegroundColor Red; Write-Host '錯誤:' $result.error } } catch { Write-Host '[!] 連接測試失敗:' $_.Exception.Message -ForegroundColor Red }}"

echo.
echo ========================================
echo           測試完成
echo ========================================
echo.
echo [INFO] 如果連接成功，請訪問攝影機管理頁面查看
echo [INFO] 網址: http://localhost:3000/onvif-cameras
echo.

pause
