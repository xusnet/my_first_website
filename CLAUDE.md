# CLAUDE.md

本文件为 AI 助手（Claude Code / opencode 等）在此仓库工作时提供指引。

## 项目概述

**Clark.Gong's Website** —— 个人技术博客 + 内置 CMS 内容管理后台（中文为主）。

- **公开博客**：文章列表 / 详情（Markdown 渲染）/ 分类 / 标签 / 关于页，暖色编辑风设计（`DESIGN.md`）。
- **CMS 后台**（`/admin`）：用户管理、角色管理、权限管理、内容管理（文章/分类/标签）、用户与站点设置、审计日志。
- **安全设计**：基于等保三级要求——复杂口令策略、首次登录强制改密、登录失败锁定、RBAC、哈希链防篡改审计日志。

## 目录结构

```
deploy/
  docker-compose.yml     MariaDB 11 + Redis 7 容器编排（数据卷持久化）
  .env                   DB/Redis 口令（勿提交）
  initdb/                容器首次初始化 SQL（当前为空，schema 由服务端 migrate 管理）
server/                  Express 5 + TypeScript（端口 3001）
  src/config.ts          环境配置（读 .env）
  src/app.ts             路由装配：/api/auth /api/public /api/{users,roles,...} + 静态托管
  src/index.ts           启动引导（连 MariaDB/Redis → 幂等 migrate+seed → listen）
  src/db/
    pool.ts              MariaDB 连接池 + runSchema()
    schema.sql           全部表 DDL（幂等 IF NOT EXISTS）
    migrate.ts / seed.ts CLI 入口；seedRunner.ts 种子逻辑（服务启动时也幂等执行）
  src/cache/redis.ts     ioredis 客户端
  src/middleware/        auth(JWT)/rbac/security(helmet+限流)/validate(zod)/error
  src/services/          auth(登录/锁定/改密)、authCache(Redis 用户缓存)
  src/routes/            auth/users/roles/permissions/posts/categories/tags/audit/settings/public
  src/utils/             password(复杂口令+bcrypt)/crypto(JWT)/audit(哈希链)/slug
client/                  Vite + React 19 + Tailwind 4 + react-router v7
  src/main.tsx           路由表（公开站点 + /admin CMS）
  src/lib/api.ts         fetch 封装（Bearer 注入、401 自动刷新重试）
  src/store/AuthContext  登录态（localStorage 存双令牌）
  src/components/        SiteLayout(公开布局)/Markdown/admin-ui(后台通用件)/SpikeMark
  src/pages/public/      首页/文章详情/分类/标签/关于
  src/admin/             Login/ChangePassword/AdminLayout/Dashboard/Users/Roles/
                         Permissions/Posts/PostEditor/CategoriesTags/Settings/AuditLogs
DESIGN.md                设计系统规范（色彩/字体/组件 token）
```

## 常用命令

### 基础设施（MariaDB + Redis）
```bash
cd deploy && docker-compose up -d     # 启动（首次自动建库）
cd deploy && docker-compose ps        # 健康检查
```

### Server（端口 3001）
```bash
cd server
npm run dev           # tsx watch 热重载
npm run build         # tsc 编译 + 复制 schema.sql 到 dist
npm start             # node dist/index.js
npm run db:migrate    # 单独执行 schema
npm run db:seed       # 单独执行种子（幂等）
```
服务启动时会**自动幂等执行** migrate + seed，无需手动初始化。

### Client（Vite dev 端口 5173，/api 代理到 3001）
```bash
cd client
npm run dev           # 开发服务器
npm run build         # tsc -b && vite build（产出 dist/）
```

### 生产运行
```bash
cd server && npm run build && npm start   # 同时托管 client/dist 静态资源
```

## 架构与数据流

- **MariaDB 为持久层**（14 张表：users/roles/permissions/user_roles/role_permissions/password_history/posts/categories/tags/post_categories/post_tags/user_settings/site_settings/audit_logs）。
- **Redis 承担三类缓存**：
  1. `auth:user:{id}` 用户鉴权信息缓存（5min，角色/权限变更时主动失效）
  2. `sess:refresh:{jti}` 刷新令牌会话（7d，一次性轮换）
  3. `login:fail:{username}` 登录失败计数（锁定依据）
  4. `blog:*` 公开博客接口缓存（60s，内容变更时按前缀失效）
- **认证流程**：登录签发 access(15m)+refresh(7d) → 客户端存 localStorage → 401 时自动 refresh 重试 → 改密/重置后全端吊销。
- **强制改密**：`must_change_password=1`（初始口令/被重置）时服务端仅放行改密相关接口，前端强制跳转改密页。
- **审计日志**：所有敏感操作写 `audit_logs`，SHA-256 哈希链防篡改；`GET /api/audit/verify` 校验完整性。
- **server 托管 client/dist**，非 `/api/*` GET 一律回退 `index.html`（SPA）。

## 初始账号

- 用户名 `admin`，初始口令见 `server/.env` 的 `ADMIN_INITIAL_PASSWORD`（***REMOVED-BY-HISTORY-REWRITE***）。
- 首次登录**强制改密**；测试环境当前口令以最近一次改动为准（可重置：将 users.password_hash 更新并置 must_change_password=1）。

## 约定与注意事项

- 样式全部走 Tailwind 工具类 + `index.css` `@theme` token（bg-primary/text-ink/rounded-lg 等），**不写死 hex**。
- 展示级标题用 `display-xl/lg/md/sm` 工具类（serif 500，负字距）；后台 UI 复用 `components/admin-ui.tsx` 的 Button/Badge/Card/Field/Modal 等。
- 服务端新增表：改 `src/db/schema.sql`（幂等），启动即生效；新增权限：改 `seedRunner.ts` PERMISSIONS 并重跑 seed。
- 新增管理接口：放 `protectedApi` 下（自动鉴权+改密守卫），用 `requirePermission('xxx:yyy')` 控权，写操作调用 `writeAudit()` 记审计。
- MariaDB 驱动 `pool.query` 对 SELECT **直接返回行数组**：单行用 `const [row] =`，多行用 `const rows =`（易错点）。
- 服务端构建需复制 schema.sql（package.json build 脚本已含 `cp`）。
- 环境配置：`server/.env`（DB/Redis/JWT/口令策略），模板见 `.env` 现有内容；生产务必更换全部密钥。
- 仓库未做 git 初始化；`.gitignore` 已忽略 node_modules/dist/.env。

## 验证

- `cd server && npm run build`、`cd client && npm run build`（两侧 tsc 严格检查均须通过）。
- `curl http://localhost:3001/api/health`；公开接口 `/api/public/posts`；登录 `/api/auth/login`。
- 审计链校验：登录后 `GET /api/audit/verify` 应返回 `{"valid":true}`。
- 浏览器冒烟：`/` 博客首页、`/post/welcome` 文章详情、`/admin/login` 登录页。
