@echo off
chcp 65001 >nul
echo ==========================================
echo   Oritek World Monitor - GitHub 部署脚本
echo ==========================================
echo.

:: 检查是否输入了用户名
if "%~1"=="" (
    echo 使用方法: deploy.bat YOUR_GITHUB_USERNAME
    echo 示例: deploy.bat zhangsan
    pause
    exit /b 1
)

set USERNAME=%~1

echo [1/6] 初始化 Git 仓库...
git init

echo.
echo [2/6] 配置 Git 用户信息...
git config user.name "%USERNAME%"
git config user.email "%USERNAME%@users.noreply.github.com"

echo.
echo [3/6] 添加所有文件...
git add .

echo.
echo [4/6] 提交代码...
git commit -m "Initial commit: Oritek World Monitor v1.0"

echo.
echo [5/6] 重命名分支...
git branch -M main

echo.
echo [6/6] 关联并推送到 GitHub...
git remote add origin https://github.com/%USERNAME%/oritek-world-monitor.git
git push -u origin main

echo.
echo ==========================================
echo   部署完成！
echo ==========================================
echo.
echo 请按以下步骤操作：
echo 1. 访问 https://github.com/%USERNAME%/oritek-world-monitor
echo 2. 点击 Settings -> Pages
echo 3. Source 选择 "GitHub Actions"
echo 4. 等待 1-2 分钟后访问：
echo    https://%USERNAME%.github.io/oritek-world-monitor/
echo.
pause
