@echo off
chcp 65001 > nul
title 攝影機連接測試

echo.
echo ==========================================
echo           攝影機連接測試工具
echo ==========================================
echo.

echo [i] 此工具將測試所有已發現攝影機的網路連接
echo [i] 請確保系統已經運行在 http://localhost:3000
echo.

:: 創建PowerShell腳本
echo Write-Host "[1/2] 搜尋攝影機..." -ForegroundColor Yellow > %TEMP%\test-cameras.ps1
echo try { >> %TEMP%\test-cameras.ps1
echo     $discoverResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/onvif/discover" -Method Post >> %TEMP%\test-cameras.ps1
echo     if ($discoverResponse.success) { >> %TEMP%\test-cameras.ps1
echo         Write-Host "[✓] 發現 $($discoverResponse.cameras.Length) 台攝影機" -ForegroundColor Green >> %TEMP%\test-cameras.ps1
echo         $cameras = $discoverResponse.cameras >> %TEMP%\test-cameras.ps1
echo     } else { >> %TEMP%\test-cameras.ps1
echo         Write-Host "[!] 攝影機搜尋失敗" -ForegroundColor Red >> %TEMP%\test-cameras.ps1
echo         exit 1 >> %TEMP%\test-cameras.ps1
echo     } >> %TEMP%\test-cameras.ps1
echo } catch { >> %TEMP%\test-cameras.ps1
echo     Write-Host "[!] 無法連接到系統，請確保服務正在運行" -ForegroundColor Red >> %TEMP%\test-cameras.ps1
echo     exit 1 >> %TEMP%\test-cameras.ps1
echo } >> %TEMP%\test-cameras.ps1
echo. >> %TEMP%\test-cameras.ps1
echo Write-Host "[2/2] 開始網路連接測試..." -ForegroundColor Yellow >> %TEMP%\test-cameras.ps1
echo $reachableCount = 0 >> %TEMP%\test-cameras.ps1
echo $unreachableCount = 0 >> %TEMP%\test-cameras.ps1
echo. >> %TEMP%\test-cameras.ps1
echo foreach ($camera in $cameras) { >> %TEMP%\test-cameras.ps1
echo     Write-Host "測試 $($camera.ip):$($camera.port -or 80)..." -NoNewline >> %TEMP%\test-cameras.ps1
echo     try { >> %TEMP%\test-cameras.ps1
echo         $testData = @{ >> %TEMP%\test-cameras.ps1
echo             ip = $camera.ip >> %TEMP%\test-cameras.ps1
echo             port = if ($camera.port) { $camera.port } else { 80 } >> %TEMP%\test-cameras.ps1
echo         } >> %TEMP%\test-cameras.ps1
echo         $testResponse = Invoke-RestMethod -Uri "http://localhost:3000/api/onvif/test-connection" -Method Post -Body ($testData ^| ConvertTo-Json) -ContentType "application/json" >> %TEMP%\test-cameras.ps1
echo         if ($testResponse.success -and $testResponse.reachable) { >> %TEMP%\test-cameras.ps1
echo             Write-Host " [✓]" -ForegroundColor Green >> %TEMP%\test-cameras.ps1
echo             $reachableCount++ >> %TEMP%\test-cameras.ps1
echo         } else { >> %TEMP%\test-cameras.ps1
echo             Write-Host " [!] $($testResponse.error)" -ForegroundColor Red >> %TEMP%\test-cameras.ps1
echo             $unreachableCount++ >> %TEMP%\test-cameras.ps1
echo         } >> %TEMP%\test-cameras.ps1
echo     } catch { >> %TEMP%\test-cameras.ps1
echo         Write-Host " [!] 測試失敗" -ForegroundColor Red >> %TEMP%\test-cameras.ps1
echo         $unreachableCount++ >> %TEMP%\test-cameras.ps1
echo     } >> %TEMP%\test-cameras.ps1
echo } >> %TEMP%\test-cameras.ps1
echo. >> %TEMP%\test-cameras.ps1
echo Write-Host "==========================================" >> %TEMP%\test-cameras.ps1
echo Write-Host "           網路連接測試結果" >> %TEMP%\test-cameras.ps1
echo Write-Host "==========================================" >> %TEMP%\test-cameras.ps1
echo Write-Host "可達: $reachableCount 台" -ForegroundColor Green >> %TEMP%\test-cameras.ps1
echo Write-Host "不可達: $unreachableCount 台" -ForegroundColor Red >> %TEMP%\test-cameras.ps1
echo. >> %TEMP%\test-cameras.ps1
echo if ($reachableCount -gt 0) { >> %TEMP%\test-cameras.ps1
echo     Write-Host "[i] 可達的攝影機可以嘗試連接" -ForegroundColor Cyan >> %TEMP%\test-cameras.ps1
echo     Write-Host "[i] 運行 setup-cameras.bat 進行批量連接" -ForegroundColor Cyan >> %TEMP%\test-cameras.ps1
echo } >> %TEMP%\test-cameras.ps1

:: 執行PowerShell腳本
powershell -ExecutionPolicy Bypass -File "%TEMP%\test-cameras.ps1"

:: 清理臨時文件
del "%TEMP%\test-cameras.ps1" >nul 2>&1

echo.
echo 按任意鍵退出...
pause >nul
