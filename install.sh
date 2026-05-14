#!/bin/bash
# 阿里云 ECS 一键部署脚本
# 使用方法：curl -fsSL <raw-url>/install.sh | bash

set -e

echo "🚀 拼豆 AI 生成器 - 阿里云 ECS 一键部署"
echo "======================================="

# 检查是否 root
if [ "$EUID" -ne 0 ]; then
  echo "❌ 请使用 root 用户运行此脚本"
  exit 1
fi

# 配置
PROJECT_DIR="/var/www/perler-beads-ai"
REPO_URL="https://github.com/YOUR_USERNAME/perler-beads-ai.git"

echo "📦 安装系统依赖..."
apt-get update
apt-get install -y git curl wget build-essential

echo "📦 安装 Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "📦 安装 PM2..."
npm install -g pm2

echo "📦 克隆项目..."
if [ -d "$PROJECT_DIR" ]; then
  echo "⚠️  项目已存在，拉取最新代码..."
  cd $PROJECT_DIR
  git pull
else
  git clone $REPO_URL $PROJECT_DIR
  cd $PROJECT_DIR
fi

echo "📦 安装项目依赖..."
npm install --production

echo "📦 配置环境变量..."
if [ ! -f .env.production ]; then
  cp .env.example .env.production
  echo "⚠️  请编辑 .env.production 填入实际配置"
fi

echo "📦 创建数据目录..."
mkdir -p data logs
chmod 755 data logs

echo "📦 构建项目..."
npm run build

echo "📦 配置 PM2..."
pm2 delete perler-beads 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "📦 配置 Nginx..."
if ! command -v nginx &> /dev/null; then
  apt-get install -y nginx
fi

cat > /etc/nginx/conf.d/perler-beads.conf << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

nginx -t
systemctl restart nginx

echo ""
echo "✅ 部署完成！"
echo ""
echo "📊 服务状态："
pm2 status
echo ""
echo "📋 查看日志：pm2 logs perler-beads"
echo "🌐 访问地址：http://$(hostname -I | awk '{print $1}')"
echo ""
echo "⚠️  下一步："
echo "1. 编辑 .env.production 填入 API 密钥"
echo "2. 配置域名和 SSL 证书"
echo "3. 在阿里云安全组开放 80/443 端口"
