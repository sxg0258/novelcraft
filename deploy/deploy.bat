@echo off
REM NovelCraft 飞牛 NAS 一键部署脚本 (Windows 版，PowerShell 友好)
REM 用法：
REM   deploy.bat 你的GitHub用户名
REM 例子：
REM   deploy.bat zhangsan
REM
REM 这个脚本会帮你把脚本和 docker-compose.yml 上传到飞牛
REM 然后在飞牛上执行 deploy.sh

setlocal

if "%~1"=="" (
    echo 用法：deploy.bat 你的GitHub用户名
    echo 例子：deploy.bat zhangsan
    exit /b 1
)

set GHCR_USER=%~1
set NAS_IP=
set NAS_USER=admin

echo.
echo ===== NovelCraft 一键部署 =====
echo GitHub 用户：%GHCR_USER%
echo.

:INPUT_IP
set /p NAS_IP=请输入飞牛 IP 地址：
if "%NAS_IP%"=="" goto INPUT_IP

echo.
echo 上传部署脚本到飞牛...
scp deploy\deploy.sh %NAS_USER%@%NAS_IP%:/tmp/deploy.sh

if errorlevel 1 (
    echo 上传失败！请检查 SSH 连通性
    exit /b 1
)

echo.
echo 在飞牛上执行部署...
ssh %NAS_USER%@%NAS_IP% "GHCR_USER=%GHCR_USER% bash /tmp/deploy.sh"

echo.
echo 部署完成！
endlocal
