@echo off
echo ========================================
echo  欧冶世界监测台 - 地图修复版部署
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] 安装依赖...
call npm install
if errorlevel 1 goto error

echo [2/4] 构建项目...
call npm run build
if errorlevel 1 goto error

echo [3/4] 初始化 Git 仓库（仅首次）...
if not exist ".git" (
    git init
    git branch -M main
    git remote add origin https://github.com/szh987210/oritek-world-monitor.git
)

echo [4/4] 推送到 GitHub...
git add .
git commit -m "fix: 修复地图数据加载路径"
git push -u origin main --force

echo.
echo ========================================
echo  部署完成！请等待约1分钟后刷新页面
echo ========================================
goto end

:error
echo.
echo [错误] 构建或部署失败，请检查错误信息
pause
exit /b 1

:end
pause