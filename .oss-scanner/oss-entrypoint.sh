#!/bin/bash
# OSS Scanner 容器入口：在断网环境中把本项目需要的外部依赖拉起来。
#
# 扫描阶段没有外网，所以这里只做本地初始化：
#   1. 启动 MariaDB（数据目录已在镜像构建期 init 完成）
#   2. 启动 Redis
#   3. 幂等创建数据库与账号
#   4. 幂等执行 schema 迁移
# 之后 exec 到调用方指定的命令（默认 /bin/bash）。
set -u

APP_DB="${APP_DB:-clarkgong}"
APP_USER="${APP_USER:-clarkgong}"

log() { echo "[oss-entrypoint] $*"; }

start_mariadb() {
  pgrep -x mariadbd >/dev/null 2>&1 && { log "MariaDB 已在运行"; return 0; }
  mkdir -p /run/mysqld /var/log/mysql
  chown -R mysql:mysql /run/mysqld /var/log/mysql 2>/dev/null || true
  log "启动 MariaDB..."
  mysqld_safe --datadir=/var/lib/mysql >/var/log/mysql/boot.log 2>&1 &
  for _ in $(seq 1 60); do
    if mariadb-admin ping --silent >/dev/null 2>&1; then
      log "MariaDB 已就绪"
      return 0
    fi
    sleep 1
  done
  log "MariaDB 启动超时，日志尾部："
  tail -20 /var/log/mysql/boot.log 2>/dev/null || true
  return 1
}

start_redis() {
  pgrep -x redis-server >/dev/null 2>&1 && { log "Redis 已在运行"; return 0; }
  log "启动 Redis..."
  redis-server --daemonize yes --save '' --appendonly no --bind 127.0.0.1 --port 6379
  for _ in $(seq 1 20); do
    redis-cli ping >/dev/null 2>&1 && { log "Redis 已就绪"; return 0; }
    sleep 1
  done
  log "Redis 启动超时"
  return 1
}

init_db() {
  # 幂等：库、账号、授权
  mariadb -uroot <<SQL 2>/dev/null || log "初始化 SQL 有告警（通常是无害的重复执行）"
CREATE DATABASE IF NOT EXISTS \`${APP_DB}\`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${APP_USER}'@'%';
CREATE USER IF NOT EXISTS '${APP_USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${APP_DB}\`.* TO '${APP_USER}'@'%';
GRANT ALL PRIVILEGES ON \`${APP_DB}\`.* TO '${APP_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
  # 幂等执行 schema（migrate.ts 内部全部是 CREATE TABLE IF NOT EXISTS）
  if [ -d /src/server ]; then
    log "执行 schema 迁移..."
    ( cd /src/server && npm run db:migrate ) \
      || log "迁移未成功，可手动重试：cd /src/server && npm run db:migrate"
  fi
}

start_mariadb
start_redis
init_db

log "环境就绪。常用命令："
log "  后端开发模式: cd /src/server && npm run dev"
log "  后端生产模式: cd /src/server && ADMIN_INITIAL_PASSWORD='...' JWT_ACCESS_SECRET='...' \\"
log "                 JWT_REFRESH_SECRET='...' AUDIT_PEPPER='...' NODE_ENV=production npm start"
log "  前端构建预览: cd /src/client && npm run build && npm run preview"
log "  填入种子数据: cd /src/server && npm run db:seed"

exec "$@"