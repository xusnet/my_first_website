# Clark.Gong's Website

个人技术博客 + 内置 CMS 内容管理后台，按等保三级（MLPS Level 3）安全要求设计与实现。

- **线上站点**：<https://xusnet.cn>（HTTP 自动跳转 HTTPS）
- **公开博客**：文章流 / 文章详情（Markdown 渲染）/ 分类 / 标签 / 关于页，暖色编辑风设计（见 `DESIGN.md`）
- **CMS 后台**（`/admin`）：仪表盘、文章管理（Markdown 编辑器 + 实时预览）、分类 / 标签管理、用户 / 角色 / 权限管理、站点设置、审计日志
- **安全能力**：复杂口令策略、首次登录强制改密、登录失败锁定、JWT 双令牌、RBAC、审计日志哈希链防篡改（合规映射见 `docs/MLPS-L3.md`）

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vite 7 · React 19 · TypeScript · Tailwind CSS 4 · React Router 7 · react-markdown |
| 后端 | Node.js · Express 5 · TypeScript · zod · helmet · express-rate-limit |
| 数据 | MariaDB 11 · Redis 7 |
| 基础设施 | Docker Compose · Nginx · systemd |

## 软件架构

```
                        ┌──────────────────────────────────────────┐
                        │                 Nginx :80/:443           │
                        │  静态加速 · gzip · HTTP→HTTPS · 反向代理    │
                        └───────────────────┬──────────────────────┘
                                            │ proxy_pass
                                            ▼
┌──────────────┐  静态托管   ┌──────────────────────────────────────────┐
│  浏览器      │◄───────────│        Node / Express :3001               │
│  SPA (React) │            │                                          │
└──────────────┘            │  middleware: security → auth → rbac      │
        fetch /api/*  ─────►│              → validate → error          │
                            │                                          │
                            │  routes: auth / public / posts / users   │
                            │           roles / permissions / tags    │
                            │           categories / settings / audit  │
                            │                                          │
                            │  services: auth（登录/锁定/改密）        │
                            │  utils: password · crypto(JWT) · audit   │
                            └───────────┬───────────────┬──────────────┘
                                        │               │
                              ┌─────────▼──────┐  ┌─────▼─────────┐
                              │  MariaDB 11    │  │   Redis 7      │
                              │  14 张表       │  │  缓存/会话/限流 │
                              └────────────────┘  └───────────────┘
```

### 模块职责

- **`client/`（SPA）**：公开站点 + `/admin` 后台单页应用。`src/lib/api.ts` 统一封装 fetch（Bearer 注入、401 自动刷新重试）；`AuthContext` 管理双令牌登录态。
- **`server/src/middleware/`**：安全中间件链（helmet、双层限流、JWT 鉴权、RBAC 控权、zod 校验、统一错误处理）。
- **`server/src/services/`**：认证业务（登录失败锁定、强制改密拦截、口令历史校验）与 Redis 用户缓存。
- **`server/src/db/`**：连接池 + 幂等 schema（`schema.sql`）+ 种子数据（`seedRunner.ts`，服务启动时自动执行）。
- **`server/src/utils/audit.ts`**：审计日志 SHA-256 哈希链，`GET /api/audit/verify` 一键校验完整性。

### 数据模型（14 张表）

`users` · `roles` · `permissions` · `user_roles` · `role_permissions` · `password_history` · `posts` · `categories` · `tags` · `post_categories` · `post_tags` · `user_settings` · `site_settings` · `audit_logs`

### Redis 用途

| 键模式 | 用途 | TTL |
| --- | --- | --- |
| `auth:user:{id}` | 用户鉴权信息缓存（角色 / 权限变更主动失效） | 5min |
| `sess:refresh:{jti}` | 刷新令牌会话（一次性轮换） | 7d |
| `login:fail:{username}` | 登录失败计数（锁定依据） | 15min |
| `blog:*` | 公开博客接口缓存（内容变更按前缀失效） | 60s |

## 本地开发

### 前置条件

- Node.js ≥ 20
- Docker + Docker Compose

### 启动基础设施

```bash
cd deploy && docker compose up -d   # MariaDB 11 + Redis 7，数据卷持久化
```

> 端口映射仅绑定 `127.0.0.1`，数据库不暴露公网。连接口令在 `deploy/.env` 配置。

### 启动后端（端口 3001）

```bash
cd server
cp .env.example .env   # 或参照下文环境变量自行创建
npm install
npm run dev            # tsx watch 热重载；启动时自动幂等 migrate + seed
```

### 启动前端（端口 5173，/api 代理到 3001）

```bash
cd client
npm install
npm run dev
```

### 初始账号

- 用户名 `admin`，初始口令取 `server/.env` 的 `ADMIN_INITIAL_PASSWORD`
- 首次登录**强制改密**（≥12 位、四类字符、不可与最近 5 次历史重复）

