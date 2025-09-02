@echo off
chcp 65001 > nul
title 測試攝影機 192.168.1.32:554

echo.
echo ========================================
echo      測試攝影機 192.168.1.32:554
echo ========================================
echo.

echo [1/5] 檢查系統狀態...
echo 請確保系統正在運行在 http://localhost:3000
echo.

set CAMERA_IP=192.168.1.32
set CAMERA_PORT=554
set CAMERA_USER=admin
set CAMERA_PASS=

echo [INFO] 攝影機資訊:
echo   IP: %CAMERA_IP%
echo   端口: %CAMERA_PORT%
echo   用戶名: %CAMERA_USER%
echo   密碼: %CAMERA_PASS%
echo.

echo [2/5] 測試網路連接...
echo 正在測試 %CAMERA_IP%:%CAMERA_PORT% 的網路連接...

powershell -Command "& {try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/onvif/test-connection' -Method Post -Body '{\"ip\":\"%CAMERA_IP%\",\"port\":%CAMERA_PORT%}' -ContentType 'application/json'; $result = $response.Content | ConvertFrom-Json; if ($result.success) { Write-Host '[✓] 網路連接測試成功' -ForegroundColor Green; Write-Host '結果:' $result.message } else { Write-Host '[!] 網路連接測試失敗' -ForegroundColor Red; Write-Host '錯誤:' $result.error } } catch { Write-Host '[!] 測試失敗:' $_.Exception.Message -ForegroundColor Red }}"

echo.
echo [3/5] 測試ONVIF連接...
echo 正在連接攝影機...

powershell -Command "& {try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/onvif/connect' -Method Post -Body '{\"ip\":\"%CAMERA_IP%\",\"port\":%CAMERA_PORT%,\"username\":\"%CAMERA_USER%\",\"password\":\"%CAMERA_PASS%\"}' -ContentType 'application/json'; $result = $response.Content | ConvertFrom-Json; if ($result.success) { Write-Host '[✓] 攝影機連接成功！' -ForegroundColor Green; Write-Host '攝影機資訊:' $result.camera.ip ':' $result.camera.port; Write-Host '配置檔數量:' $result.camera.profiles; Write-Host '訊息:' $result.message } else { Write-Host '[!] 攝影機連接失敗' -ForegroundColor Red; Write-Host '錯誤:' $result.error } } catch { Write-Host '[!] 連接測試失敗:' $_.Exception.Message -ForegroundColor Red }}"

echo.
echo [4/5] 測試快照功能...
echo 正在拍攝快照...

powershell -Command "& {try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/onvif/snapshot/%CAMERA_IP%' -Method Post; $result = $response.Content | ConvertFrom-Json; if ($result.success) { Write-Host '[✓] 快照拍攝成功！' -ForegroundColor Green; Write-Host '快照路徑:' $result.snapshot.path; Write-Host '檔案名:' $result.snapshot.filename } else { Write-Host '[!] 快照拍攝失敗' -ForegroundColor Red; Write-Host '錯誤:' $result.error } } catch { Write-Host '[!] 快照測試失敗:' $_.Exception.Message -ForegroundColor Red }}"

echo.
echo [5/5] 測試串流功能...
echo 正在啟動串流...

powershell -Command "& {try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/onvif/stream/start/%CAMERA_IP%' -Method Post; $result = $response.Content | ConvertFrom-Json; if ($result.success) { Write-Host '[✓] 串流啟動成功！' -ForegroundColor Green; Write-Host '串流URL:' $result.stream.playlistUrl; Write-Host '狀態:' $result.stream.status } else { Write-Host '[!] 串流啟動失敗' -ForegroundColor Red; Write-Host '錯誤:' $result.error } } catch { Write-Host '[!] 串流測試失敗:' $_.Exception.Message -ForegroundColor Red }}"

echo.
echo ========================================
echo           測試完成
echo ========================================
echo.
echo [INFO] 如果所有測試都成功，您可以：
echo [INFO] 1. 訪問攝影機管理頁面: http://localhost:3000/onvif-cameras
echo [INFO] 2. 查看快照: public/snapshots/ 目錄
echo [INFO] 3. 播放串流: http://localhost:3000/streams/%CAMERA_IP%/playlist.m3u8
echo.
echo [INFO] 在瀏覽器中打開串流URL來測試影像播放
echo.

pause
