# 钉钉登录与员工信息接入

## 当前范围

已实现网页钉钉授权登录、本人账号绑定及员工信息读取。用户要求替换 Google 登录后，登录页与注册页统一显示钉钉登录入口；未启用时按钮禁用并提示使用邮箱和密码登录。“学员端 → 设置 → 集成”在后台未完整配置时仍隐藏绑定入口。Google 登录提供者与 Google 登录设置项已移除。没有新增数据库迁移，沿用员工记录的外部身份字段与认证临时记录表。

参考用户 GitHub 项目 [threebagsOfPineapples/boot](https://github.com/threebagsOfPineapples/boot) 中 `DingtalkAccountChoiceService` 的原账号绑定与受限授权原则。培训系统没有经核验的手机号字段，因此首次绑定要求先用原账号登录，不按姓名、工号或邮箱自动合并，也不静默创建新员工。

系统角色、部门归属、课程记录、成绩和证书保留。钉钉管理员、部门负责人身份不会自动变成培训管理员。已有账号先自行绑定；新员工可由系统管理员在“钉钉同步”中预览、确认导入，默认普通学员。

当前读取本人姓名、工号、职位、手机号、企业邮箱和钉钉部门编号；手机号、企业邮箱缺少授权或未填写时显示“—”。部门编号用于核对来源，不冒充培训系统的部门名称。资料实时读取，不自动覆盖培训系统档案，也不将钉钉登录当作邮箱验证。

已实现部门树和员工的手动批量同步：后台“组织 → 钉钉同步”，先读取预览，再选择员工并确认。多部门员工需选择主要部门；工号、邮箱冲突和停用账号会提示处理。按 CorpId + userid 更新已有绑定，保留权限及学习记录，不按姓名或邮箱自动合并。预览十分钟有效，确认使用事务，重复确认相同预览不重复导入。离职事件订阅和钉钉客户端免登尚未实现。

## 企业管理员准备

企业已经使用钉钉，还需要可调用接口的企业内部应用。可创建培训系统专用内部应用，或在确认用途、权限及回调配置后复用现有内部应用；无需重新注册企业。

1. 在 [钉钉开放平台](https://open-dev.dingtalk.com/) 选择本公司，创建或打开企业内部应用。
2. 记录 Corp ID、Client ID（AppKey）、Client Secret（AppSecret），确认属于同一企业及应用。当前网页登录不使用 Agent ID。
3. 配置网页登录回调地址，与下面 `DINGTALK_REDIRECT_URI` 完全一致。
4. 申请个人通讯录信息读取权限（`Contact.User.Read`）和成员信息读权限；需要手机号、企业邮箱时申请企业员工手机号信息、邮箱等个人信息权限。核对应用可见范围与通讯录读取范围覆盖测试员工。后续需要部门树和全员同步时，再申请部门信息读、部门成员读权限。
5. 完成平台要求的审批、发布或生效操作，先使用一名测试员工验证，确认后扩大范围。

应用授权与系统角色是两套权限：前者决定能读取哪些钉钉资料，后者决定员工能在培训系统执行哪些操作。权限清单及范围以开放平台当前页面为准。[官方扫码登录示例](https://github.com/open-dingtalk/h5app-out-login-demo)、[官方用户授权示例](https://github.com/open-dingtalk/h5app-auth-user-demo)、[阿里云通讯录授权说明](https://help.aliyun.com/zh/qwenwork/enterprise-ultimate-users-user-sync-dingtalk)。

## API 服务环境变量

密钥只填入 API 服务的私有环境配置，不放到浏览器、不提交 Git，也无需发送到聊天。

```dotenv
DINGTALK_ENABLED=true
DINGTALK_CORP_ID=企业CorpId
DINGTALK_CLIENT_ID=应用AppKey
DINGTALK_CLIENT_SECRET=应用AppSecret
DINGTALK_ORGANIZATION_ID=培训系统组织UUID
DASHBOARD_ORIGIN=https://培训系统域名
DINGTALK_REDIRECT_URI=https://培训系统域名/api/auth/dingtalk/callback
```

云代理部署也可使用 `/proxy/api/auth/dingtalk/callback`。回调地址必须与 `DASHBOARD_ORIGIN` 同源；支持 HTTPS，以及 localhost 和 RFC1918 内网 IPv4 的 HTTP。钉钉官方允许 HTTP/HTTPS 回调；公网入口应使用 HTTPS。内网 HTTP 不加密，只适合可信内网试用。[官方统一授权登录说明](https://open.dingtalk.com/document/orgapp-server/use-dingtalk-account-to-log-on-to-third-party-websites-1)。

当前 101 内网回调为 `http://10.60.6.101:3082/proxy/api/auth/dingtalk/callback`。复用既有应用时保留原回调，只追加培训回调。密钥仅注入 API 容器，部门读取使用 `qyapi_get_department_list`，部门成员读取使用 `qyapi_get_department_member`，逐部门分页去重，不额外读取员工手机号。[获取部门列表](https://open.dingtalk.com/document/orgapp/obtain-the-department-list-v2)、[获取部门用户详情](https://open.dingtalk.com/document/orgapp/queries-the-complete-information-of-a-department-user)。

`DINGTALK_ORGANIZATION_ID` 指培训系统数据库中的组织 UUID，不能填 Corp ID。当前为一个部署绑定一家企业，不支持多企业动态配置。设置完成后重启 API；关闭时设置 `DINGTALK_ENABLED=false` 并重启，登录按钮显示为暂未启用。

授权请求使用 `openid corpid`，通过一次性授权码取得所选企业身份，再以 unionId 读取该企业员工。服务端核对 Corp ID、员工身份、培训账号状态和绑定归属；令牌留在服务器端。[钉钉官方授权流程](https://open-dingtalk.github.io/developerpedia/docs/develop/permission/token/browser/get_user_app_token_browser/)。

## 首次绑定与验收

1. 员工使用原培训账号登录，五分钟内打开“学员端 → 设置 → 集成”，点击“绑定钉钉账号”。超过时限会提示重新登录。
2. 在钉钉授权页选择本公司组织；返回后确认“绑定成功”和本人资料。只在获得授权后显示资料，读取失败显示错误与重试。
3. 退出培训系统，再用登录页的“钉钉扫码登录”进入，核对账号、原角色、课程与成绩一致。
4. 用未绑定员工、其他企业身份、停用或离职账号验证拒绝进入；用已绑定其他员工的身份验证拒绝覆盖。
5. 刷新或重复访问授权回调，确认请求已失效且不会重复绑定或生成登录会话。
6. 缩小应用资料权限，确认未授权字段不被编造；资料接口失败时提示重试。重新扩大权限后核对真实姓名、工号、手机号、邮箱与部门编号。

## 复用 zz-boot 现有应用（2026-09-28）

已从 zz-boot 当前启用的 `sys_third_app_config` 读取同一应用的 Corp ID、AppKey 与 AppSecret，并保存到培训系统私有 `apps/api/.env`。文件已排除 Git，Windows 文件权限仅允许当前用户、SYSTEM 和管理员访问。没有修改 zz-boot 的数据库、应用配置或原回调地址。

真实应用令牌校验通过；使用一条既有员工绑定验证 unionId 到企业 userId 的映射和本人资料读取，均成功。姓名、职位、手机号及部门编号有值；测试员工的工号、企业邮箱为空。部门详情读取返回权限错误，因此本轮没有验证部门树读取或同步。

当前配置对应本地验收组织 `coursera-test`，回调为 `http://localhost:4173/api/auth/dingtalk/callback`。配置解析和校验通过，但 `DINGTALK_ENABLED=false`，登录入口保持禁用，等待管理员登记新回调。授权页返回 HTTP 200 不能证明回调已登记。

当前用户账号不是企业管理员。请由企业管理员或具有该应用管理权限的负责人，在钉钉开发者后台打开 zz-boot 使用的现有应用，在安全设置中新增上述重定向 URL，保留原有 zz-boot 回调。若平台不能保留多个回调，不要覆盖原地址，应创建培训专用应用并更新培训系统私有配置。

完成登记后，将私有配置中的 `DINGTALK_ENABLED` 改为 `true` 并重启 API，再按上述首次绑定与验收步骤验证真实扫码。正式部署时应改为实际培训域名与生产组织 UUID；本地验收组织不能直接作为生产配置。

网页扫码、首次绑定及扫码后重新登录尚未验收。既有模拟认证检查和上述真实接口验证均不能替代真实授权回调与账号权限验收。
