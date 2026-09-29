# 本机应用与 Docker 数据服务

## 已部署

使用 `docker-compose.local-infra.yaml`，项目名 `enterprise-training-fresh`。

| 服务 | 本机地址 | 容器内存上限 |
| --- | --- | --- |
| PostgreSQL 16 | 127.0.0.1:55432 | 768 MB |
| Redis 7 | 127.0.0.1:56379 | 256 MB |

数据库为 `enterprise_training`，用户名为 `training`。随机密码及完整连接地址保存在仓库 `.local-infra/.env`，该文件被 Git 忽略。不要复制到文档或提交。

新数据卷为 `enterprise-training-fresh_postgres-fresh` 和 `enterprise-training-fresh_redis-fresh`。旧容器及旧数据卷保留，没有迁移业务数据。

初次初始化结果：124 张 public 表、29 条迁移记录；`exam_makeup` 表及三个催学字段存在。2026-09-29 复查：已存在公司组织、管理员和测试员工及用户创建的课程；本次部署继续使用这些数据。

## 启动和停止

在仓库根目录执行：

```powershell
docker compose --env-file .local-infra/.env -f docker-compose.local-infra.yaml up -d --wait
docker compose --env-file .local-infra/.env -f docker-compose.local-infra.yaml ps
docker stats --no-stream enterprise-training-fresh-postgres-1 enterprise-training-fresh-redis-1
```

暂时不用时停止这两个容器：

```powershell
docker compose --env-file .local-infra/.env -f docker-compose.local-infra.yaml stop
```

不要使用 `down -v`，这会删除新环境的数据卷。

## 本机 API 连接

当前 API 构建已经通过。使用 Node 20，在 `apps/api` 目录启动独立的测试端口：

```powershell
$env:PORT = '3003'
$env:PUBLIC_SERVER_URL = 'http://localhost:3003'
$env:DASHBOARD_ORIGIN = 'http://localhost:4174'
$env:TRUSTED_ORIGINS = 'http://localhost:4174,http://localhost:4173'
$env:PGBOUNCER_DATABASE_URL = ''
node --env-file=.env --env-file=../../.local-infra/.env dist/index.js
```

第二个环境文件覆盖数据库和 Redis 地址，连接池为 5。启动前确认没有继承旧的 `DATABASE_URL`、`REDIS_URL` 或 PgBouncer 地址；Node 的已存在进程环境变量优先于环境文件。

2026-09-29：后台 `Start-Process` 启动 Node 被执行策略拒绝，改用可管理的前台服务会话启动成功。API 监听 3003，不改变其他项目的进程或数据配置。

## 资源和后续工作

初始化后的两个容器合计内存约 73 MB，这是一次空库测量，不是运行峰值；WSL 虚拟机另占约 2.8 GB。容器限制并不限制 Docker Desktop 或整个 WSL。

Docker 启动后曾出现新进程内存不足，暂停这两个容器并重新核对资源后恢复；未关闭其他项目进程或修改全局 WSL 设置。

管理员与测试员工已创建，可使用现有课程验证。待完成正式课程内容及管理员与员工业务闭环验收；基础部署验证不代表完整业务验收通过。

配置依据：[Docker Compose 服务与资源限制](https://docs.docker.com/reference/compose-file/services/)。

## 前端生产部署（已完成）

- 登录地址：`http://localhost:4174/login`；API：`http://localhost:3003`。
- Node 20.19.3，构建时 `NODE_OPTIONS=--max-old-space-size=5120`；Dashboard 生产构建及 Node adapter 打包成功，退出状态 0。
- 前端运行配置位于 `.local-infra/dashboard/.env`，只监听 `127.0.0.1:4174`。当前限本机访问，没有配置局域网访问或开机自启。
- 前后端的 `PRIVATE_SERVER_KEY` 已设置为同一份随机密钥，保存在各自被 Git 忽略的环境文件中。不要将其改为浏览器可见的 `PUBLIC_` 变量。
- API PID 保存在 `.local-infra/api.pid`，前端 PID 保存在 `.local-infra/dashboard.pid`。重启前先验证对应端口的监听 PID，避免误停其他进程。
- 当前完整包路径记录于 `.local-infra/dashboard.next-release.txt`。在 `apps/dashboard` 目录使用 Node 20 启动：

  ```powershell
  $releasePath = (Get-Content '../../.local-infra/dashboard.next-release.txt' -Raw).Trim()
  $env:NODE_ENV = 'production'
  node --env-file=.env --env-file=../../.local-infra/dashboard/.env (Join-Path $releasePath 'index.js')
  ```

  若当前进程环境已有旧地址或端口，先清理覆盖项。`apps/dashboard/build` 是保留的旧版本；启动新版应使用上述记录的发布路径。
- 2026-09-29 验证：登录页 HTTP 200；管理员 `admin@zhizhen.test`、员工 `student@zhizhen.test` 登录成功。测试密码沿用用户设置，不另写入部署文档。
- 已用真实浏览器检查管理与学习主要路由的手机/桌面布局、顶部单一语言入口，以及管理员课程预览 65 秒无学习写入请求。仍有登录页 CSP 和遥测错误记录，不能声称浏览器零错误；详见 [实施与验收状态](26-internal-training-implementation-status.md)。
- 新构建日志位于系统临时目录 `enterprise-deploy-api-build.log`、`enterprise-deploy-dashboard-build.log`；运行日志输出在两个服务会话中。
