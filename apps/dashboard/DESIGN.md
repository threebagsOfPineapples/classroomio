---
name: 至臻企业培训平台
description: 河南至臻数字生活科技有限公司的中文企业培训界面
colors:
  primary: '#bd4b00'
  primary-foreground: '#ffffff'
  training-brand: '#f59a18'
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
  learner-overview: '#202e44'
  learner-overview-foreground: '#f7f9fc'
  learner-overview-muted: '#bfccdc'
  course-cover: '#eaf0f6'
  course-cover-foreground: '#293b53'
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
  overview-metric:
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: '28px'
    fontWeight: 600
    lineHeight: 1.2
  course-cover-title:
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif"
    fontSize: '23px'
    fontWeight: 600
    lineHeight: 1.4
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
---

# Design System: 至臻企业培训平台

## Overview

**Creative North Star: "清晰的企业培训工作台"**

这份文档记录现有 PlayEdu 参考结构的配色和密度强化。河南至臻数字生活科技有限公司的企业图标与橙色品牌保持一致，管理端使用墨色侧栏、白色顶部栏与任务表格，学员端使用白色顶部导航、墨色学习概览和冷灰课程封面。页面底色与内容面板通过冷灰、白色和细边框建立层次。

首屏承载管理任务或学员学习概览与课程。用户从侧栏或顶部导航进入课程、培训和档案；课程查询随输入实时过滤，清空即恢复列表。中文优先，AI 默认隐藏，控件继续沿用现有共享库；这次强化没有引入新的图片、图标组件或装饰动画。

**Key Characteristics:**

- 墨色导航与学习概览、冷灰页面、白色面板、公司品牌橙色。
- 管理端任务表格与学员端学习指标、课程卡片。
- 真实课程标题与公司标识组成无图封面，已有课程照片保留。
- 桌面与手机沿用同一主题，手机指标双列、课程单列。
- 实际样式来源为 `src/training.css`，共享组件沿用 `../../packages/ui/src`。

## Colors

前置 token 记录最终源码中的默认浅色配色。企业品牌橙和白字主操作深橙各自承担已实现的角色。

### Primary

- **主操作深橙**（`primary`）：普通主要按钮、学员选中导航、进度指示条与培训外壳键盘焦点；文字使用 `primary-foreground`。
- **企业品牌橙**（`training-brand`）：课程无图封面顶部细线，以及学习概览中的继续学习按钮。
- **导航选中橙**（`sidebar-accent-foreground`）：墨色管理侧栏选中项文字；底色使用 `sidebar-accent`。
- **浅橙提示底**（`training-accent`）：表格行悬停及培训正文选择状态。

### Neutral

- **管理侧栏墨色**（`sidebar`）与 **侧栏浅灰字**（`sidebar-foreground`）：由侧栏根组件自身携带，在手机抽屉移入 portal 后仍保持配色。
- **页面冷灰**（`training-ground`）、**内容白色**（`training-paper`）与 **细分隔灰**（`training-line`）：页面、顶部栏、面板和表格层级。
- **正文墨色**（`foreground`）与 **辅助蓝灰**（`training-muted`）：正文、表头、副标题和日期。
- **次操作冷灰**（`secondary`、`secondary-foreground`）与 **输入边框灰**（`input`）：共享控件的培训外壳覆写。
- **学习概览墨色**（`learner-overview`）、**概览浅白字**（`learner-overview-foreground`）与 **概览次级字**（`learner-overview-muted`）：学员概览面板；统计数字为纯白，继续学习按钮为品牌橙底与侧栏墨色文字。
- **课程封面冷灰**（`course-cover`）与 **封面墨字**（`course-cover-foreground`）：没有真实图片时的公司标识与真实课程标题。

暗色模式仍沿用现有模式切换。培训外壳覆写为主色（`#fbbf24`）、主色文字（`#1c1917`）、正文（`#edf1f7`）、页面（`#101a29`）、面板（`#192537`）、分隔线（`#334156`）、辅助文字（`#aab7c8`）、次操作（`#263448`）、输入边框（`#42516a`）和强调底色（`#36291e`）。管理侧栏与学习概览保留自己的墨色表面。

**The Brand Color Rule.** 普通主要操作使用深橙与白字；学习概览中的继续学习使用品牌橙与墨字；管理选中项使用墨色底与橙色文字。

## Typography

培训外壳和共享 UI 的字体变量均使用微软雅黑、苹方与系统无衬线字体。没有新增展示字体。

### Hierarchy

- **Title**：页面标题采用前置 `title` token；手机下（22px）。
- **Body**：副标题采用前置 `body` token；其他正文保留共享组件的既有字号。
- **Label**：侧栏和学员导航采用前置 `label` token；选中项字重（600）。
- **Metric**：管理统计使用 `metric`，学员概览使用 `overview-metric`；手机下均为（26px），数字沿用等宽排列。
- **Course cover title**：使用 `course-cover-title`，绑定真实完整标题字段，以两行裁切控制高度。
- **品牌与日期**：平台名称（17px、600），手机下（15px）；顶部品牌辅助名称（12px）、封面品牌（11px）、学员日期（13px）。

## Layout

`/admin` 的管理侧栏明确覆写常规宽度为（14.5rem）；组织管理路由保留共享默认（16rem）。图标模式（3rem）和手机抽屉（18rem）沿用共享库。两类管理侧栏都在根组件绑定企业侧栏主题。管理顶部栏高（64px），内容居中最大宽度（1440px），左右留白使用 `page-inset`，底部（36px）。

