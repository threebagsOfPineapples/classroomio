---
name: 至臻企业培训平台
description: 河南至臻数字生活科技有限公司的中文企业培训界面 V2
colors:
  primary: '#bd4b00'
  primary-foreground: '#ffffff'
  sidebar: '#17243a'
  sidebar-foreground: '#d5deeb'
  sidebar-accent: '#2b3850'
  sidebar-accent-foreground: '#ffb449'
  training-ground: '#f3f5f8'
  training-paper: '#ffffff'
  training-line: '#e2e7ee'
  training-muted: '#617083'
  training-accent: '#fff5e8'
  foreground: '#202c3d'
  secondary: '#f0f3f7'
  secondary-foreground: '#28384c'
  input: '#d9e0e9'
  learner-next: '#19283d'
  learner-next-action: '#ffad49'
  learner-next-muted: '#b9c7d9'
  course-cover-self-paced: '#e6edf5'
  course-cover-self-paced-icon: '#4b6a93'
  course-cover-compliance: '#e6eeea'
  course-cover-compliance-icon: '#507667'
  course-cover-live-class: '#f6e8d9'
  course-cover-live-class-icon: '#955b2a'
  department-progress: '#7d95b1'
typography:
  title:
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: '24px'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '0'
  body:
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: '14px'
    lineHeight: 1.7
  label:
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: '14px'
  metric:
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: '30px'
    fontWeight: 600
    lineHeight: 1.2
  workbench-metric:
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: '32px'
    fontWeight: 600
  learner-next-title:
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: '26px'
    fontWeight: 600
  learner-next-label:
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: '18px'
    fontWeight: 600
rounded:
  panel: '12px'
  brand: '10px'
  course-media: '8px'
  md: 'calc(0.625rem - 2px)'
spacing:
  panel: '24px'
  page-inset: '28px'
  mobile-inset: '16px'
  navigation-gap: '32px'
  learner-grid-gap: '22px'
  learner-course-gap: '18px'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '36px'
  button-secondary:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.secondary-foreground}'
    rounded: '{rounded.md}'
    padding: '8px 16px'
    height: '36px'
  input:
    rounded: '{rounded.md}'
    height: '36px'
    padding: '4px 12px'
  training-panel:
    backgroundColor: '{colors.training-paper}'
    rounded: '{rounded.panel}'
    padding: '{spacing.panel}'
  learner-navigation-active:
    textColor: '{colors.primary}'
    typography: '{typography.label}'
    padding: '14px 0'
  admin-navigation-active:
    backgroundColor: '{colors.sidebar-accent}'
    textColor: '{colors.sidebar-accent-foreground}'
    typography: '{typography.label}'
  progress:
    backgroundColor: '{colors.primary}'
    rounded: '{rounded.md}'
    height: '8px'
  learner-next:
    backgroundColor: '{colors.learner-next}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.panel}'
    padding: '28px'
  course-cover:
    backgroundColor: '{colors.course-cover-self-paced}'
    textColor: '{colors.course-cover-self-paced-icon}'
    rounded: '{rounded.course-media}'
    height: '136px'
---

# Design System: 至臻企业培训平台

## Overview

**Creative North Star: "清晰的企业培训工作台"**

V2 沿用已确认的 PlayEdu 双端结构与企业橙色，分别突出下一步学习和管理待办。河南至臻数字生活科技有限公司的名称与图标由页面导航承载；学员首页的深蓝区域用于一项学习行动，个人四项指标回到白色面板。管理端保留深蓝侧栏、白色顶部栏和培训计划表格，四项指标分别成卡。

课程封面减少重复信息：真实照片保留，无图课程仅用实际课程类型的既有 Lucide 图标与中性底色，标题在卡片正文显示。课程默认查看待完成集合，并明确未开始、学习中和已完成。中文界面优先，作者原有英文内容保留，AI 默认隐藏；复用现有共享组件，没有新增框架、图表、假趋势或排行榜。

