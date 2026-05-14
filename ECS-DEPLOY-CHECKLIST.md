# 拼豆 AI 生成器 - 阿里云 ECS 部署清单

## ✅ 已完成

- [x] Dockerfile 创建
- [x] PM2 配置文件 (ecosystem.config.js)
- [x] Nginx 配置模板 (nginx.conf)
- [x] 一键安装脚本 (install.sh)
- [x] 部署脚本 (deploy.sh)
- [x] 环境变量模板 (.env.example)
- [x] Next.js API Routes (orders/designs)
- [x] SQLite 数据库迁移脚本

---

## 📋 ECS 部署步骤

### 1. 上传代码到 ECS

**方式 A: Git 克隆**
```bash
ssh root@your-ecs-ip
cd /var/www
git clone <your-repo-url> perler-beads-ai
cd perler-beads-ai
```

**方式 B: SCP 上传**
```bash
# 在本地打包
tar -czf perler-beads.tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=data \
  --exclude=.env.production \
  .

# 上传到 ECS
scp perler-beads.tar.gz root@your-ecs-ip:/var/www/

# 在 ECS 解压
cd /var/www
tar -xzf perler-beads.tar.gz
cd perler-beads-ai
```

### 2. 运行一键安装

```bash
# 编辑 install.sh 填入你的 Git 仓库地址
nano install.sh  # 修改 REPO_URL

# 运行安装脚本
chmod +x install.sh
./install.sh
```

### 3. 配置环境变量

```bash
cd /var/www/perler-beads-ai
cp .env.example .env.production
nano .env.production
```

**必填配置:**
```bash
# 火山引擎 API 密钥（AI 图片优化功能）
VOLC_ACCESS_KEY_ID=你的 AccessKeyID
VOLC_SECRET_ACCESS_KEY=你的 AccessKeySecret

# 数据库路径
DATABASE_PATH=/var/www/perler-beads-ai/data/perler-beads.db
```

### 4. 安装 better-sqlite3

```bash
# better-sqlite3 是 native 模块，需要在 Linux 上重新构建
npm rebuild better-sqlite3
```

### 5. 启动服务

```bash
# PM2 启动
pm2 start ecosystem.config.js

# 保存 PM2 配置（开机自启）
pm2 save
pm2 startup
# 按提示执行生成的命令
```

### 6. 配置 Nginx

```bash
# 复制 nginx 配置
cp nginx.conf /etc/nginx/conf.d/perler-beads.conf

# 修改域名
nano /etc/nginx/conf.d/perler-beads.conf
# 将 your-domain.com 改为你的域名

# 测试并重启
nginx -t
systemctl restart nginx
```

### 7. 配置阿里云安全组

在阿里云控制台 ECS → 安全组：
- 添加规则：TCP 80 (HTTP)
- 添加规则：TCP 443 (HTTPS)
- （可选）TCP 3000 (直接访问)

---

## 🔧 后续维护

### 更新代码
```bash
cd /var/www/perler-beads-ai
git pull
npm install
npm run build
pm2 restart perler-beads
```

### 查看日志
```bash
# 应用日志
pm2 logs perler-beads

# PM2 日志
tail -f /root/.pm2/logs/perler-beads-out.log
tail -f /root/.pm2/logs/perler-beads-err.log

# Nginx 日志
tail -f /var/log/nginx/perler-beads-access.log
tail -f /var/log/nginx/perler-beads-error.log
```

### 数据库备份
```bash
# 手动备份
cp /var/www/perler-beads-ai/data/perler-beads.db \
   /backup/perler-beads-$(date +%Y%m%d).db

# 定时备份（crontab -e）
0 2 * * * cp /var/www/perler-beads-ai/data/perler-beads.db /backup/perler-beads-$(date +\%Y\%m\%d).db
```

---

## 🐛 故障排查

### 服务无法启动
```bash
pm2 logs perler-beads --lines 100
```

### 数据库错误
```bash
# 检查数据库文件
ls -la /var/www/perler-beads-ai/data/

# 检查权限
chmod 755 /var/www/perler-beads-ai/data
```

### 端口占用
```bash
lsof -i :3000
# 或
netstat -tulpn | grep 3000
```

### 重建 better-sqlite3
```bash
cd /var/www/perler-beads-ai
rm -rf node_modules/better-sqlite3
npm install better-sqlite3
```

---

## 📝 下一步建议

1. **配置域名**: 在阿里云 DNS 解析域名到 ECS IP
2. **配置 SSL**: 使用 Let's Encrypt 或阿里云 SSL 证书
3. **配置监控**: 安装阿里云云监控
4. **配置备份**: 设置自动备份数据库到 OSS
