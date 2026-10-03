# 本地验证记录：2026-10-03

## 结论与运行入口

本次验证未发现阻断本轮改动的产品问题。48 项定向测试、19 个真实页面的两种宽度检查、管理员和员工交互回归、PDF 阅读器回归均通过。另在独立测试库完成了真实计划保存、发布分配、评分方案保存与发布、评分录入和调整，以及员工端读取结果。

- 登录：<http://localhost:4174/login>
- 管理端：<http://localhost:4174/admin>
- 员工端：<http://localhost:4174/lms>
- API：<http://localhost:3003/>
- 测试管理员：`admin@verification.test`
- 测试员工：`employee@verification.test`
- 测试密码：见仓库根目录 `.local-infra/verification-20261003/test-credentials.json` 的 `password` 字段。该文件已由 Git 忽略，本文不复制密码。

API 和页面服务保留运行。本次使用 Node `v20.19.3`，页面沿用已完成构建的 `apps/dashboard/.local-infra/release-20261002-193609/build`。本次没有重建该版本，没有修改业务源代码，也没有提交或推送。

## 数据隔离与环境处理

用户明确选择“使用独立测试库继续验证”。应用当前连接的数据库为 `enterprise_training_verification_20261003`，Redis 使用数据库 3。

验证库通过仓库既有 `db-setup.ts` 完成初始化，迁移记录为 29 条。仅选择性添加两个测试账号、一个企业、三门课程及九个课时，再补齐其中一门课程的三篇可阅读正文。真实写入均发生在该验证库。

启动 Docker 时，遗留的零字节 IPC 重解析文件阻止了启动。原目录已改名备份后重新创建，备份路径保存在 `.local-infra/verification-20261003/docker-ipc-backup.txt`。

原数据盘仍在 `E:/Docker/wsl/DockerDesktopWSL/disk/docker_data.vhdx`；验证前后大小均为 `31813795840` 字节，修改时间均为 `2026-10-02 20:32:53`。本次未挂载、切换或恢复该盘。当前 Docker 使用的是 C 盘新建的数据盘，原管理员、员工和课程尚未恢复到当前环境。

## 验证结果

| 检查 | 结果 | 证据范围 |
| --- | --- | --- |
| Dashboard 定向测试 | 8 个文件，34/34 通过 | 企业管理、考核、培训计划、员工任务、PDF 资源工具 |
| API 定向测试 | 3 个文件，14/14 通过 | 考试策略、LMS 汇总、员工课程查询 |
| 管理员交互回归 | 通过 | 接口模拟：未保存方案禁止发布旧版本、评分草稿切换隔离、计划和员工编辑丢弃确认、准备步骤状态 |
| 员工交互回归 | 通过 | 接口模拟：9 种任务状态、任务和资格查询失败重试、无权限时隐藏开始入口、培训课程与考试链接、证书列表失败重试 |
| 真实页面布局 | 38/38 通过 | 管理员 13 页、员工 6 页，分别在 1440px 和 390px 下检查 |
| PDF 阅读器 | 通过 | 临时 PDF 响应：方向键不切换课时，Esc 关闭后重新打开仍记录阅读事件，390px 布局正常，预览业务写入为 0 |
| 真实计划保存与发布 | 通过 | 页面保存草稿、预览一个对象、确认发布；数据库状态为 `PUBLISHED`，仅分配给测试员工 |
| 真实评分与调整 | 通过 | API 保存并发布方案，人工评分 91，调整 -6，最终 85，结果 `PASS` |
| 真实员工读取 | 通过 | 培训列表及详情显示分配课程、85 分和已通过；课程入口可见，390px 详情无横向溢出 |
| 员工管理权限 | 通过 | 员工读取计划管理 API 返回 403 |

布局检查覆盖工作台、部门、员工、计划、考核、矩阵、统计、课程管理、课件资源、标签、企业信息、课程内容与设置，以及员工首页、我的培训、课程库、考核、档案和证书。每页语言入口数量为 1，未检出脚本列出的英文界面残留项。

真实流程留下的数据为：1 条计划、1 条培训报名、1 条评分输入、1 条评分调整。核对时未出现重复写入。测试计划编码为 `LOCAL-VERIFY-20261003`。

评分通过后，课程学习进度仍为 0%，培训状态为 `IN_PROGRESS`。本次验证确认分数不会把尚未学完的培训直接标成完成；未验证完整学习结束后的证书签发。

临时真实流程脚本曾因控件名称、重复文本匹配及结果枚举断言不符而误报。根据真实页面和接口响应修正脚本后，对已保存的数据进行复核；保存、发布和评分写入本身均成功。没有因此修改产品代码。

## 证据文件

日志在 `.local-infra/verification-20261003/`：

- `dashboard-tests.log`、`api-tests.log`
- `db-setup.log`、`seed.log`
- `admin-workflow-result.log`、`learner-workflow.log`
- `layout-admin.log`、`layout-learner.log`、`pdf-reader.log`
- `real-publish.log`、`real-assessment.log`、`real-learner.log`
- `runtime.json` 和 API、页面服务日志

截图在 `output/playwright/verification-20261003/`：

- `admin-mobile.png`、`learner-mobile.png`
- `real-plan-saved.png`、`real-plan-published.png`
- `real-assessment.png`
- `real-learner-desktop.png`、`real-learner-mobile.png`

## 本次未覆盖

邀请邮件真实投递、外部存储上传和完整学习后的证书签发未做端到端验收。考试边界和部分失败状态使用接口模拟验证，不代表真实业务考试已经验收。

本地没有配置 Cloudflare 截图服务，组织分享图片请求出现 404 并走回退；浏览器还记录了内联事件的 CSP 拦截日志。上述日志没有阻断本次已验证的页面和操作。原本机数据恢复及生产发布不属于本次验证结果。
