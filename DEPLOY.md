# Oritek World Monitor - 详细部署指南

## 前置要求

- 一个 GitHub 账号
- 电脑上安装了 Git
- 项目代码已准备就绪

---

## 第一步：创建 GitHub 仓库

### 1.1 登录 GitHub
打开 https://github.com 并登录你的账号

### 1.2 创建新仓库
1. 点击右上角 **+** 号，选择 **New repository**
2. 填写仓库信息：
   - **Repository name**: `oritek-world-monitor`（必须和vite.config.ts中的base配置一致）
   - **Description**: 欧冶半导体产业情报监测系统
   - **Visibility**: 选择 **Public**（GitHub Pages免费版需要公开仓库）
   - **Initialize this repository with**: 不勾选任何选项
3. 点击 **Create repository**

---

## 第二步：初始化本地 Git 仓库

### 2.1 打开命令行
在 Windows 上，按 `Win + R`，输入 `cmd`，回车

### 2.2 进入项目目录
```bash
cd C:\Users\s0156\WorkBuddy\20260323090944\oritek-world-monitor
```

### 2.3 初始化 Git
```bash
git init
```

### 2.4 配置 Git 用户信息（如果还没配置过）
```bash
git config user.name "你的名字"
git config user.email "你的邮箱@example.com"
```

---

## 第三步：添加并提交代码

### 3.1 添加所有文件
```bash
git add .
```

### 3.2 提交代码
```bash
git commit -m "Initial commit: Oritek World Monitor v1.0"
```

### 3.3 重命名分支为 main
```bash
git branch -M main
```

---

## 第四步：关联远程仓库

### 4.1 添加远程仓库地址
将 `YOUR_USERNAME` 替换为你的 GitHub 用户名：
```bash
git remote add origin https://github.com/YOUR_USERNAME/oritek-world-monitor.git
```

### 4.2 推送代码到 GitHub
```bash
git push -u origin main
```

**注意**：如果是第一次推送，可能会要求输入 GitHub 用户名和密码（或Token）

---

## 第五步：启用 GitHub Pages

### 5.1 进入仓库设置
1. 打开浏览器，访问 `https://github.com/YOUR_USERNAME/oritek-world-monitor`
2. 点击顶部的 **Settings** 标签

### 5.2 配置 Pages
1. 左侧菜单找到并点击 **Pages**
2. 在 **Build and deployment** 部分：
   - **Source**: 选择 **GitHub Actions**
3. 点击 **Save**

### 5.3 等待部署
1. 点击顶部的 **Actions** 标签
2. 你会看到正在运行的 workflow："Deploy to GitHub Pages"
3. 等待状态变为 ✅ **绿色勾号**（约1-2分钟）

---

## 第六步：访问网站

### 6.1 获取网站地址
部署完成后，访问：
```
https://YOUR_USERNAME.github.io/oritek-world-monitor/
```

### 6.2 验证部署
- 页面应该能正常加载
- 世界地图应该显示
- 数据应该自动更新（每10秒）
- 页面应该自动滚动（每30秒）

---

## 常见问题解决

### Q1: 推送代码时提示权限错误
**解决**：使用 GitHub Token 代替密码
1. GitHub -> Settings -> Developer settings -> Personal access tokens
2. 生成新的 Token（勾选 repo 权限）
3. 推送时用这个 Token 作为密码

### Q2: 页面显示空白或404
**解决**：
1. 检查 vite.config.ts 中的 `base: '/oritek-world-monitor/'` 是否正确
2. 确保仓库名和 base 配置一致
3. 重新推送代码触发部署

### Q3: 世界地图不显示
**解决**：
1. 检查 dist 目录下是否有 world-110m.json 文件
2. 确保文件被正确提交到仓库

### Q4: 如何更新网站内容
**解决**：
```bash
# 修改代码后
git add .
git commit -m "更新内容"
git push origin main
```
GitHub Actions 会自动重新部署

---

## 后续更新代码

每次修改代码后，执行：
```bash
cd C:\Users\s0156\WorkBuddy\20260323090944\oritek-world-monitor
git add .
git commit -m "描述你的修改"
git push origin main
```

等待 1-2 分钟后，网站会自动更新。

---

## 完整命令汇总

```bash
# 1. 进入目录
cd C:\Users\s0156\WorkBuddy\20260323090944\oritek-world-monitor

# 2. 初始化
git init
git config user.name "你的名字"
git config user.email "你的邮箱@example.com"

# 3. 提交代码
git add .
git commit -m "Initial commit"
git branch -M main

# 4. 关联远程仓库（替换YOUR_USERNAME）
git remote add origin https://github.com/YOUR_USERNAME/oritek-world-monitor.git

# 5. 推送
git push -u origin main

# 后续更新
git add .
git commit -m "更新描述"
git push origin main
```
