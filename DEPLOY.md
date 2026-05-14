# 拼豆 AI 生成器 - 阿里云 ECS 部署指南

## 前置要求

- 阿里云 ECS 实例（Ubuntu 20.04+ 或 CentOS 7+）
- Node.js 20+
- Nginx
- Git

---

## 方案一：传统 Node.js 部署（推荐）

### 1. 安装依赖

```bash
# SSH 登录 ECS
ssh root@your-ecs-ip

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2
sudo npm install -g pm2

# 安装 Git
sudo apt-get install -y git
```

### 2. 克隆项目

```bash
cd /var/www
git clone <your-repo-url> perler-beads-ai
cd perler-beads-ai
```

### 3. 安装项目依赖

```bash
npm install
```

### 4. 配置环境变量

```bash
cp .env.example .env.production
# 编辑 .env.production 填入实际配置
nano .env.production
```

### 5. 创建数据目录

```bash
mkdir -p data
chmod 755 data
```

### 6. 构建项目

```bash
npm run build
```

### 7. 配置 PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# 按提示执行生成的命令
```

### 8. 配置 Nginx

```bash
sudo nano /etc/nginx/conf.d/perler-beads.conf
# 复制 nginx.conf 内容
sudo nginx -t
sudo systemctl restart nginx
```

### 9. 部署脚本

```bash
# 之后每次更新只需运行
chmod +x deploy.sh
./deploy.sh
```

---

## 方案二：Docker 部署

### 1. 安装 Docker

```bash
curl -fsSL https://get.docker.com | bash
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. 构建镜像

```bash
docker build -t perler-beads-ai .
```

### 3. 运行容器

```bash
docker run -d \
  --name perler-beads \
  -p 3000:3000 \
  -v /var/www/perler-beads-ai/data:/app/data \
  -e NODE_ENV=production \
  perler-beads-ai
```

### 4. 配置 Nginx 反向代理

同上。

---

## 端口和防火墙

- **3000**: Next.js 应用端口
- **80**: HTTP (Nginx)
- **443**: HTTPS (Nginx + SSL)

### 阿里云安全组配置

在阿里云控制台开放：
- TCP 80 (HTTP)
- TCP 443 (HTTPS)
- （可选）TCP 3000 (直接访问应用)

---

## SSL 证书（推荐）

### 使用 Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 使用阿里云 SSL 证书

1. 在阿里云申请免费 SSL 证书
2. 下载 `.pem` 和 `.key` 文件
3. 上传到服务器
4. 修改 nginx.conf 启用 HTTPS 配置

---

## 监控和维护

### PM2 常用命令

```bash
pm2 status              # 查看状态
pm2 logs perler-beads   # 查看日志
pm2 restart perler-beads # 重启
pm2 stop perler-beads    # 停止
pm2 delete perler-beads  # 删除
```

### 日志位置

- PM2 日志：`/root/.pm2/logs/`
- Nginx 日志：`/var/log/nginx/`
- 应用日志：项目 `logs/` 目录

---

## 数据库备份

SQLite 数据库文件位于 `data/perler-beads.db`

```bash
# 备份
cp data/perler-beads.db data/perler-beads.db.backup.$(date +%Y%m%d)

# 定期备份（crontab）
0 2 * * * cp /var/www/perler-beads-ai/data/perler-beads.db /backup/perler-beads-$(date +\%Y\%m\%d).db
```

---

## 故障排查

### 应用无法启动

```bash
pm2 logs perler-beads --lines 50
```

### 端口被占用

```bash
sudo lsof -i :3000
sudo netstat -tulpn | grep 3000
```

### 权限问题

```bash
chown -R www-data:www-data /var/www/perler-beads-ai/data
chmod -R 755 /var/www/perler-beads-ai
```