**Key Characteristics:**

- 橙色主操作、深蓝导航与学习行动区、冷灰背景、白色指标面板。
- 学员首页行动区与四项个人概览，课程区域与前置待办。
- 管理端四张独立指标卡、计划表、去重评分队列和部门进度。
- 无图封面仅显示实际课程类型图标，照片和占位媒体统一高度。
- 未知、真实零、加载、失败重试、空结果与权限不足分别呈现。

## Colors

前置 token 来自当前浅色源码，局部表面与控件覆写按使用位置记录。

### Primary

- **主操作深橙**（`primary`）：普通主要按钮、选中导航、学习进度与键盘焦点；配白字 `primary-foreground`。
- **学习行动橙**（`learner-next-action`）：深蓝下一步学习区域的按钮与进度，按钮使用 `learner-next` 墨字。
- **侧栏选中橙**（`sidebar-accent-foreground`）：深蓝侧栏选中项文字，背景为 `sidebar-accent`。
- **浅橙状态底**（`training-accent`）：筛选选中态、待办标签与表格行悬停。

### Neutral

- **侧栏深蓝**（`sidebar`）和 **侧栏浅字**（`sidebar-foreground`）：主题绑定在管理侧栏根组件，随手机抽屉 portal 一起保留。
- **页面冷灰**（`training-ground`）、**面板白色**（`training-paper`）与 **分隔线灰**（`training-line`）：页面层级、白色个人概览、管理指标卡和表格。
- **正文墨色**（`foreground`）、**辅助蓝灰**（`training-muted`）与 **次操作冷灰**（`secondary`、`secondary-foreground`）：正文、数字单位、表头与共享控件。
- **输入边框灰**（`input`）：共享输入与搜索字段。
- **学习行动深蓝**（`learner-next`）与 **行动辅助浅字**（`learner-next-muted`）：下一步学习区域；个人概览不使用此底色。
- **自主学习中性蓝灰**（`course-cover-self-paced`、`course-cover-self-paced-icon`）：SELF_PACED 类型封面与 User 图标。
- **合规课程中性灰绿**（`course-cover-compliance`、`course-cover-compliance-icon`）：COMPLIANCE 类型封面与 ShieldCheck 图标。
- **直播课程中性米灰**（`course-cover-live-class`、`course-cover-live-class-icon`）：LIVE_CLASS 类型封面与 CircleDot 图标。
- **部门进度蓝灰**（`department-progress`）：部门完成进度指示条，表达完成/分配记录，不表达能力排名。

暗色模式沿用既有切换。培训外壳主色（`#fbbf24`）、主色文字（`#1c1917`）、正文（`#edf1f7`）、页面（`#101a29`）、面板（`#192537`）、分隔线（`#334156`）、辅助文字（`#aab7c8`）、次操作（`#263448`）、输入边框（`#42516a`）和强调底色（`#36291e`）按现有覆写使用；默认无图封面暗色覆写为（`#263448`、`#b9c7d9`）。

**The Action Color Rule.** 深蓝区域承载下一步学习，个人统计使用白色面板；普通主要操作使用深橙白字，学习行动区使用其已有浅橙墨字覆写。

## Typography

培训外壳和共享 UI 字体变量均为微软雅黑、苹方与系统无衬线字体。作者提交的课程标题和内容保留原语言。

### Hierarchy

- **Title**：页面标题使用 `title`；手机下（22px）。
- **下一步学习模块标题**：使用 `learner-next-label`，是实际的（18px、600）标题；下面的真实课程标题使用 `learner-next-title`，手机下（23px）。
- **Body / Label**：页面副标题使用 `body`，导航使用 `label`；卡片说明、状态与单位保留既有小字号。
- **Metric**：个人概览沿用 `metric`，手机下（26px）；四张管理指标卡使用 `workbench-metric`，手机下（28px）。数字采用等宽排列，单位为（12px）。
- **管理表格**：表格正文（13px），表头（12px）；计划与评分模块标题按源码为（17px、600）。

