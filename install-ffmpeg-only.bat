@echo off
chcp 65001 > nul
title FFmpeg 安裝工具

echo.
echo ========================================
echo           FFmpeg 安裝工具
echo ========================================
echo.

:: 檢查是否已經安裝
echo [1/3] 檢查FFmpeg狀態...
where ffmpeg >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] 系統已安裝FFmpeg
    ffmpeg -version 2>nul | findstr "ffmpeg version"
    echo.
    echo 是否重新安裝？(Y/N)
    set /p REINSTALL=
    if /i not "%REINSTALL%"=="Y" exit /b 0
)

if exist "ffmpeg\bin\ffmpeg.exe" (
    echo [✓] 本地已安裝FFmpeg
    echo ffmpeg\bin\ffmpeg.exe
    echo.
    echo 是否重新安裝？(Y/N)
    set /p REINSTALL=
    if /i not "%REINSTALL%"=="Y" (
        echo [INFO] 使用現有安裝，設置環境變數...
        set PATH=ffmpeg\bin;%PATH%
        echo [✓] FFmpeg已就緒
        pause
        exit /b 0
    )
)

:: 下載FFmpeg
echo.
echo [2/3] 下載FFmpeg...
set FFMPEG_URL=https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip
echo [INFO] 下載地址: %FFMPEG_URL%
echo [INFO] 正在下載，請稍候...

powershell -Command "& {try { Write-Host '正在下載FFmpeg...'; Invoke-WebRequest -Uri '%FFMPEG_URL%' -OutFile '%TEMP%\ffmpeg.zip' -UseBasicParsing; Write-Host '下載完成' } catch { Write-Host '下載失敗:' $_.Exception.Message; exit 1 }}"

if not %errorLevel% == 0 (
    echo [!] 下載失敗
    echo [FIX] 請檢查網路連接
    echo [FIX] 或手動下載: %FFMPEG_URL%
    pause
    exit /b 1
)

:: 解壓安裝
echo.
echo [3/3] 安裝FFmpeg...
echo [INFO] 正在解壓...

:: 清理舊安裝
if exist ffmpeg rmdir /s /q ffmpeg

:: 解壓到臨時目錄
powershell -Command "& {Expand-Archive -Path '%TEMP%\ffmpeg.zip' -DestinationPath '%TEMP%\ffmpeg-extract' -Force}"

if not %errorLevel% == 0 (
    echo [!] 解壓失敗
    pause
    exit /b 1
)

:: 移動文件
for /d %%i in ("%TEMP%\ffmpeg-extract\ffmpeg-*") do (
    mkdir ffmpeg >nul 2>&1
    xcopy "%%i\*" "ffmpeg\" /E /I /Y >nul
)

:: 清理臨時文件
del "%TEMP%\ffmpeg.zip" >nul 2>&1
rmdir /s /q "%TEMP%\ffmpeg-extract" >nul 2>&1

:: 驗證安裝
if exist "ffmpeg\bin\ffmpeg.exe" (
    echo [✓] FFmpeg安裝成功！
    echo [INFO] 安裝位置: %CD%\ffmpeg\bin\
    
    :: 測試FFmpeg
    ffmpeg\bin\ffmpeg.exe -version 2>nul | findstr "ffmpeg version"
    
    echo.
    echo [✓] FFmpeg已就緒，可以處理影像串流
) else (
    echo [!] 安裝失敗
    echo [FIX] 請檢查磁碟空間和權限
    pause
    exit /b 1
)

echo.
echo ========================================
echo          安裝完成！
echo ========================================
echo.
echo [INFO] 現在可以啟動系統使用影像串流功能
echo [INFO] 運行: start-windows.bat
echo.

pause
