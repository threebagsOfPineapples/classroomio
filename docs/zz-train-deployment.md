# zz_train 内网部署

## 部署位置

| 项目 | 地址 |
| --- | --- |
| 应用服务器 | 10.60.6.101 |
| 网页入口 | http://10.60.6.101:3082 |
| 文件存储接口 | http://10.60.6.101:3084 |
| 文件存储控制台 | 101 本机的 127.0.0.1:3085 |
| PostgreSQL | 10.60.6.199:5432 |
| 数据库 | train |
| 数据库专用账号 | zz_train |
| 部署目录 | /home/zhizhen/zz_train |

`api`、`dashboard`、`jobs` 共用一个应用镜像 `zz_train:latest`。Redis 与文件存储各有一个独立容器。镜像在独立构建环境生成，101 负责导入镜像和启动应用。

数据库专用账号拥有 `train`，不具备超级管理员、创建库或创建角色权限。199 的连接规则仅允许 101 使用该账号访问 `train`，连接使用 TLS 与 SCRAM。迁移需要的 `authenticated`、`anon` 是不允许登录的数据库角色。

## 构建

使用 `.github/workflows/build-zz-train.yml` 在 GitHub Actions 构建。推送 `build-zz-train-*` 标签可触发构建，生成包含镜像和 SHA256 校验文件的构建产物。镜像包含应用和依赖，运行镜像不保留 pnpm 下载缓存。

也可以在有足够资源的独立构建服务器执行：

```bash
docker buildx build --progress=plain \
  --build-arg DEBIAN_MIRROR=http://mirrors.tuna.tsinghua.edu.cn \
  --build-arg NPM_REGISTRY=https://registry.npmmirror.com \
  --build-arg SOURCE_REVISION="$(git rev-parse HEAD)" \
  --output type=docker,dest=zz_train.tar \
  -f docker/Dockerfile.zz-train -t zz_train:latest .
```

应用使用 Node 20.19.3、pnpm 10.19.0 编译，关闭生产前端 sourcemap。编译需要约 5 GB Node 堆空间，应预留系统和镜像导出的资源。禁止在承载 Web1、Web2 的 101 上编译；构建容器的资源限制无法消除宿主机内存和磁盘争用。

参考：[Docker 镜像构建产物](https://docs.docker.com/build/ci/github-actions/share-image-jobs/)、[清华 Debian 镜像说明](https://mirrors.tuna.tsinghua.edu.cn/help/debian/)。

## 启动与检查

将 `docker-compose.zz-train.yaml` 放到部署目录并命名为 `docker-compose.yaml`。按照 `docker/zz-train.env.example` 配置该目录下的 `.env`，所有占位密钥都要替换成独立随机值，文件权限设为 `600`。数据库连接密码和应用密钥不提交到 Git。

199 当前数据库证书的 DNS 名称为 `zzdata`。通过已验证主机身份的 SSH 获取数据库服务器的公开证书，存为部署目录下的 `certs/database-ca.pem`，不要复制证书私钥。Compose 将 `zzdata` 映射到 `10.60.6.199`，API 和任务容器只读挂载该证书，通过 `NODE_EXTRA_CA_CERTS` 信任它。数据库连接使用 `sslmode=verify-full`，验证证书与服务器名称。

参考：[Node.js 附加 CA 证书](https://nodejs.org/docs/latest-v20.x/api/cli.html#node_extra_ca_certsfile)、[PostgreSQL 客户端证书校验](https://www.postgresql.org/docs/current/libpq-ssl.html)。

```bash
cd /home/zhizhen/zz_train
sha256sum -c zz_train.tar.gz.sha256
docker load --input zz_train.tar.gz
docker compose config --quiet
docker compose up -d --wait redis minio api
docker compose up -d --wait dashboard jobs
docker compose ps
docker compose logs --tail 80 api dashboard jobs
```

API 启动时执行系统迁移与必要字典初始化，不运行演示数据种子。数据库位于 199；检查和备份也在 199 执行。

培训容器分别限制内存和 CPU。每一步启动前后检查宿主机可用内存、Web1、Web2 的接口响应和近期超时日志；出现资源压力或新增超时时，停止本次培训容器并检查影响。

文件存储需要 `documents`、`videos`、`media` 三个桶。课程文档和视频保持私有，`media` 只开放公开图片的读取权限。本次部署会完成桶初始化；重新部署时保留原有文件存储数据卷。

本次部署只初始化管理员和一门“至臻集团入职培训：公司介绍”课程。公司介绍以 18 页 PDF 课件在线展示和计时；PPT 原文件保存在管理员资料库。新课程默认关闭员工文件下载，管理员可以在课程设置中开启。

确认部署完成时，检查实际登录、课件显示、阅读进度保存、下载设置和课程数量。容器启动成功只代表进程已运行。

内网 HTTP 访问时，浏览器可能不提供 `crypto.randomUUID`。网页启动时会通过 Web Crypto 的 `getRandomValues` 补齐 UUID 生成方法，保证页面、表单和共享组件正常初始化。已有原生方法的浏览器继续使用原生实现。

## 数据保留与备份

管理员初始信息保存在部署目录的 `shared/initial-admin.json`，首次登录后应修改密码。数据库、MinIO 数据卷及 `shared/materials` 一起备份，避免课程记录和课件文件脱节。

```bash
sudo -u postgres pg_dump -Fc train > train-backup.dump
```

上面的备份命令在 199 执行。更新应用时保留 `.env`、数据库和数据卷，使用 `docker compose up -d`。不要使用 `docker compose down -v` 清空数据。