## Layout

管理端保留侧栏与白色顶部栏。`/admin` 常规侧栏（14.5rem），组织管理路由仍用共享默认（16rem），图标模式（3rem），手机抽屉（18rem）。顶部栏（64px），主要内容最大宽度（1440px），左右留白使用 `page-inset`，底部（36px）。

学员内容、工具栏与顶部导航最大宽度（1344px），工具栏最低高度（76px）。顶部导航粘滞定位并允许局部水平滚动；日期仍与页面标题同处标题行，窄屏换行。

学员首页有两个横向布局区域，均为 `minmax(0, 1fr) 320px`，间距使用 `learner-grid-gap`。上区左侧是下一步学习，右侧是白色个人四项概览；下区左侧是课程，右侧依次是学习待办、近期培训与证书。小于（900px）时均改单列，下区次序为待办、课程、近期培训、证书。个人指标在这一中等宽度范围改为四列，手机下回到双列。

首页课程默认双列，间距使用 `learner-course-gap`；手机（767px 及以下）单列。每张课程卡及其列表包装撑满对应列，卡片内容区与说明可伸展，使底部行动对齐；媒体统一（136px），根圆角使用 `panel`，媒体圆角使用 `course-media`。

管理工作台上方四张独立指标卡采用四列和（16px）间距，手机改为双列。主区域为 `minmax(0, 1fr) 280px`，间距（20px）；左侧计划表与评分表，右侧部门进度和未完成培训。小于（1200px）主区域改单列、原右区双列；手机原右区也改单列。部门和员工管理表单沿用既有页面，不属于此次工作台重构。

手机左右留白使用 `mobile-inset`，普通面板内距（16px），学习行动区域内距（22px），课程工具栏纵向排列且搜索填满可用宽度。学习行动区域默认内距（28px）、最低高度（246px），小于（900px）最低高度（220px），辅助书本图标在小于（1200px）隐藏。表格滚动限制在自身容器，布局不依赖整页横向滚动。

## Elevation & Depth

深蓝行动区、白色面板与冷灰背景通过纯色与细边框区分层级；培训定制面板没有新增阴影。共享控件保留既有轻阴影和焦点环。

### Shadow Vocabulary

- **共享按钮轻阴影**（`0 1px rgb(0 0 0 / 0.05)`）：既有 `shadow-2xs`。
- **共享输入轻阴影**（`0 1px 2px 0 rgb(0 0 0 / 0.05)`）：既有 `shadow-xs`。

共享控件默认过渡沿用现有主题（150ms，`cubic-bezier(0.4, 0, 0.2, 1)`）。V2 未给筛选、搜索或任务新增装饰动画。

## Shapes

面板与课程根卡使用 `panel`，课程媒体与卡片行动描边使用 `course-media`，页头企业图标使用 `brand`。共享按钮、输入与进度保持 `md` 圆角；既有状态标签仍为完整圆角。无图媒体居中放置（64px、描边宽 1.2）的实际课程类型图标，不放公司标识、标题或编造口号。

## Components

### Buttons

复用共享 `Button`。主要学习行动始终由真实课程状态确定：学习中优先，随后未开始，最后已完成回顾；没有可靠近期活动时间时不称为“上次学习”。内容进度达到 100% 但既有完成条件尚未满足时，行动为“查看考核”，不将进度改写为合规通过。

卡片整体链接承载进入动作；普通学员卡片底部的行动是同一链接内的视觉标签，不嵌套另一个按钮。卡片行动高（32px）、左右内距（10px）、文字（12px）。

### Inputs / Fields

课程搜索复用共享 Search，标题按去除首尾空白、忽略大小写的关键词筛选。默认筛选为待完成，可切学习中、未开始、已完成和全部；每项数量来自对应真实集合。搜索无结果保留关键词，并提供清空搜索与查看全部；清空只恢复当前筛选，查看全部同时清空关键词并重置筛选。

