# 等保三级（MLPS Level 3）合规说明

本文档说明本站安全设计如何对应《网络安全等级保护基本要求》第三级中与信息系统直接相关的技术与管理要求。

## 一、安全物理环境 / 安全通信网络

| 要求 | 实现 |
|---|---|
| 通信传输保密性 | 生产部署要求 HTTPS/TLS 反向代理（Nginx/Caddy）；应用层设置 HSTS 由反代注入 |
| 通信传输完整性 | JWT 签名（HMAC-SHA256）防篡改；审计日志哈希链保证完整性 |

## 二、安全区域边界

| 要求 | 实现 |
|---|---|
| 访问控制 | 全部管理接口需 Bearer Token；RBAC 按权限编码拦截（`middleware/rbac.ts`） |
| 入侵防范 | 全局限流 300 req/min；认证接口独立限流 10 req/min（`express-rate-limit`）；输入校验（zod） |
| 安全审计 | 边界层（Nginx）访问日志 + 应用层审计日志双层记录 |

## 三、安全计算环境

### 1. 身份鉴别（等保 8.1.4.1）

- **口令复杂度**：≥12 位，必须含大写、小写、数字、特殊字符；不得包含用户名；不得有连续 3 位相同字符（`utils/password.ts`）。
- **首次登录强制改密**：初始口令标记 `must_change_password`，未改密前仅允许「改密/查看本人/登出」三类请求（`middleware/auth.ts: requirePasswordChanged`）。
- **口令定期更换**：`password_changed_at` 超过 90 天（可配）登录时强制进入改密流程。
- **口令历史**：新口令不得与最近 5 次口令相同（`password_history` 表校验）。
- **登录失败处理**：连续失败 5 次锁定账号 15 分钟（Redis 计数 + DB `locked_until`），并记录审计。
- **口令存储**：bcrypt（cost=12），明文口令任何环节不落库、不打日志。
- **会话鉴别**：访问令牌 15 分钟有效期；刷新令牌 7 天、一次性轮换（rotation），改密/重置后全部吊销。
- **登录信息提示**：登录/登出/改密失败与成功均记入审计日志（含 IP、User-Agent）。

### 2. 访问控制（等保 8.1.4.2）

- **RBAC 模型**：用户 → 角色 → 权限（`users` / `roles` / `permissions` / `user_roles` / `role_permissions`）。
- **最小权限**：29 项细粒度权限按模块划分（user/role/post/category/tag/audit/settings/dashboard）。
- **默认角色**：superadmin（全部）、admin（除用户删除/口令重置等高危项）、editor、author、viewer。
- **特权保护**：超级管理员不可删除、不可禁用（他人操作时）；系统内置角色不可删除；不能删除自己。
- **数据级权限**：作者仅能编辑/删除自己的文章（`canEditPost`）。

### 3. 安全审计（等保 8.1.4.3）

- **覆盖范围**：登录/登出/刷新令牌、口令修改、用户 CRUD 与口令重置、角色与权限变更、文章/分类/标签 CRUD 与发布、站点设置变更。
- **记录内容**：主体（user_id/username）、时间、动作（action）、客体（resource/resource_id）、结果（success/failure）、来源 IP、User-Agent、详情。
- **防篡改**：审计日志以 **SHA-256 哈希链**组织（`prev_hash` + 本条规范化内容 + PEPPER → `log_hash`），任何历史记录被篡改或删除都会导致链条断裂，管理端提供一键校验接口（`GET /api/audit/verify`）。
- **不可删除**：应用层不提供审计日志删除/修改接口，仅可查询与校验。
- **可追溯**：支持按用户/动作/结果/关键字检索，分页展示。

### 4. 入侵防范（等保 8.1.4.4）

- 最小安装：服务仅暴露 3001 端口；MariaDB/Redis 仅监听本机（或容器网络），Redis 设置口令。
- 漏洞防护：依赖无已知高危漏洞（`npm audit` 通过）；错误响应不泄露堆栈（统一 500 兜底）。
- 输入校验：全部写接口经 zod schema 校验；参数化 SQL（mariadb 驱动 placeholder）杜绝注入。
- XSS：前端 Markdown 渲染默认不执行原始 HTML（react-markdown 安全默认值）；CSP 由 helmet 配置。
- 暴力破解：认证接口限流 + 账号锁定双机制。

### 5. 数据完整性 / 保密性 / 剩余信息保护

- 鉴别信息（口令）bcrypt 单向散列存储。
- 会话剩余信息保护：登出即销毁服务端刷新令牌；改密后强制全端下线。
- API 响应不返回口令哈希等敏感字段（用户列表/详情显式选择列）。

### 6. 数据备份恢复

- MariaDB 数据卷（`deploy` compose volume `mariadb-data`）可结合 `mariadb-dump` 定时备份（建议每日全量 + binlog 增量）。
- Redis 开启 AOF 持久化（appendonly yes）。

## 四、安全管理（管理层面要求落地建议）

- 应设立系统管理员/审计管理员分权：admin 角色无 `user:delete`、`user:reset-password`、`role:delete`、`role:assign-permission`，审计日志仅 `audit:read` 可见。
- 应定期评审审计记录（管理端提供检索与链校验）。

## 五、口令策略参数（server/.env）

| 参数 | 默认值 | 说明 |
|---|---|---|
| PASSWORD_MIN_LENGTH | 12 | 最小长度 |
| PASSWORD_REQUIRE_* | true | 大写/小写/数字/特殊字符 |
| PASSWORD_HISTORY | 5 | 不可复用的近期口令次数 |
| PASSWORD_MAX_AGE_DAYS | 90 | 口令最长使用期 |
| LOGIN_MAX_ATTEMPTS | 5 | 锁定阈值 |
| LOGIN_LOCK_MINUTES | 15 | 锁定时长 |
| JWT_ACCESS_TTL | 15m | 访问令牌有效期 |
| JWT_REFRESH_TTL | 7d | 刷新令牌有效期 |
