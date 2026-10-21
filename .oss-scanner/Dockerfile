# OSS Scanner 构建镜像
#
# 契约（见 anthropics/oss-scanner README）：
#   - 仓库 checkout 由 scanner 作为 build context 挂入，落点是 /src
#   - build 阶段有外网，用于安装全部依赖；扫描阶段完全断网
#   - 因此数据库引擎、Redis、以及所有 npm 依赖都必须在 build 期装进镜像
#
# 本项目是前后端分离的 Node 应用：
#   client/  React 19 + Vite + TypeScript
#   server/  Express 5 + TypeScript，持久层 MariaDB，缓存/限流 Redis
# 单容器内需要同时具备 MariaDB 与 Redis，由 oss-entrypoint 在启动时拉起。

FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=development \
    TZ=Asia/Shanghai

# 系统依赖：构建工具链 + MariaDB + Redis + 便于调试的工具
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates git curl procps \
      build-essential python3 pkg-config \
      mariadb-server mariadb-client redis-server \
    && rm -rf /var/lib/apt/lists/*

# scanner 契约：checkout 落点固定为 /src
COPY . /src
WORKDIR /src

# 依赖安装（构建期联网，扫描期断网后无法再装）
RUN cd /src/client && npm ci --no-audit --no-fund
RUN cd /src/server && npm ci --no-audit --no-fund

# 构建前端产物与后端编译输出
RUN cd /src/client && npm run build
RUN cd /src/server && npm run build

# 初始化 MariaDB 数据目录。必须在 build 期完成：扫描阶段无外网，
# 也不能保证 apt / 网络可用。
RUN mkdir -p /var/lib/mysql /run/mysqld /var/log/mysql \
    && chown -R mysql:mysql /var/lib/mysql /run/mysqld /var/log/mysql \
    && mariadb-install-db --user=mysql --datadir=/var/lib/mysql \
         --auth-root-authentication-method=normal >/dev/null

COPY .oss-scanner/oss-entrypoint.sh /usr/local/bin/oss-entrypoint
RUN chmod +x /usr/local/bin/oss-entrypoint

# OSS Scanner 的工具层在最后执行 `ENTRYPOINT []`，会把本镜像的 ENTRYPOINT 清空，
# 只留下 `CMD ["bash"]`。那样一来进入容器时 MariaDB 与 Redis 都不会启动。
# 所以把同一套拉起逻辑同时挂到 shell 的启动路径上：无论以 ENTRYPOINT、
# 还是以交互式 bash 进入，依赖都已经就绪。
RUN printf '%s\n' \
      'if [ -x /usr/local/bin/oss-entrypoint ]; then' \
      '  /usr/local/bin/oss-entrypoint true >/tmp/oss-env.log 2>&1 || echo "[oss] 环境启动失败，详见 /tmp/oss-env.log"' \
      'fi' \
      > /etc/profile.d/oss-env.sh \
 && chmod 644 /etc/profile.d/oss-env.sh \
 && printf '\n# 拉起 OSS Scanner 所需的本地依赖\n[ -r /etc/profile.d/oss-env.sh ] && . /etc/profile.d/oss-env.sh\n' >> /root/.bashrc

# 暴露应用端口，便于进入容器后直接访问
EXPOSE 3001 5173 3306 6379

# ENTRYPOINT 保证服务就绪后再交给你要执行的命令，
# 无论是 `docker run <image>` 还是 `docker run <image> /bin/bash`。
ENTRYPOINT ["/usr/local/bin/oss-entrypoint"]
CMD ["/bin/bash"]