### Cards / Containers

下一步学习为深蓝行动面板，展示真实课程、行动和内容进度，书本装饰沿用既有 Lucide。个人概览为白色面板，四项指标分别是待完成课程、已完成课程、平均成绩和实际学习时长，培训次数作为下方次级信息；少于一小时按分钟呈现，底层时长不变。

课程照片保留；无图封面由真实课程类型选择既有 User、ShieldCheck、CircleDot 等图标，未知类型使用已有 Globe 回退。标题仅在卡片正文显示。媒体高（136px）、标题区域最低高（48px）、说明最低高（42px）；悬停边框（`#abb8c9`）。媒体高度仍在 `@layer utilities` 覆写共享重要样式；图标保留 `custom` 与当前颜色，避免全局 SVG 规则覆盖类型色。

### Chips / Navigation

继续使用共享 Badge 和文字状态。课程、计划与评分队列筛选使用已有按钮，其选中状态通过 `aria-pressed` 和浅橙底表示。管理侧栏根组件保留深蓝主题和当前项橙字；学员顶部导航仍以深橙与底部线标记当前项。中文外观入口与现有模式切换保持不变。

### Tables / Progress

管理工作台指标、计划列表、评分队列、部门进度各自对应真实数据来源。计划表显示周期、状态、完成/分配记录和操作；评分总数按 submission ID 去重，作业与简答题分类允许交集，评分入口仍检查 `canGrade`。缺失或非法提交时间显示“—”。

部门区域表达完成进度与分配基数，不自动排序为能力排名，不生成趋势线。课程卡片轨道为分隔线灰，行动区指示条使用局部行动橙，部门指示条使用部门进度蓝灰。

### Tasks / Feedback States

首页考试展示根据考试时间窗口、最新提交和只读 GET 访问检查确定状态，入口为“查看考试”；不保证剩余次数可用，不调用开始考试。未知资格保留重试，近期培训与考试请求失败按当前模块显示失败，不伪装为空待办。

真实零保留为 0，未知或未返回值使用“—”；加载、请求失败及重试、无记录、无搜索匹配和无权限独立呈现。AI 隐藏，既有第三方反馈 SDK 默认悬浮入口仍关闭，不作为公司新组件。

本文记录当前实现与视觉规则，不将本地测试、构建或原型确认写成生产验收，也不声称全局类型检查通过。

## Do's and Don'ts

### Do:

- **Do** 让深蓝行动区突出一项真实下一步学习，个人四项指标使用白色面板。
- **Do** 保留课程默认待完成和状态对应行动；100% 内容进度与合规完成分开。
- **Do** 保留真实照片，无图时仅用实际类型图标与中性底色。
- **Do** 保留去重评分总数、权限判断、部门完成/分配基数和独立失败重试。
- **Do** 让小于 900px 的首页待办排在课程前，手机课程单列、指标双列。

### Don't:

- **Don't** 恢复标题与公司 Logo 叠加的课程无图封面或旧高度。
- **Don't** 把已完成课程继续标为继续学习，或将内容进度直接等同培训结业。
- **Don't** 在首页开始考试，或仅凭时间窗口声称考试次数和资格可用。
- **Don't** 将未知、失败或无权限呈现为真实零，也不编造趋势与能力排名。
- **Don't** 将原型或尚未完成的复验描述成生产上线或全量业务验收。

## 管理端业务导航（2026-09-28）

管理端按组织管理、培训管理、培训结果分组，共八个主入口；媒体资源与标签放入课程页的二级导航。员工页的主要操作为导入员工，导入流程返回员工管理。工作台、课程与资源页沿用同一侧栏宽度和顶部栏。自部署版隐藏上游产品反馈、更新与帮助入口，培训班退出主菜单。

参考 PlayEdu 开源管理端的业务分组与页面操作组织，继续使用本项目 Svelte 组件、中文字体及既有企业配色；不引入新的后台框架。
