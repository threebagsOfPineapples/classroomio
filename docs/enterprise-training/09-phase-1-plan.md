# Phase 1 实施清单

基线：`feature/enterprise-training` 的 Phase 0 文档；本阶段仅改企业组织能力。现有 `organizationmember` 是组织内人员关系（含 ADMIN/TUTOR/STUDENT），`/organization/audience` 只列 STUDENT。新员工列表从组织成员取数，不改变旧 audience 行为。

## 交付

1. 用一份 Drizzle migration 添加 `department`、组织成员的工号/部门/岗位/上级/在职状态/入职日/外部来源 ID，以及组织成员的企业角色关联。新增字段先可空，旧成员不推断部门、工号或在职状态。
2. 新 `/enterprise` API：读取本人企业上下文，按权限读取/维护部门；按本人或部门范围列员工、读员工详情；管理员/HR 更新员工属性；超级管理员授权企业角色。所有读写显式带组织作用域，部门父级、负责人和员工引用必须同组织且有效；拒绝部门循环。
3. 同一 SvelteKit dashboard 增加 `/admin` 组织页，用现有组件模式提供部门管理、员工查询/编辑和角色授权。旧 `/org/[slug]`、`/lms` 入口与 API 不改。图标使用用户给定的 PNG，接入新入口的标识和 favicon。
4. 针对部门循环、跨组织引用、部门负责人作用域、本人可读与越权写入写回归检查；执行格式、测试、lint、typecheck 和匹配的 build。若本机没有可用数据库，明确区分编译验证与数据库迁移实测。

## 权限初版

旧组织 ADMIN 自动拥有 SUPER_ADMIN 能力，仅在其所属组织内。显式企业角色存多对多关系；TRAINING_ADMIN/HR 可管理部门与员工属性，DEPARTMENT_MANAGER 只读自己负责部门及子部门，INSTRUCTOR/EMPLOYEE 仅能读本人企业资料。只有 SUPER_ADMIN 可授予/撤销企业角色。所有路由从已认证的 profile ID 重新查询 ACTIVE 组织成员，不单独信任客户端提交的 member ID 或仅依赖会话缓存。

## 数据与兼容门槛

工号按组织内非空值唯一；部门编码按组织唯一；外部来源 + 外部 ID 在组织内唯一。软停用部门前确认没有在职成员和有效子部门。历史 `user`、`profile`、课程组、班级和提交主键不变。新 API 不把任何组织的用户数据泄露给其他组织。

## 当前验证状态

- PostgreSQL 16 隔离实例从空库执行全部 22 个 migration 成功；新表、成员扩展字段和跨组织外键约束已核对。
- Node 20 下 API 依赖与 API 构建通过；企业权限 6 个针对性测试通过。新增管理页及触及的组件通过 Svelte 编译和针对性 ESLint；10 个 dashboard 语言文件均包含新增的 35 个文案键。
- Dashboard 依赖构建和 Node 20 标准构建通过。此前本机虚拟内存不足导致的构建失败，在资源恢复后重试成功。
