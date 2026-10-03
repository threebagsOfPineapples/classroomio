# 中文界面与视觉整理

## 本次范围

按用户要求移除语言选择，管理端、学习端和移动菜单统一中文；浏览器页签、导航与空头像使用本地企业标识或语义图标。保留组织上传的标识与课程封面。

延续已确认的白色与橙色视觉：品牌色 `#E85A0C`、操作色 `#B8460A`、正文 `#1A1A1A`、辅助文字 `#666666`、边框 `#E0E0E0`、页面背景 `#F5F5F5`。使用系统中文无衬线字体，实际浏览器核对为微软雅黑。

## 设计与实现

- 导航图标保持统一尺寸、继承所在控件颜色，隐藏装饰图标的英文屏读名称。
- 页面工具栏保持 56 像素高度，表单与菜单继承中文字体，键盘焦点清晰可见。
- 课程列表优先显示课程标题，收窄空标签列；手机端将操作移至独立行，日期完整显示。
- 课程侧栏文字保持单行，新增内容操作与导航链接分开。
- 手机课程目录保持三列紧凑统计，标题与刷新按钮同排。
- Windows 搜索快捷键提示为 `Ctrl K`，苹果设备为 `⌘ K`。
- 已安装用户指定的 Uizze `ui-taste` 项目技能，参考其中 polish 与 craft 指导；不引入付费服务。

## 验证

### 构建与静态检查

- 使用 Node `20.19.3`，dashboard 依赖构建和 dashboard 构建通过。
- 本次变更文件的格式检查与 `git diff --check` 通过。
- 中文语言初始化测试 7 项、企业标识测试 6 项通过。
- 11 个字典各 5153 条 ICU 文案的语法与占位符检查通过。
- 共享 Search 的 `ui:` 前缀检查通过，并补充 Storybook 的空值、填值、中文标签等状态。

### 实际浏览器

- 管理端与员工端检查桌面 1440 像素、手机 390 像素视口。
- 管理工作台、课程列表、个人设置、课程壳、课程预览与学习首页均无语言选择入口或页面横向溢出。
- 模拟旧英文 cookie 与 localStorage，员工页面刷新后恢复 `zh`，页面语言为 `zh-CN`。
- 个人设置没有可见破图，姓名、用户名、邮箱均关联中文标签。
- 浏览器页签使用橙色 Z 标识，新 PNG 与兼容 favicon 均可访问。
- 课程菜单通过 Enter 打开、Escape 关闭并返回焦点；课程标题保留正确链接。
- 搜索输入名为“搜索课程”，输入后清除按钮显示“清除搜索”，清除后列表恢复。
- 手机创建课程按钮名为“创建课程”。组织权限加载完成后，创建按钮可用、9 行课程均显示学员进度。
- 手机课程目录标题宽 271 像素、高 30.8 像素，标题与刷新同排，三项统计同排；第一课从原先约 604 像素提前至 374 像素，无嵌套按钮。
- 无封面自主学习课程使用书本图标。员工有效时长检查前后均为 `07:02 / 422 秒`；未进入课时、计时或保存表单。
- 公司介绍 PDF 与 PPTX 资源均返回 HTTP 200。

首轮实际截图发现的手机标题竖排、刷新嵌套按钮问题已经修复并复测。最终移动侧栏弹层的文字色为 `#B8460A`、选中背景为 `#FFF4EB`，9 个菜单行均为 44 像素；中文关闭按钮与 Escape 正常，无横向溢出、嵌套按钮或装饰图标英文读名。

最终运行版本：`apps/dashboard/.local-infra/release-20261003-172257/build`。本地页面端口为 4174，API 为 3003，课件资源为 4175；继续使用独立测试数据库 `enterprise_training_verification_20261003`。验收专属浏览器已全部关闭，本地服务保留运行。

### 验收资料

- `output/playwright/visual-polish-20261003/after-courses-desktop.png`
- `output/playwright/visual-polish-20261003/after-courses-phone.png`
- `output/playwright/visual-polish-20261003/after-course-preview-phone.png`
- `output/playwright/visual-polish-20261003/after-learner-home-desktop.png`
- `output/playwright/visual-polish-20261003/final-course-mobile-menu.png`
- `.local-infra/verification-20261003/visual-targeted-final-admin-result.json`
- `.local-infra/verification-20261003/visual-final-desktop-settled-result.json`
- `.local-infra/verification-20261003/visual-targeted-final-employee-result.json`
- `.local-infra/verification-20261003/employee-chinese-readonly-result.json`
- `.local-infra/verification-20261003/visual-final-portal-result.json`
