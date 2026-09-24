# 目标架构与业务流

沿用现有 SvelteKit dashboard、Hono API、Drizzle/PostgreSQL、BullMQ/Redis、Better Auth 与共享包；不新建第二套框架。新企业功能按现有 route → service → query/DB 的层次放到 `apps/api/src/routes`、`apps/api/src/services`、`packages/db/src/queries`，输入验证放 `packages/utils/src/validation`，前端放 dashboard 的企业 feature 目录。真正编码前遵守根 `AGENTS.md` 的代码规范。

## 领域边界

```text
Organization ─ Department ─ OrganizationMember/Profile
      │
      ├─ Course ─ Section ─ Lesson/Exercise ─ Question ─ Submission
      │                                      └─ 原始进度/题分/证书
      ├─ TrainingPlan ─ PlanCourse ─ Course
      │       ├─ PlanTarget ─ 发布时解析为 TrainingEnrollment
      │       ├─ AssessmentScheme ─ AssessmentItem
      │       └─ 可选 Cohort（具体培训班）
      └─ Cohort ─ CohortMember/Goal/Assignment

TrainingEnrollment ─ Score/ScoreDetail/Adjustment ─ 培训结果
TrainingEnrollment ─ TrainingEvaluation（满意度；独立记录）
```

计划与班级是一对多可选关系：一个季度计划可分不同批次的 Cohort；不需要班级活动时直接给员工分配计划。计划课程与班级课程都指向同一 `course`；关联班级时服务端校验其课程属于计划，避免两套课程清单无声漂移。历史 Cohort 可以不关联计划，照常运行。计划发布是一个受控事务：校验组织/课程/评分方案与权重，按部门（含子部门规则固定）、岗位、指定人员求并集，去重，记录目标版本和受众快照，创建唯一 `(plan_id, organization_member_id)` 任务；对必要课程复用既有组员加入逻辑。重试幂等、部分失败可见；后续员工调岗不回写原快照，补录/撤销另走审计操作。

学习、考试仍走既有课程链。培训进度按计划课程对应的课时完成与符合完成策略的练习提交聚合；可缓存结果但源记录仍可追溯。综合评分只读取已完成且有效的来源分：`submission`、讲师评分、出勤和进度等 → 按评分项满分归一到百分制 → 权重求和 → 人工调分 → 最终结果。缺一项必需成绩时保持 `PENDING`，不把缺失当 0；发布规则冻结版本，避免改规则重算历史。建议示例 `92×0.4 + 85×0.3 + 88×0.2 + 100×0.1 = 89.9`，通过线 80 即 PASS。具体舍入和补考取分策略在 Phase 6 落库前确定，并写边界测试。

培训档案、Matrix 和 Dashboard 第一版从计划任务/成绩/学习记录/证书/评价查询。指标统一分母：完成率以已分配且未取消任务为基数，通过率以已出结果的人数为基数；待评分、缺数据是独立状态，不显示零分。高数据量再做汇总或索引优化。搜索先用 PostgreSQL，课程沿现有标签和公开范围过滤；内部目录禁用支付入口。

## 兼容与非目标

新增 `/admin`、`/learn` 可先做受权限保护的入口布局并复用现有管理/学习组件，旧 `/org/[slug]`、`/lms` 与公开课程 URL 不改写或强制迁移。对同一数据只有一条写入链，避免两个入口分别实现发布/评分。原 Course Builder、Tutor、合规课、证书、API/MCP 保持可用；AI 打分仅在 Phase 10 接建议分与讲师审核，不允许无审核写最终成绩。SCORM/xAPI、积分排行、多渠道通知与付费商城改造都不在 Phase 1 主链。

## 可复用、扩展、暂不使用

- 直接保留：认证、组织/课程/班级成员关系，章节课时，题型和基础评分，学习源记录，课程证书、课程分析、AI Builder/Tutor、既有图表与后台作业。
- 扩展：组织成员企业属性、课程分类与学习时长、Cohort 可选计划关联、练习考试策略、管理/学习页面、授权范围与培训查询。
- 不用于新核心：旧 `program*` 作为计划、`group` 作为部门、`submission.total` 作为最终培训成绩、`course.metadata.reviews` 作为正式培训评价、价格/支付作为内部课程入口。
