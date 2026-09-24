# 企业角色与数据范围设计

现有 `ROLE.ADMIN/TUTOR/STUDENT` 属于组织/课程/Cohort 成员关系；Better Auth 的 `user.role` 是平台账号级能力。企业角色通过组织成员 ID 挂载，不能直接把六个角色塞进一个全局 `user.role`。保留旧 API 权限和 URL，新增企业 API 在后端检查角色、资源组织、部门范围与本人范围；前端菜单仅做体验过滤。证据：`packages/utils/src/constants/roles.ts`、`packages/db/src/auth.ts`、`apps/api/src/middlewares/org-admin.ts`、`course-team-member.ts`、`cohort-team-member.ts`。

| 角色 | 计划/组织操作 | 可读数据范围 |
| --- | --- | --- |
| SUPER_ADMIN | 企业角色授权、组织配置、全部培训管理 | 所属企业全部，不能越租户 |
| TRAINING_ADMIN | 计划、课程、对象、考试/评分、档案与统计 | 所属企业全部 |
| HR | 员工/部门、培训分配和档案，按企业策略可创建计划 | 所属企业全部；调分、发布方案需单独权限 |
| DEPARTMENT_MANAGER | 查看本部门及子部门任务、进度、成绩；可提需求/审批或发起部门计划（初版只读管理） | 负责人覆盖的部门树；跨部门员工需按当前成员归属与历史快照规则分别处理 |
| INSTRUCTOR | 管理被授权课程/班级的教学、作业批改和讲师评分 | 分配给自己的课程、Cohort 或计划学员；不能读取全企业档案 |
| EMPLOYEE | 查看并完成自己的培训、考试、成绩、档案、评价 | 本人的 `organizationmember.id`、相关计划/课程公开内容 |

初版动作权限建议：`plan.read/create/update/publish/assign`、`course.manage`、`assessment.manage/publish`、`score.read/grade/adjust`、`employee.read/manage`、`report.read`、`role.grant`。同一个用户可有多个角色，取权限并集，但数据行范围仍由每个权限的组织/部门/资源关系收紧。既有 ADMIN 映射 SUPER_ADMIN 仅在对应组织内生效；TUTOR 不自动成为全企业 INSTRUCTOR，须按其课程/Cohort 关系或显式授权；STUDENT 对应 EMPLOYEE 自身访问。

## API 检查顺序

1. Better Auth 会话确认身份；从路径/资源解析可信 `organizationId`，核验当前 `organizationmember` 存在且 ACTIVE，不能只信客户端头和传入的部门 ID。
2. 读取当前企业角色；先验证动作，再构造作用范围谓词（`organization_id`、本人 member ID、部门含子部门集合或讲师资源 ID）。查询、列表、导出、详情和统计使用同一范围。无权限返回 403，资源跨租户按现有 API 约定返回 404/403，避免泄露存在性。
3. 写入时再校验引用对象属于同企业；PlanCourse、TrainingTarget、AssessmentItem、Cohort 关联不能接受跨组织 ID。评分还要校验讲师确实负责目标班级/课程，人工调分必须记录操作者和原因。
4. 学员考试入口需要本人 Enrollment 或有效的课程成员资格，提交时从会话解析 `groupmember`，绝不使用请求体的 `userId` 直接写成绩。

## 关键测试

覆盖同组织跨部门、部门及子部门、其他组织、离职/停用成员、讲师仅有课程权限、员工访问他人详情/导出、管理员跨组织 ID 伪造，以及成绩册列表/详情一致。现有 `apps/api/src/services/mark/gradebook.ts` 的学生本人过滤可作参考，但新计划成绩查询要独立验证。