学员顶部栏粘滞定位，工具行最低高度（76px），工具栏与正文最大宽度（1256px）。导航行可水平滚动，间距使用 `navigation-gap`；当前项有底部线。日期与页面标题同处标题行，置于标题内容右侧，窄屏允许换行。页面标题区域上下内距为（26px 20px）。

课程网格填满可用宽度，默认单列、中等屏两列、宽屏三列，卡片不再受共享库的固定最大宽度限制。每张卡片媒体区固定（164px），根圆角使用 `panel`，媒体圆角使用 `course-media`。真实照片继续覆盖媒体区；无图封面用公司标识与真实课程标题，内距（20px 20px 38px），顶部品牌橙线（3px）。

最大宽度（767px）时，左右留白采用 `mobile-inset`，面板内距（16px），统计双列，课程保持单列，导航间距（24px），品牌辅助名称隐藏，用户菜单缩为（48px）。桌面（1440px）与手机（390px）沿用同一配色；横向滚动只属于导航或表格等局部容器，不扩展为整页溢出。

表格单元格内距仍为（15px 16px），表头冷灰底。长页面复用已有回到顶部控件。

## Elevation & Depth

墨色侧栏、墨色概览、白色面板与冷灰页面通过色块和细边框建立深度；培训定制面板不新增阴影。共享控件保留既有轻阴影与焦点环。

### Shadow Vocabulary

- **共享按钮轻阴影**（`0 1px rgb(0 0 0 / 0.05)`）：既有 `shadow-2xs`。
- **共享输入轻阴影**（`0 1px 2px 0 rgb(0 0 0 / 0.05)`）：既有 `shadow-xs`。

共享控件默认过渡沿用当前安装的 Tailwind 主题（150ms，`cubic-bezier(0.4, 0, 0.2, 1)`）；课程查询没有新增动画。

## Shapes

培训面板和课程卡片使用 `panel` 圆角，课程媒体使用 `course-media`，企业顶部图标使用 `brand`，封面小图标圆角（6px）。按钮、输入与进度条继续使用共享库 `md` 圆角，状态标签沿用完整圆角。普通面板细边框（1px）；学习概览取消外边框，内部指标分隔线保留；学员选中导航底部线（2px）。

## Components

### Buttons

复用共享 `Button` 变体。普通主要操作为深橙白字，学习概览继续学习为品牌橙墨字，次操作为冷灰。课程卡片内按钮高（32px）、左右内距（10px）、文字（12px）。图标按钮沿用 `secondary`，其图标来自已有组件库。

### Inputs / Fields

共享输入框保留现有错误、禁用、占位与焦点状态。课程查询绑定页面查询值，按去除首尾空白并忽略大小写的课程标题实时筛选；清空输入恢复原列表，未引入新的搜索框组件。

### Cards / Containers

普通培训面板为白色细边框。学员学习概览为墨色面板，姓名与指标使用浅白及纯白，次级说明使用浅蓝灰，内距（22px 24px），手机沿用面板内距覆写。真实成绩、培训次数与学习时长来自已有接口，加载、错误或缺失值按实现显示“—”。

课程卡片保留真实封面图片。无图封面绑定完整课程标题和公司标识，不用截取两个字代替标题。根卡片填满网格列；媒体高（164px），标题区域最低高（48px），描述区域最低高（42px），悬停边框为（`#abb8c9`）。媒体高度在 `@layer utilities` 中覆写共享重要样式，这个来源约束需要在复用时保留。

### Chips

使用既有 `Badge` 变体和文字状态。课程类型、完成与未开始状态继续使用现有标签，不新增图标或状态类型。

### Navigation

管理侧栏根组件携带墨色主题，选中项墨蓝底、橙色字、字重（600）；菜单最低高度（44px）。`EnterpriseSidebar` 和共享 `OrgSidebar` 使用相同企业侧栏类，手机抽屉迁移后主题仍在。学员默认导航为辅助蓝灰，当前项和悬停为深橙；两类导航保留 `aria-current`。

账号外观入口使用中文标签与可访问名称，选中模式通过 `aria-pressed` 标记，并显示主色轮廓（1px）。

### Tables / Progress

管理表格白底、冷灰表头、浅橙行悬停。共享进度条的橙色指示条保留，课程卡片内轨道改用分隔线灰；其他进度条仍保留自己的现有变体。

培训外壳键盘焦点为主色轮廓（2px），外移（3px）。第三方反馈 SDK 的默认悬浮入口与 whispers 已关闭，受信 CSS 域用于已有 SDK；它不是公司新增功能，也不组成设计系统组件。

## Do's and Don'ts

### Do:

- **Do** 保留墨色侧栏、冷灰表面、白色面板与公司品牌橙的现有分工。
- **Do** 在管理侧栏根组件保留主题，使手机 portal 中的导航继续使用同一配色。
- **Do** 保留真实课程图片；无图时使用公司标识和真实完整标题。
- **Do** 保留课程实时过滤、清空恢复与真实学习指标。
- **Do** 在桌面与手机保留同一主题，并使用手机双列指标、单列课程。

### Don't:

- **Don't** 将这次配色强化变成新的概念、动画、图片或图标组件提案。
- **Don't** 恢复大号两字课程封面或卡片固定窄宽度。
- **Don't** 默认显示 AI 入口或第三方 SDK 默认悬浮入口。
- **Don't** 将第三方 SDK 的配置与受信 CSS 域处理描述成公司新功能。
