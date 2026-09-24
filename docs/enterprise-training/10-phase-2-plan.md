# Phase 2 企业课程实施清单

基线为 Phase 1 提交 `5e22aa297`。本阶段沿用 `course`、`course_section`、`lesson`、课程成员和标签；不另建课程、章节、课时或讲师表。

## 复用与扩展

- 分类使用组织内现有 tag/tag group；封面使用 `logo` 和 `banner_image`；课程简介使用 `description`；讲师使用课程 TUTOR 成员及课时 `teacher_id`。
- 课时保留现有视频、文档、图文、幻灯片和练习内容。外部链接使用课时已有内容/链接能力，不增加一套平行课时类型。
- `is_published=false` 为草稿，`is_published=true` 且 `status=ACTIVE` 为已发布；`status=ARCHIVED` 为归档。历史 `ACTIVE` 课程及公开课程保持原行为。
- `course` 增加可空难度、标称学时（分钟）、学分、目标人群和必修标识。标称学时不充当实际学习时长；必修标识不自动生成培训任务，分配由 Phase 3 负责。

## 实施与验收

1. 一份兼容 migration 增加字段和范围约束，不回填历史课程为“零学时”或“非必修”。
2. 扩展现有课程更新校验、设置页和组织课程筛选；旧课程创建和编辑路径保持可用。
3. 对课程归档、发布可见性、字段边界和组织权限做针对性验证；运行格式、lint、类型、API 与 dashboard 构建，并在隔离库跑迁移。

本阶段在独立分支上新增一份迁移，后续 PR 以 Phase 1 分支为基线，使每个 PR 只有一份迁移。

## 本地验证

- Node 20 下 API 依赖与 API 构建、dashboard 依赖与生产构建通过；utils 测试 126 项通过。
- 隔离 PostgreSQL 16 中 23 份 migration 全部执行，确认新增五列和三项约束；新 journal 时间戳高于当前 `origin/main`。
- 自动翻译服务返回 401/429，新增文案已人工补齐现有九种语言并核对键名；未进行浏览器业务验收和生产部署。
