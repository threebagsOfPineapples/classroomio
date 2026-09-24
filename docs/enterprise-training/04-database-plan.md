# 目标数据库模型（设计稿，尚未迁移）

依据 `packages/db/src/schema.ts` 的 PostgreSQL/Drizzle 结构。新业务主键采用 UUID；引用现有 `organizationmember.id` 时使用 bigint；时间用现有 `timestamptz` 习惯。写操作总要按 `organization_id` 过滤，并在服务端校验外键对象属同一组织。第一步先做兼容增量，不改旧表主键、不重建现有课程或成绩。下表是目标字段与约束，Phase 1 开始前逐表化为 Drizzle schema 和符合仓库 PR 规则的迁移。

## 组织与课程

| 对象 | 字段与约束 | 说明 |
| --- | --- | --- |
| `department` 新表 | `id`, `organization_id`, `parent_id?`, `name`, `code`, `leader_member_id?`, `sort`, `status`, `created_at`, `updated_at`；`UNIQUE(organization_id, code)`；parent/leader 必须同组织；禁止父级循环 | 部门树的根是企业，不复用 `organization.parentOrganizationId` 或 `group`。 |
| `organizationmember` 扩展 | `employee_no?`, `department_id?`, `position?`, `manager_member_id?`, `employment_status`, `join_date?`, `external_source?`, `external_id?`；组织内非空工号唯一；外部 ID 建议 `(organization_id, external_source, external_id)` 唯一，先不把不同 HR 源混为一个全局键 | `profile`/`user` 可能跨企业；岗位初版为文本，若需字典或多岗位再建表。 |
| `organization_member_business_role` 新表 | `organization_id`, `organization_member_id`, `role_code`, `created_at`, `created_by`，复合唯一；角色为 SUPER_ADMIN / TRAINING_ADMIN / HR / DEPARTMENT_MANAGER / INSTRUCTOR / EMPLOYEE | 与现有 ADMIN/TUTOR/STUDENT 并行；必须保留原成员权限。可从既有 org admin 映射初始化管理员。 |
| `course` 兼容扩展 | `difficulty?`, `learning_minutes?`, `credit?`, `instructor_profile_id?`, `target_audience?`, `required?`；已有 `type`, `logo`, `description`, `is_published`, `status`, `metadata.instructor`, `tag` 先复用 | 分类可先用现有 tag/tag_group；如业务必须单选层级分类，届时新增 `course_category` 和 `category_id`。不要平行增加 `cover`/`summary`/`courseType`。 |

## 计划、班级与固定分配

| 对象 | 字段与约束 | 说明 |
| --- | --- | --- |
| `training_plan` | `id`, `organization_id`, `name`, `code`, `description?`, `year`, `plan_type`, `owner_member_id`, `department_id?`, `start_at`, `end_at`, `status`, `assessment_scheme_id?`, `pass_score?`, `published_at?`, `published_by?`, `created_by`, `created_at`, `updated_at`, `version`；`UNIQUE(organization_id, code)`；`end_at >= start_at` | 状态 DRAFT/PUBLISHED/IN_PROGRESS/COMPLETED/CANCELLED；计划规则发布后冻结或版本化。 |
| `training_plan_course` | `id`, `plan_id`, `course_id`, `sort`, `required`, `due_at?`；`UNIQUE(plan_id, course_id)` | 校验课程与计划同企业；排序/必修在关联上。 |
| `training_plan_target` | `id`, `plan_id`, `target_type` (DEPARTMENT/POSITION/USER), `target_id` 或明确的 `department_id`/`position`/`organization_member_id`, `include_descendants`, `created_at`；同目标去重 | 异质 `target_id` 无数据库 FK，优先选三个可校验列加 CHECK 恰有一项；岗位文本按企业内成员岗位匹配。 |
| `cohort` 扩展 | `training_plan_id?`，索引 | 仅表示具体班次归属；历史 Cohort 保持 null。若允许一班跨计划，改用关联表前要有实际案例。 |
| `training_enrollment` | `id`, `organization_id`, `plan_id`, `organization_member_id` (bigint), `status`, `result`, `assigned_at`, `started_at?`, `completed_at?`, `progress_percent?`, `final_score?`, `assignment_source`, `matched_target_ids`, `plan_version`, `cancel_reason?`, `created_at`, `updated_at`；`UNIQUE(plan_id, organization_member_id)`；按成员/状态/到期索引 | 发布时物化员工集合并保存命中的目标 ID；`progress_percent/final_score` 是可重算缓存，源数据仍在 lesson/submission/score 表。历史不因调岗重写。 |

