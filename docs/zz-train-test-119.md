# 119 独立测试环境

本环境运行于 `10.60.2.119` 的 Docker Desktop，项目名为 `zz_train_test119`。入口为 `http://10.60.2.119:3082`，文件入口为 `http://10.60.2.119:3084`。应用镜像统一使用 `zz_train`，存储镜像为 `zz_train_storage:test119`。

## 隔离范围

- PostgreSQL 使用新卷和 `train_test119` 数据库，应用账户 `zz_train_test` 不具备超级用户、建库、建角色权限。数据库端口仅绑定本机 `127.0.0.1:55432`。
- `training_phase_one` 是同一测试 PostgreSQL 实例中的独立集成测试库。
- Redis、文件存储各使用本项目的专用卷。未复用原有 `zz-train-phase-one-*` 容器的数据。
- 钉钉关闭，未配置真实通讯录、邮件或 AI 凭据。
- 验收脚本仅接受指定测试库和 119 入口；创建模拟员工和业务数据，保留每轮验收历史。

## 配置与构建

在 119 上使用以下 Docker 客户端和专用配置目录：

```powershell
$docker = 'C:\Users\Administrator\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe'
$testDirectory = 'D:\Work\train\.local-infra\test-119'
$dockerArguments = @('--config', "$testDirectory\docker-cli", '--context', 'desktop-linux')
```

SSH 密钥登录会话不能读取 Windows 凭据管理器中的 Docker 登录信息。专用 `docker-cli/config.json` 使用公开镜像的匿名认证配置，并单独创建指向 Docker Desktop Linux 引擎的 context；它不修改桌面用户原有配置。配置依据见 [Docker CLI 配置文档](https://docs.docker.com/reference/cli/docker/#configuration-files)及 [CLI 默认凭据检测实现](https://github.com/docker/cli/blob/master/cli/config/config.go)。

私有配置文件为 `$testDirectory\.env`，只允许本机 Administrators、SYSTEM 读取。必须提供以下键，不将其内容提交到 Git：

```text
ZZ_TRAIN_IMAGE
POSTGRES_PASSWORD
TRAINING_DB_PASSWORD
PRIVATE_SERVER_KEY
BETTER_AUTH_SECRET
HLS_SIGNING_SECRET
STORAGE_PASSWORD
```

密码首次生成后持续复用；已有数据库卷时更改 `.env` 不会自动修改数据库密码。

构建输入应为 `git archive` 导出的固定提交或暂存树。不要把含 `.local-infra`、`.env`、缓存和验收账号的工作目录直接作为构建上下文。将干净源码解包为 `$sourceDirectory` 后执行：

```powershell
& $docker @dockerArguments build -f "$sourceDirectory\docker\Dockerfile.test-storage" -t zz_train_storage:test119 $sourceDirectory
& $docker @dockerArguments build -f "$sourceDirectory\docker\Dockerfile.zz-train" --build-arg "SOURCE_REVISION=$revision" -t "zz_train:test119-$revision" $sourceDirectory
```

MinIO 采用固定官方源码版本构建，见 `docker/Dockerfile.test-storage`。原官方容器地址拉取失败；[该版本发布说明](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z)提供源码构建方式。测试存储镜像不表示生产存储选型已完成。

## 启动与验收

将 `.env` 中 `ZZ_TRAIN_IMAGE` 设置为本轮构建的确切标签，再使用同一源码目录：

```powershell
$composeArguments = $dockerArguments + @('compose', '--env-file', "$testDirectory\.env", '-f', "$sourceDirectory\docker-compose.zz-train-test.yaml")
& $docker @composeArguments config -q
& $docker @composeArguments up -d --wait --wait-timeout 240
& $docker @composeArguments ps
```

API 首次启动会运行现有数据库迁移并填充必要角色等基础数据。新迁移只在测试库执行。MinIO 初始化只开放 `media` 公开读取，`documents` 和 `videos` 保持私有。

真实接口验收使用 `scripts/test-119-acceptance.mjs`。在 API 容器环境中以 `TEST119_ACCEPTANCE=true` 运行，并挂载独立私有卷到 `/app/test119-private`。脚本覆盖派课去重、实名及匿名问卷、本人签到、请假缺勤、师徒任务及指定主管认证，以及重复请求、截止、越权、导出和审计检查。

账号只写入私有卷的 `验收账号与资源.json`（权限 `600`），不输出密码、cookie 或 token。该文件和数据库卷应一起保存；不要在仍有验收进程时删除锁文件。

## 数据保护与恢复

停止测试环境使用上述 compose 参数加 `stop`。保留数据卷，日常升级不执行 `down -v`。

升级前对 `train_test119` 做 PostgreSQL 自定义格式备份，并备份文件存储卷和私有验收账号卷。记录应用镜像 ID、源码版本、数据库迁移末条记录和备份校验值。恢复验证应进入新的测试库或新项目卷，不覆盖当前测试数据。

尚未验收的事项及本轮实际结果以 `prd/zz-training-phase-one-20261012` 下的实施记录为准；容器健康不等于业务验收完成。
