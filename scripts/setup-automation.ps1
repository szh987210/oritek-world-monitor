# Oritek 数据自动刷新自动化设置脚本
# 此脚本会创建一个 Windows 计划任务，每10分钟自动运行数据抓取

param(
    [switch]$Remove,
    [switch]$Status
)

$TaskName = "OritekDataRefresh"
$ScriptPath = Join-Path $PSScriptRoot "auto-refresh.bat"
$WorkingDir = Split-Path $PSScriptRoot -Parent

function Show-Status {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        Write-Host "✅ 任务状态: $($task.State)" -ForegroundColor Green
        Write-Host "   下次运行: $($task.NextRunTime)" -ForegroundColor Cyan
        Write-Host "   触发器: $($task.Triggers[0].Repetition.Interval)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ 任务未创建" -ForegroundColor Red
    }
}

function Install-Task {
    Write-Host "
╔════════════════════════════════════════╗
║    Oritek 数据自动刷新任务安装程序     ║
╚════════════════════════════════════════╝
" -ForegroundColor Cyan

    # 检查脚本文件是否存在
    if (-not (Test-Path $ScriptPath)) {
        Write-Host "❌ 错误: 找不到脚本文件 $ScriptPath" -ForegroundColor Red
        exit 1
    }

    Write-Host "📁 工作目录: $WorkingDir" -ForegroundColor Yellow
    Write-Host "📜 脚本路径: $ScriptPath" -ForegroundColor Yellow
    Write-Host ""

    # 创建操作
    $Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$ScriptPath`"" -WorkingDirectory $WorkingDir

    # 创建触发器 - 每10分钟运行一次
    $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 365)

    # 创建设置
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

    # 创建任务
    try {
        Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Oritek World Monitor 数据自动刷新服务 - 每10分钟抓取最新市场数据" -Force
        Write-Host "✅ 任务创建成功!" -ForegroundColor Green
        Write-Host ""
        Write-Host "任务详情:" -ForegroundColor Cyan
        Show-Status
    } catch {
        Write-Host "❌ 任务创建失败: $_" -ForegroundColor Red
        exit 1
    }
}

function Remove-Task {
    Write-Host "正在移除任务..." -ForegroundColor Yellow
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "✅ 任务已移除" -ForegroundColor Green
    } catch {
        Write-Host "❌ 移除失败: $_" -ForegroundColor Red
    }
}

# 主程序
if ($Status) {
    Show-Status
} elseif ($Remove) {
    Remove-Task
} else {
    Install-Task
}

Write-Host ""
Write-Host "使用说明:" -ForegroundColor Cyan
Write-Host "  查看状态: .\scripts\setup-automation.ps1 -Status" -ForegroundColor Gray
Write-Host "  移除任务: .\scripts\setup-automation.ps1 -Remove" -ForegroundColor Gray
Write-Host ""