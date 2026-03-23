@echo off
chcp 65001 >nul
echo ==========================================
echo   Oritek World Monitor - 更新脚本
echo ==========================================
echo.

echo [1/3] 添加修改的文件...
git add .

echo.
echo [2/3] 提交修改...
if "%~1"=="" (
    git commit -m "Update content"
) else (
    git commit -m "%~1"
)

echo.
echo [3/3] 推送到 GitHub...
git push origin main

echo.
echo ==========================================
echo   更新完成！
echo ==========================================
echo.
echo 等待 1-2 分钟后，网站会自动更新
echo.
pause
