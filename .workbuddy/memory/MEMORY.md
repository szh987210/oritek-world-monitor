# MEMORY.md - 长期记忆

## oritek-world-monitor 项目

**GitHub 仓库:** https://github.com/szh987210/oritek-world-monitor  
**GitHub Pages:** https://szh987210.github.io/oritek-world-monitor/

### 技术架构
- 纯前端 SPA，Vite + TypeScript
- 依赖：d3、chart.js、topojson-client、date-fns
- 部署：GitHub Pages (`gh-pages` 分支)
- 本地构建命令：`npm run build`
- 部署命令：`npx gh-pages -d dist -b gh-pages`

### 已解决的关键问题（2026-03-25）
1. **地图不显示** - 改进 D3 地图加载，添加回退方案（本地JSON → CDN → 内置简化地图）
2. **数据不更新** - 重写 dataService.ts，实现动态数据生成+缓存机制
3. **手动刷新失效** - 重写 performFullRefresh()，调用 forceRefreshAll() 强制清除缓存

### 后端数据抓取
- `scripts/data-scraper.js` - 数据抓取脚本
- `scripts/auto-refresh.bat` - 批处理自动刷新
- `scripts/setup-automation.ps1` - Windows 计划任务（每10分钟）

### 重要注意事项
- main.ts 中 globalHotspots/newsData/industryIndices/marketPerformance 是全局变量，刷新时需全部更新
- 地图数据文件 public/world-110m.json 已存在，GitHub Pages 下路径 `/oritek-world-monitor/world-110m.json`
- 自动刷新间隔：10分钟
