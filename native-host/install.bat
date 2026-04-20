@echo off
:: Install native messaging host for Chrome
:: Run this script as the current user (no admin required)

set HOST_NAME=com.follow_as.host
set MANIFEST_PATH=%~dp0manifest.json
set REG_KEY=HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%

reg add "%REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

if %ERRORLEVEL% EQU 0 (
    echo [OK] Native messaging host registered successfully.
    echo      Key: %REG_KEY%
    echo      Manifest: %MANIFEST_PATH%
) else (
    echo [ERROR] Failed to register native messaging host.
    exit /b 1
)