## 环境变量（server/.env）

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `NODE_ENV` / `PORT` | 运行环境 / 监听端口 | `development` / `3001` |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | MariaDB 连接 | `127.0.0.1` / `3306` / `clarkgong` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis 连接 | `127.0.0.1` / `6379` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 双令牌签名密钥（生产必须强随机） | — |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | 令牌有效期 | `15m` / `7d` |
| `AUDIT_PEPPER` | 审计哈希链盐值 | — |
| `ADMIN_USERNAME` / `ADMIN_INITIAL_PASSWORD` | 种子管理员（仅首次建库生效） | `admin` |
| `PASSWORD_MIN_LENGTH` / `PASSWORD_REQUIRE_*` / `PASSWORD_HISTORY` / `PASSWORD_MAX_AGE_DAYS` | 口令策略 | `12` / `true` / `5` / `90` |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES` | 登录锁定策略 | `5` / `15` |
| `RATE_LIMIT_GLOBAL_PER_MIN` / `RATE_LIMIT_AUTH_PER_MIN` | 限流（全局 / 认证接口） | `300` / `10` |

> **注意**：dotenv 将未加引号值中的 `#` 之后内容视为行内注释。含 `#` 等特殊字符的值务必用双引号包裹，例如 `ADMIN_INITIAL_PASSWORD="Prod#Admin@2026"`。

## 生产部署

### 1. 构建

```bash
cd server && npm run build   # tsc 编译 + 复制 schema.sql 到 dist/
cd client && npm run build   # 产出 client/dist（由 server 静态托管）
```

目录布局（`server/dist` 与 `client/dist` 同级，静态托管路径按此解析）：

```
/data/web/
├── deploy/     docker-compose.yml · .env · initdb/
├── server/     dist/ · package.json · node_modules/ · .env
└── client/     dist/
```

### 2. 基础设施与应用

```bash
cd /data/web/deploy && docker compose up -d          # MariaDB + Redis（healthy）
cd /data/web/server && npm ci --omit=dev             # 生产依赖
sudo systemctl enable --now clarkgong-web            # systemd 守护，开机自启
```

systemd 单元示例（`/etc/systemd/system/clarkgong-web.service`）：

```ini
[Unit]
Description=Clark.Gong Website (Express)
After=network.target docker.service

[Service]
Type=simple
User=ecs-user
WorkingDirectory=/data/web/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> `.env` 由应用从工作目录读取，`WorkingDirectory` 指向 `server/` 即可，无需 `EnvironmentFile`。

### 3. Nginx 反向代理（HTTP → HTTPS）

```nginx
server {
    listen       80;
    server_name  example.cn www.example.cn;

    location ^~ /.well-known/acme-challenge/ { root /usr/share/nginx/html; }

    location / { return 301 https://$host$request_uri; }
}

server {
    listen       443 ssl;
    http2        on;
    server_name  example.cn www.example.cn;

    ssl_certificate     /etc/nginx/ssl/example.cn.crt;
    ssl_certificate_key  /etc/nginx/ssl/example.cn.key;

    client_max_body_size 5m;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    location / {
        proxy_pass         http://127.0.0.1:3001;   # 容器化 Nginx 则指向网桥网关
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### 部署检查清单

- [ ] `deploy/.env` 与 `server/.env` 使用全新强随机密钥（不复用开发值），文件权限 `600`
- [ ] MariaDB / Redis 端口仅绑定 `127.0.0.1`，不暴露公网
- [ ] 安全组仅放行 `80` / `443`（及 SSH 管理端口）
- [ ] `curl https://your-domain/api/health` 返回 `{"status":"ok"}`
- [ ] 登录后台完成初始口令修改，`GET /api/audit/verify` 返回 `{"valid":true}`

## 常用命令

```bash
# 基础设施
cd deploy && docker compose ps

# 服务端
cd server && npm run build && npm start
cd server && npm run db:migrate    # 单独执行 schema
cd server && npm run db:seed       # 单独执行种子（幂等）

# 前端
cd client && npm run build

# 运维（生产）
sudo systemctl restart clarkgong-web
docker exec nginx nginx -s reload
```

## 验证

```bash
curl https://your-domain/api/health          # 健康检查
curl https://your-domain/api/public/posts    # 公开文章列表
```

- 双端 `npm run build` 严格 tsc 检查均须通过
- 登录后 `GET /api/audit/verify` 应返回 `{"valid":true}`（审计哈希链完整）

## 更多文档

- `DESIGN.md` — 设计系统规范（色彩 / 字体 / 组件 token）
- `docs/MLPS-L3.md` — 等保三级合规映射
- `CLAUDE.md` — AI 协作开发指引（目录结构、命令、约定与易错点）
