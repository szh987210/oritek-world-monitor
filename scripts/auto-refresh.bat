@echo off
chcp 65001 >nul
echo ======================================
echo   Oritek 数据自动刷新服务
echo ======================================
echo.

:: 设置工作目录
cd /d "%~dp0.."

:: 检查 Node.js 是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo [信息] Node.js 版本:
node --version
echo.

:: 运行数据抓取
echo [信息] 正在抓取最新数据...
node scripts/data-scraper.js

if errorlevel 1 (
    echo [错误] 数据抓取失败
    pause
    exit /b 1
)

echo.
echo [信息] 数据抓取完成！
echo [信息] 文件已生成: src/generated/liveData.ts
echo.

:: 询问是否重新构建
echo 是否重新构建并部署项目？(Y/N)
set /p choice=
if /i "%choice%"=="Y" (
    echo.
    echo [信息] 正在构建项目...
    call npm run build
    
    if errorlevel 1 (
        echo [错误] 构建失败
        pause
        exit /b 1
    )
    
    echo.
    echo [信息] 构建完成！
    echo [信息] 请手动部署 dist 文件夹到 GitHub Pages
)

echo.
pause