# Oritek World Monitor

欧冶半导体产业情报监测系统 - 实时监控全球半导体、智能汽车、机器人、AI产业动态

## 功能特性

- 📊 **全局看板** - 产业指数、实时情报、世界地图、市场表现
- 🤖 **AI洞察** - 大模型、端侧AI、技术趋势监测
- 🚀 **创业融资** - 投融资新闻事件追踪
- 📋 **政策申报** - 发改委/科技部/工信部及地方政策
- 🌍 **全球热点** - 真实世界地图 + 时政热点标记
- 📈 **自动更新** - 数据每10秒自动刷新，页面每30秒自动滚动

## 部署到 GitHub Pages

### 1. 创建 GitHub 仓库

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/oritek-world-monitor.git
git push -u origin main
```

### 2. 启用 GitHub Pages

1. 进入仓库 Settings -> Pages
2. Source 选择 "GitHub Actions"
3. 等待自动部署完成

### 3. 访问网站

部署完成后，访问 `https://YOUR_USERNAME.github.io/oritek-world-monitor/`

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 技术栈

- **前端**: TypeScript + Vite
- **图表**: Chart.js
- **地图**: D3.js + TopoJSON
- **样式**: CSS3 + CSS Variables

## 自动更新说明

部署后，网页会自动：
- 每10秒更新产业指数数据
- 每30秒自动滚动页面
- 数据变化时显示闪烁动画

## 数据来源

- 产业指数: 中证指数、Bloomberg
- 市场数据: 中汽协、SEMI、IDC
- 政策信息: 发改委、科技部、工信部
