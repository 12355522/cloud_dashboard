@echo off
chcp 65001 > nul
title 攝影機快速設定

echo.
echo ==========================================
echo        ONVIF攝影機快速設定工具
echo ==========================================
echo.

echo [i] 此工具將幫助您快速連接所有發現的攝影機
echo [i] 請確保系統已經運行在 http://localhost:3000
echo.

set /p username="請輸入攝影機用戶名 (預設: admin): "
if "%username%"=="" set username=admin

set /p password="請輸入攝影機密碼: "
if "%password%"=="" (
    echo [!] 密碼不能為空
    pause
    exit /b 1
)

echo.
echo [i] 將使用以下認證資訊：
echo [i] 用戶名: %username%
echo [i] 密碼: %password%
echo.
echo [i] 開始批量連接攝影機...
echo.

:: 創建PowerShell腳本來調用API
echo $username = '%username%' > %TEMP%\camera-setup.ps1
echo $password = '%password%' >> %TEMP%\camera-setup.ps1
echo. >> %TEMP%\camera-setup.ps1
echo Write-Host "[1/3] 搜尋攝影機..." -ForegroundColor Yellow >> %TEMP%\camera-setup.ps1
echo try { >> %TEMP%\camera-setup.ps1
echo     $discoverResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/onvif/discover" -Method Post >> %TEMP%\camera-setup.ps1
echo     if ($discoverResponse.success) { >> %TEMP%\camera-setup.ps1
echo         Write-Host "[✓] 發現 $($discoverResponse.cameras.Length) 台攝影機" -ForegroundColor Green >> %TEMP%\camera-setup.ps1
echo         $cameras = $discoverResponse.cameras >> %TEMP%\camera-setup.ps1
echo     } else { >> %TEMP%\camera-setup.ps1
echo         Write-Host "[!] 攝影機搜尋失敗" -ForegroundColor Red >> %TEMP%\camera-setup.ps1
echo         exit 1 >> %TEMP%\camera-setup.ps1
echo     } >> %TEMP%\camera-setup.ps1
echo } catch { >> %TEMP%\camera-setup.ps1
echo     Write-Host "[!] 無法連接到系統，請確保服務正在運行" -ForegroundColor Red >> %TEMP%\camera-setup.ps1
echo     exit 1 >> %TEMP%\camera-setup.ps1
echo } >> %TEMP%\camera-setup.ps1
echo. >> %TEMP%\camera-setup.ps1
echo Write-Host "[2/3] 開始批量連接..." -ForegroundColor Yellow >> %TEMP%\camera-setup.ps1
echo $successCount = 0 >> %TEMP%\camera-setup.ps1
echo $failureCount = 0 >> %TEMP%\camera-setup.ps1
echo. >> %TEMP%\camera-setup.ps1
echo foreach ($camera in $cameras) { >> %TEMP%\camera-setup.ps1
echo     if (-not $camera.connected) { >> %TEMP%\camera-setup.ps1
echo         Write-Host "正在連接 $($camera.ip)..." -ForegroundColor Cyan >> %TEMP%\camera-setup.ps1
echo         try { >> %TEMP%\camera-setup.ps1
echo             $connectData = @{ >> %TEMP%\camera-setup.ps1
echo                 ip = $camera.ip >> %TEMP%\camera-setup.ps1
echo                 port = if ($camera.port) { $camera.port } else { 80 } >> %TEMP%\camera-setup.ps1
echo                 username = $username >> %TEMP%\camera-setup.ps1
echo                 password = $password >> %TEMP%\camera-setup.ps1
echo             } >> %TEMP%\camera-setup.ps1
echo             $connectResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/onvif/connect" -Method Post -Body ($connectData ^| ConvertTo-Json) -ContentType "application/json" >> %TEMP%\camera-setup.ps1
echo             if ($connectResponse.success) { >> %TEMP%\camera-setup.ps1
echo                 Write-Host "[✓] $($camera.ip) 連接成功" -ForegroundColor Green >> %TEMP%\camera-setup.ps1
echo                 $successCount++ >> %TEMP%\camera-setup.ps1
echo             } else { >> %TEMP%\camera-setup.ps1
echo                 Write-Host "[!] $($camera.ip) 連接失敗: $($connectResponse.error)" -ForegroundColor Red >> %TEMP%\camera-setup.ps1
echo                 $failureCount++ >> %TEMP%\camera-setup.ps1
echo             } >> %TEMP%\camera-setup.ps1
echo         } catch { >> %TEMP%\camera-setup.ps1
echo             Write-Host "[!] $($camera.ip) 連接異常: $($_.Exception.Message)" -ForegroundColor Red >> %TEMP%\camera-setup.ps1
echo             $failureCount++ >> %TEMP%\camera-setup.ps1
echo         } >> %TEMP%\camera-setup.ps1
echo         Start-Sleep -Seconds 1 >> %TEMP%\camera-setup.ps1
echo     } >> %TEMP%\camera-setup.ps1
echo } >> %TEMP%\camera-setup.ps1
echo. >> %TEMP%\camera-setup.ps1
echo Write-Host "[3/3] 批量連接完成！" -ForegroundColor Yellow >> %TEMP%\camera-setup.ps1
echo Write-Host "成功: $successCount 台" -ForegroundColor Green >> %TEMP%\camera-setup.ps1
echo Write-Host "失敗: $failureCount 台" -ForegroundColor Red >> %TEMP%\camera-setup.ps1
echo. >> %TEMP%\camera-setup.ps1
echo if ($successCount -gt 0) { >> %TEMP%\camera-setup.ps1
echo     Write-Host "[i] 請訪問 http://localhost:3000/onvif-cameras 查看結果" -ForegroundColor Cyan >> %TEMP%\camera-setup.ps1
echo } >> %TEMP%\camera-setup.ps1

:: 執行PowerShell腳本
powershell -ExecutionPolicy Bypass -File "%TEMP%\camera-setup.ps1"

:: 清理臨時文件
del "%TEMP%\camera-setup.ps1" >nul 2>&1

echo.
echo 按任意鍵退出...
pause >nul
