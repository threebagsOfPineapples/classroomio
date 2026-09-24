# 现有模型到企业培训领域的映射

分类含义：**直接复用**保留现有表和行为；**扩展**沿既有对象增加企业字段/校验；**新增**补缺失的业务事实；**保留但不作为新核心**保留旧数据与可用功能，不在本次主链依赖它。源模型均见 `packages/db/src/schema.ts`，实现入口见 [当前架构](01-current-architecture.md)。

| ClassroomIO 实体/能力 | 企业含义与决策 | 分类 | 边界 |
| --- | --- | --- | --- |
| `organization` | 企业租户 | 直接复用 | `parentOrganizationId` 是工作区关系，不等同部门树。 |
| `user` + `profile` + `organizationmember` | 登录账号 + 个人资料 + 企业员工关系 | 扩展 | 工号、部门、岗位、在职状态属企业成员；一个账号可在多组织。 |
| `role`/组织成员角色 | 平台 ADMIN/TUTOR/STUDENT 基础角色 | 扩展 | 企业角色新增独立组织范围授权，不重解释现有角色 ID。 |
| `group`/`groupmember` | 课程成员容器与课程报名 | 直接复用 | 不是 Department，也不是计划 Enrollment。 |
| `course`/`course_section`/`lesson` | 课程/章节/课时 | 扩展 | 保留现有内容、发布、进度、合规和证书语义。 |
| `exercise`/`exercise_section`/`question`/`option` | 练习、题目与答案配置 | 扩展 | “考试”可由练习规则扩展，题库共享要另评估归属与版本。 |
| `submission`/`question_answer` | 作答尝试与逐题答案/原始分 | 直接复用并扩展考试策略 | 不把计划最终分数写回提交总分。 |
| `lesson_completion`/`lesson_video_progress` | 原始学习记录 | 直接复用 | 计划进度由这些记录与练习完成聚合。 |
| `course_completion_record` | 合规课程的周期完成记录 | 直接复用 | 不等于任意培训计划 Enrollment。 |
| `course.certificate`/`course_certificate_issue`/PDF 渲染 | 课程证书配置、合规证书实例与渲染 | 直接复用并扩展关联 | 计划结业证书需要单独发证规则/关联，不篡改旧证书。 |
| `cohort`/`cohort_course`/`cohort_member` | 培训班、执行项目 | 扩展 | 含成员、课程、目标及新闻流；与 TrainingPlan 有关联但不等价。 |
| `cohort_goal`/`cohort_goal_assignment` | 班级目标/个人目标 | 直接复用 | 可作为任务展示来源，不能替代计划发布时的固定名单与成绩结果。 |
| `program*` | 历史 Program | 保留但不作为新核心 | 代码标明 Cohort 为后继；迁移前不删除旧表/数据。 |
| Dashboard 学习/管理路由 | 员工学习页与培训管理页基础 | 扩展 | 保留旧 URL 兼容，逐步增加 `/learn`、`/admin`。 |
| AI Course Builder / Tutor / MCP | 课程生成、学习辅导、课程编辑集成 | 直接复用 | AI 评分是单独的建议/审核流程，放最后阶段。 |
| Course 价格、支付、公开营销页 | 企业自选课可用目录的一部分 | 保留但不作为新核心 | 内部入口不展示购买；先不删除字段或公开业务。 |

## 需要新增的事实

- `department` 与成员企业属性：组织树、员工岗位及部门负责人。
- `training_plan`、`training_plan_target`、`training_plan_course`、`training_enrollment`：计划、发布受众快照与个人培训任务。
- `assessment_scheme`、`assessment_item`、`training_score`、`training_score_detail`、`training_score_adjustment`：计划级权重、来源和可审计成绩。
- `instructor_score`：讲师对培训表现的分数；初版一项评分，未来可扩展 rubric。
- `training_evaluation`：员工对培训/课程/讲师的 1–5 分满意度和文字反馈，与成绩分离。
- 第一阶段可用现有记录查询生成培训档案、Training Matrix 和统计；证明查询成本超限后再建汇总表。通知先沿用现有邮件/作业机制并设计事件表，站内通知随确实需要的阶段实现。

## 不做一对一改名

`TrainingPlan ≠ Cohort ≠ Course`：计划定义目标、对象、时段与规则；Cohort 是实际班级；Course 是可复用内容。`Assessment ≠ Evaluation`：前者评员工，后者由员工评培训。`Score ≠ Satisfaction`。`Progress ≠ Result`：进度是行为完成度，通过结果还取决于考核规则。新表外键要指向实际主键：员工使用 `profile.id` / `organizationmember.id`，提交分数的原始来源使用 `submission.id`，不能假定 `submission.submittedBy = user.id`。
