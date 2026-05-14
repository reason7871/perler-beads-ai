#!/bin/bash
# ECS 部署脚本

set -e

echo "🚀 开始部署拼豆 AI 生成器..."

# 1. 进入项目目录
cd /path/to/perler-beads-ai

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖
npm ci --production

# 4. 构建项目
npm run build

# 5. 使用 PM2 重启服务
# 如果是首次部署，需要先设置 PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 安装 PM2..."
    npm install -g pm2
fi

# 6. 配置 PM2 (首次部署)
pm2 start ecosystem.config.js --only perler-beads || pm2 start ecosystem.config.js

# 7. 保存 PM2 配置（开机自启）
pm2 save
pm2 startup

echo "✅ 部署完成！"
echo "📊 查看状态：pm2 status"
echo "📋 查看日志：pm2 logs perler-beads"
echo "🔄 重启服务：pm2 restart perler-beads"
echo "⏹️  停止服务：pm2 stop perler-beads"
