# 数据库迁移与兼容策略

当前 schema 由 `packages/db/src/schema.ts` 定义，Drizzle 配置在 `packages/db/drizzle.config.ts`，SQL 与 `_journal.json` 在 `packages/db/src/migrations/`；`packages/db/package.json` 提供 `db:generate`、`db:migrate`、`db:setup`。本 Phase 0 **没有生成或执行 migration**。旧库中已有课程、提交、证书、Program/Cohort 数据均需保持可读。

## 分阶段实施

1. **迁移前盘点**：在隔离备份库统计 `organization`/`profile`/`organizationmember`、`groupmember`、`cohort*`/`program*`、提交、证书数量与孤儿关系；确认 `migrate-programs-to-cohorts` 是否在目标环境运行过。做备份和恢复演练，保存迁移前后计数。
2. **Phase 1 扩张**：只新增 department、成员企业属性、企业角色关联及索引；可空字段先上线。对现有 `organizationmember` 按组织管理员映射业务管理角色，对普通 ACTIVE 成员映射 EMPLOYEE；工号/部门等未知历史值保持 null，不能猜。完成读写双兼容后再逐步加必填约束。
3. **Phase 2**：课程扩展只加真正缺失字段/索引。课程封面沿 `logo`/`bannerImage`，分类优先用 tag；避免重复列和不必要回填。历史 `isPublished/status/type` 语义不变。
4. **Phase 3**：新增 Plan、PlanCourse、Target、Enrollment 及 Cohort 可空关联。旧 Cohort 一律不自动变计划；确需关联时做经确认的映射表或人工迁移。现有课程组员不从计划推断为已完成任务。发布流程先在隔离库验证名单快照和幂等。
5. **Phase 5–7**：考试规则为现有 Exercise 加兼容字段；评分/评价新增独立表。旧 `submission.total` 仅是题分，不伪造综合成绩；历史培训需要导入时只创建有可追溯来源的结果，否则标为待确认。
6. **Phase 8–9**：档案/Matrix/统计先查询源数据，确认性能瓶颈后再加汇总表或并发索引。Phase 10 的 AI 建议独立于最终成绩表。

## Drizzle 与发布门槛

- 根 `AGENTS.md` 要求**一个 PR 只有一个 migration 文件**。各 Phase 用独立 PR 时各有一份；同 PR 内后续 schema 修改折入该文件，避免多份迁移顺序错乱。新 migration 的 `_journal.json` `when` 必须大于合并时 `main` 的全部条目；文件序号也要随主干末尾递增。当前基线最后条目是 `0020_lesson_slides`，但合并前必须重新对 `origin/main` 检查，不能固定认为下一个永远是 0021。
- 项目记录的是迁移高水位；旧 `_journal.json` 中存在早期条目时间顺序异常，不能简单按文件名排序推断执行状态。对现有环境先查询 `drizzle.__drizzle_migrations`，并检查实际表/列；新迁移时间戳须严格递增。执行 `db:generate` 后人工审查 SQL、snapshot 和 journal，不把 `db:push` 当生产部署机制。
- 每次迁移先在生产数据副本试跑，核对行数、约束、索引、耗时和回滚方案；部署时先兼容性加列/加表，应用代码后再收紧约束。大表索引或回填分批、限流，避免长锁。已执行的迁移不改写；根据项目规则在尚未合并/部署的 PR 内折叠修改。
- 每张新业务表都有组织归属或能通过不可变父级追溯到组织；跨组织外键关系在写入服务显式拒绝。对 `(plan, employee)`、`(plan, course)`、`(goal, member)` 等加唯一约束，保障重试和并发。
- 回滚默认回退应用到兼容版本，保留新增表/列和旧数据；除非有经验证的逆迁移，绝不直接 DROP 历史表。价格、公开课程、旧 Program、课程提交、证书字段仍可读取。

## 验证矩阵

| 验证 | 通过标准 |
| --- | --- |
| 空库重放 | 全部 migration 顺序通过，schema 与生成快照一致。 |
| 旧库升级 | 原组织、课程、Cohort、Program、进度、提交、证书计数不减少且旧页面可读。 |
| 数据隔离 | 组织 A 的部门/员工/计划/分数不能引用或读取组织 B 的 ID。 |
| 发布重试 | 相同计划重复发布不产生重复 Enrollment/组员；失败可重试，名单版本可追踪。 |
| 历史兼容 | 旧课程与未关联计划的 Cohort 正常显示；未迁移成绩显示“未评定”，不写 0。 |

本阶段输出的是策略和字段设计；未连接生产库，也未证明真实数据符合这些约束。
