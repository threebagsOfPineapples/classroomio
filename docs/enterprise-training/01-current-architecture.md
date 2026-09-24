# ClassroomIO 当前架构审计

审计基线：上游 `classroomio/classroomio`，提交 `1b986d2d6874383b36078cf2b200c544b27ebfb7`（2026-09-22）。本阶段只做静态源码审计；没有连接数据库、启动服务或验证真实业务流程。下文的“已有”指代码能力，不等于当前部署已启用。

## 1. 应用、工作区与调用链

这是 pnpm 10 + Turborepo monorepo。`pnpm-workspace.yaml` 纳入 `apps/*`、`packages/*` 和 `packages/course-app/src/*`；`turbo.json` 定义构建依赖。当前 `apps` 下有 `api`、`dashboard`、`jobs`、`website`、`docs`、`help`、`help-cms`、`embeds`、`tenant-router`、`course-app`。业务主链是 SvelteKit `apps/dashboard` → Hono `apps/api` → `packages/db` 的 Drizzle ORM → PostgreSQL；BullMQ/Redis 承担异步任务。共享包包括 `core`、`utils`、`ui`、`question-types`、`certificates`、`ai-assistant`、`analytics`、`mcp` 等。参见根目录 `README.md`、`package.json`、`pnpm-workspace.yaml`、`turbo.json`、`apps/api/src/app.ts`。

`apps/api/src/app.ts` 挂载 `/course`、`/cohort`、`/organization`、`/dash`、`/agent`、`/public-api/v1` 等路由；后者当前注册 audience/courses。课程与成员类功能主要使用 route → service → `packages/db/src/queries`。登录使用 Better Auth + Drizzle adapter，`packages/db/src/auth.ts` 将组织角色映射加入会话。`packages/mcp/src/index.ts` 是独立 stdio MCP 服务，当前重点是课程草稿/课程编辑工具；不能当作企业培训领域 API。

## 2. 现有数据模型与实际行为

| 问题 | 审计结论及源码 |
| --- | --- |
| User / Organization | `user` 是 Better Auth 账号；`profile.id` 外键指向 `user.id`，业务姓名、语言等在 `profile`；`organizationmember` 保存组织、profile、角色与状态。一个人可关联多个组织。`group` 是课程的成员容器，不是企业部门。`packages/db/src/schema.ts:97,415,322,1314,1957,2193`。 |
| Course / Lesson | `course.groupId` 关联课程成员组；课程有发布开关、类型（SELF_PACED/LIVE_CLASS/COMPLIANCE/PUBLIC）、价格/支付等历史字段、证书/合规 JSON。`course_section` 分章节；`lesson` 属于课程，可关联章节、视频、文档、文本、教师和完成策略。`schema.ts:309,662,1002`。 |
| Cohort | `cohort` 是组织下的培训群组/班级，`cohort_course` 连课程，`cohort_member` 连学习者/讲师，目标和每人目标分配分别在 `cohort_goal`、`cohort_goal_assignment`。加学员会将其加入组织和课程成员组。没有年度计划、审批/发布生命周期或部门/岗位规则。`schema.ts:3191-3510`；`apps/api/src/services/cohort/cohort.ts:224-328`。 |
| Program | 旧 `program*` 表仍在 schema，源码明确 Cohort 为其后继；有迁移脚本 `packages/db/src/scripts/migrate-programs-to-cohorts.ts`。不要把旧 Program 再作为新培训计划。`schema.ts:2918-3191`。 |
| Exercise / Question / Submission | `exercise` 属于课程/章节，旧 `lessonId` 已标记废弃；`question` 属于 exercise，题型在 `question_type`；`question_answer` 连题目、课程成员和提交；`submission.submittedBy` 指 `groupmember.id`，不是 `user.id`。`schema.ts:598,1243,2047-2155`。题型已有 RADIO、CHECKBOX、TRUE_FALSE、SHORT_ANSWER、FILE_UPLOAD 等，不能按需求文档假定仅四类。 |
| Grading | 客观题在 `packages/question-types/src/question-scoring.ts` 计算；提交服务仅在整份练习可自动批改时直接写分，否则进入人工/混合流程。题分在 `question_answer.point`，提交总分在 `submission.total`，成绩册按课程展示练习分数并区分讲师与学生查看范围。没有独立的跨课程 AssessmentScheme / ScoreDetail / 调分审计。`apps/api/src/services/submission/submission.ts:547-714`、`apps/api/src/services/mark/gradebook.ts`。 |
| Progress | `lesson_completion`、`lesson_video_progress`、练习提交是源记录；课程进度由完成课时数与练习数计算，`course_completion_record` 另存合规周期、截止、成绩和时间。不能用培训计划百分比替换这些源记录。`schema.ts:814-868,1610-1674`、`apps/api/src/utils/course-completion.ts`。 |
| Certificate | `course.certificate` 为配置；普通课程可标记 `groupmember.certificateEarnedAt`，下载端可生成 PDF/PNG；合规课程另有 `course_certificate_issue`，关联完成周期和有效期。这不是统一的“培训计划证书”。`schema.ts:762-791,896-933,1328`、`apps/api/src/services/course/completion.ts`、`apps/api/src/routes/course/course.ts:503-566`。 |