## 考核、成绩与评价

| 对象 | 字段与约束 | 说明 |
| --- | --- | --- |
| `assessment_scheme` | `id`, `organization_id`, `name`, `description?`, `pass_score`, `total_score=100`, `status`, `version`, `created_at`, `updated_at` | 草稿可编辑；发布时所有 `assessment_item.weight` 相加必须 100%，由事务校验，之后冻结。 |
| `assessment_item` | `id`, `scheme_id`, `type` (EXAM/ASSIGNMENT/INSTRUCTOR/ATTENDANCE/PROGRESS/CUSTOM), `name`, `weight`（整数基点或定精度数）, `max_score`, `required`, `sort`, `source_rule?` | 多个同类型项可共存；来源规则须明确课程、练习/讲师评分与取分策略。 |
| `instructor_score` | `id`, `enrollment_id`, `assessment_item_id`, `instructor_member_id`, `raw_score`, `max_score`, `note?`, `created_at`, `updated_at`；初版每报名记录、评分项一项当前有效评分 | 评分人与被评分人都受计划/Cohort 授权；未来维度 rubric 再扩展。 |
| `training_score` | `id`, `enrollment_id`, `scheme_id`, `scheme_version`, `raw_calculated_score`, `manual_adjustment`, `final_score`, `result`, `calculated_at`, `version`；`UNIQUE(enrollment_id)` | 统一 0–100 分，结果 PASS/FAIL/PENDING/MAKEUP_REQUIRED。缺必需来源时保持 PENDING 和 nullable final score。 |
| `training_score_detail` | `id`, `score_id`, `calculation_version`, `assessment_item_id`, `source_type`, `source_id?`, `raw_score?`, `max_score`, `normalized_score?`, `weight`, `weighted_score?`, `source_version?`, `status`；`UNIQUE(score_id, calculation_version, assessment_item_id)` | 保存每项快照与来源，能追溯到 submission 等；重算增加版本而非覆盖旧明细。 |
| `training_score_adjustment` | `id`, `score_id`, `delta`, `reason`, `adjusted_by_member_id`, `adjusted_at`, `before_score`, `after_score` | 仅追加；最终分可由基础分和调整记录复核。审计不可通过编辑原始提交绕过。 |
| `training_evaluation` | `id`, `enrollment_id`, `organization_member_id`, `course_content_rating`, `instructor_rating`, `usefulness_rating`, `difficulty_rating`, `satisfaction_rating`（各 1–5）, `most_helpful?`, `improvements?`, `suggestions?`, `created_at`, `updated_at`；`UNIQUE(enrollment_id, organization_member_id)` | 学员评价培训质量，不参与员工成绩；若要逐课程评价，另加 `course_id` 与相应唯一约束。 |

## 派生数据与未来扩展

培训档案和 Training Matrix 初版通过 `training_enrollment`、`training_score`、`course_completion_record`、`course_certificate_issue` 与学习源记录查询，不先建重复的 `employee_training_archive`。站内通知在出现真实事件消费方时建 `training_notification`（收件人、事件、业务主键、已读时间、唯一幂等键）；不做一个空的多渠道 Provider 层。AI 评分只在 Phase 10 设计 `ai_score_suggestion`，包含模型/版本、建议分、维度、反馈、置信度、审核人/结论，不能直接写 `training_score.final_score`。

所有跨表的组织一致性、方案冻结、评分权重和受众去重需由服务层事务与针对性测试保证；可由 DB 表达的唯一性、取值、非负、0–100、1–5 范围用约束兜底。计划发布/补录/重算/调分的事件需要操作者和时间，避免只有最终状态。