## 3. 权限、界面、AI 与集成

现有业务角色只有 `ADMIN=1`、`TUTOR=2`、`STUDENT=3`，分别在组织、课程、Cohort 成员关系中使用；Better Auth 的 `user.role` 又是另一层账号级角色。API 有 `org-admin`、`org-team-member`、`course-team-member`、`cohort-team-member` 等中间件，成绩册服务会把学生结果缩为本人。它还没有 HR、部门经理等企业数据范围。见 `packages/utils/src/constants/roles.ts`、`apps/api/src/middlewares/`、`apps/api/src/services/mark/gradebook.ts`。

同一个 SvelteKit dashboard 通过路由和组织角色提供管理与学习体验：管理路由如 `/org/[slug]/dash`、`/org/[slug]/audience`、课程与 Cohort 页面；学习路由如 `/lms`、`/lms/mylearning`、`/lms/exercises`、`/lms/certificates`、公开课程 `/courses`。尚无需求拟定的 `/admin`、`/learn` 两个独立入口。见 `apps/dashboard/src/routes/(app)/` 与 `(org-site)/`。已有图表组件在 `packages/ui`/dashboard analytics 中，可复用。

AI 课程助手/生成在 `apps/api/src/routes/agent`、`apps/api/src/services/agent`、`packages/core/src/services/agent`；课时 Tutor 在 `/course/.../ai-tutor`；`packages/ai-assistant/src/providers/index.ts` 已统一接 OpenAI、Anthropic、Google、Moonshot 模型。尚无培训综合成绩 AI 评分审批链。`packages/mcp` 的当前入口仅注册课程草稿工具。公开 API 有 automation key/scope；BullMQ 包预留 webhooks 队列，但本次抽查未发现可直接复用的完整培训事件订阅模型，实施前应再逐项核实。

## 4. 与需求假设的主要差异

1. ClassroomIO 当前已自称企业 LMS，Cohort/合规截止与目标分配已存在；“从学校平台转企业平台”不是从零改造。
2. `User`、`Profile`、`organizationmember` 分层，员工字段应按组织成员维度设计，避免把部门/工号错误写在全局 `user` 上。
3. Cohort 是执行班级，TrainingPlan 是管理计划；现有 Program 是 Cohort 前身，不能简单改名。
4. 现有 Grading/Certificate 以课程为单位，综合成绩、满意度与计划证书仍是新领域。
5. `course.isPublished`、`course.status`、`course_import_draft.status` 各有含义，不能另加一个字段后忽略既有发布逻辑。
6. 根 `LICENSE` 是 AGPL-3.0 文本，但根 `package.json` 的 `license` 为 MIT、API 包为 ISC；发布前需做许可证清单核对，不能只凭一个元数据字段判断授权。

## 5. 审计证据边界

已阅读根配置、schema/migration、身份与组织、课程/Cohort、题目/提交/评分、进度/证书、API、dashboard 路由、AI 与 MCP 的关键实现。未逐行审计整个仓库，也未运行服务、数据库迁移、lint/typecheck/build；Phase 1 前须做针对性运行验证和现有数据基线盘点。
