---
name: 至臻企业培训平台
description: 河南至臻数字生活科技有限公司的中文企业培训界面
colors:
  primary: '#b45309'
  primary-foreground: '#ffffff'
  sidebar-accent-foreground: '#92400e'
  training-ground: '#f5f6f8'
  training-paper: '#ffffff'
  training-line: '#e8ebef'
  training-muted: '#626b78'
  training-accent: '#fff4e6'
  foreground: 'oklch(0.145 0 0)'
  secondary: 'oklch(0.967 0.001 286.375)'
  secondary-foreground: 'oklch(0.21 0.006 285.885)'
  input: 'oklch(0.922 0 0)'
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
rounded:
  panel: '10px'
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
    backgroundColor: '{colors.training-accent}'
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

这份文档记录当前已实现的培训界面。管理端沿用用户确认的 PlayEdu 参考：左侧管理导航、白色顶部栏和信息明确的表格。学员端使用顶部导航，以课程、培训任务和进度为主。企业名称为河南至臻数字生活科技有限公司，品牌图标沿用 `/enterprise-training-icon.png`。

公司图标的橙色是已确认的主色。白色内容面板与浅灰页面底色承载主要信息，橙色标识操作、选中位置和学习进度。中文优先，AI 功能默认隐藏。布局和交互继续使用现有 `@cio/ui` 组件。

**Key Characteristics:**

- 企业橙色、白色内容面板与浅灰背景。
- 管理端侧栏与表格，学员端顶部导航与课程进度。
- 中文信息层级、清晰焦点和可辨识的当前导航位置。
- 实际样式来源为 `src/training.css`；共享组件来源为 `../../packages/ui/src`。

## Colors

培训界面只有一个品牌强调色，配合中性表面；前置 token 记录默认浅色模式的实际值。

### Primary

- **企业深橙**（`primary`）：主要按钮、学员激活导航、进度条和培训界面的键盘焦点。
- **橙色浅底**（`training-accent`）：管理端激活导航、表格行悬停和无课程封面时的占位区域。
- **橙色深文字**（`sidebar-accent-foreground`）：浅橙色导航背景上的选中标签。
- **主操作白字**（`primary-foreground`）：主要按钮的文字。

### Neutral

- **页面浅灰**（`training-ground`）：页面底色和表头背景。
- **内容白色**（`training-paper`）：顶部栏、面板和表格。
- **细分隔灰**（`training-line`）：面板边框和学员顶部栏分隔线。
- **辅助文字灰**（`training-muted`）：副标题、品牌辅助文字和表头。
- **正文深色**（`foreground`）：沿用共享库正文语义色。
- **次操作中性灰**（`secondary`、`secondary-foreground`）与 **输入边框灰**（`input`）：沿用现有共享按钮和输入组件。

暗色模式沿用现有共享库切换。培训覆写中的主色为 `#fbbf24`、主色文字为 `#1c1917`，页面底色为 `#111113`，内容面板为 `#18181b`，分隔线为 `#303037`，辅助文字为 `#a1a1aa`，强调底色为 `#36291e`。这些是模式覆写，不是第二套品牌方向。

**The Brand Color Rule.** 公司橙色用于培训界面的主操作与导航状态；共享组件通过现有语义色变量接收品牌色。

## Typography

培训外壳的字体栈为微软雅黑、苹方与系统无衬线字体。共享组件继承培训外壳的字体，不新增展示字体。

### Hierarchy

- **Title**：页面标题，采用前置 `title` token；手机下调整为（22px）。
- **Body**：页面副标题采用前置 `body` token；其他正文保留共享组件本身的字号。
- **Label**：侧栏和学员导航采用前置 `label` token；选中项加粗为（600）。
- **Metric**：工作台统计数字采用前置 `metric` token；手机下调整为（26px）。表格与统计使用等宽数字排列。
- **品牌文字**：平台名称（17px、600），手机下（15px）；辅助名称（12px）。

## Layout

管理端采用共享可折叠侧栏：常规宽度（16rem）、图标模式（3rem）、手机抽屉（18rem）。顶部栏高（64px）。主要内容居中，最大宽度（1440px），左右留白采用 `page-inset`，底部留白（36px）。

学员端不使用管理侧栏，顶部栏保持粘滞定位。工具行最低高度（72px），导航行可水平滚动，激活项有底部线。工具栏和正文最大宽度（1256px），导航项间距采用 `navigation-gap`。

培训样式的手机断点为最大宽度（767px）。该范围内左右留白采用 `mobile-inset`，面板内距缩为（16px），统计区域改为两列，学员导航间距缩为（24px），顶部品牌辅助文字隐藏，用户菜单缩为（48px）。页面标题和操作区域允许换行。

表格单元格内距为（15px 16px），表头使用浅灰底。继续复用现有页面容器、表格和长页面的共享回到顶部控件。

## Elevation & Depth

培训定制面板以纯色层次和细边框区分层级；`training.css` 没有新增面板阴影。共享按钮和输入框仍保留其既有轻阴影、焦点环和状态过渡。不要把“培训面板无新增阴影”扩大为对共享弹层、菜单或控件的全局禁令。

### Shadow Vocabulary

- **共享按钮轻阴影**（`0 1px rgb(0 0 0 / 0.05)`）：现有 `shadow-2xs`，用于主要、次要和描边按钮。
- **共享输入轻阴影**（`0 1px 2px 0 rgb(0 0 0 / 0.05)`）：现有 `shadow-xs`，用于输入框。

共享控件默认状态过渡沿用当前安装的 Tailwind 主题（150ms，`cubic-bezier(0.4, 0, 0.2, 1)`）；培训定制样式没有新增动画令牌。

## Shapes

培训面板与品牌图标使用前置 `panel` 圆角。共享按钮、输入框和进度条继续使用共享库的 `md` 圆角；状态标签沿用共享库的完整圆角。面板边框为（1px），学员激活导航下划线为（2px）。

## Components

### Buttons

复用 `@cio/ui/base/button` 的现有变体和尺寸。主要操作使用品牌主色，次操作使用中性 `secondary`，取消或边界操作使用 `outline`。图标按钮沿用 `secondary`。默认尺寸参考前置 token；小尺寸及对话框按钮保留现有组件约定。

### Inputs / Fields

复用共享输入组件及应用已有字段封装，保留错误、禁用、占位文字和焦点状态。默认输入高度与内距见前置 token，手机文字与桌面文字继续采用组件已有响应规则。

### Cards / Containers

培训统计和任务面板使用 `training-panel`：白色表面、细边框和温和圆角。课程仍使用已有课程卡片；已有课程图片照常展示，无图片时使用浅橙色占位封面，不合成新的图片或装饰。

### Chips

使用现有 `Badge` 的 `default`、`secondary`、`outline` 及已有语义状态变体。状态不仅通过颜色区分，也保留文字标签。

### Navigation

管理导航使用共享侧栏的折叠和手机抽屉行为，激活项为浅橙底、深橙字与加粗标签。学员顶部导航以橙色文字及底部线标示当前位置。两类导航保留 `aria-current`。

### Tables / Progress

管理表格使用白底、浅灰表头和浅橙行悬停，不将所有表格替换为卡片。学习进度复用共享 `Progress`，橙色指示条置于主色的淡色轨道上；未知进度显示“—”，不伪造零进度。

培训外壳的键盘焦点为主色轮廓（2px），外移（3px）；共享控件自身的焦点环仍保留。

## Do's and Don'ts

### Do:

- **Do** 保留公司图标和已确认的企业橙色。
- **Do** 沿用管理端侧栏与表格、学员端顶部导航与课程进度的已实现结构。
- **Do** 优先使用中文翻译、现有共享组件和现有语义色变量。
- **Do** 保留当前导航标记、键盘焦点和文字状态标签。
- **Do** 用“—”表达未知业务数据。

### Don't:

- **Don't** 将这份扫描文档当作新的组件、配色或页面改版提案。
- **Don't** 新增未经确认的品牌颜色、字体或装饰组件。
- **Don't** 默认显示已要求隐藏的 AI 入口。
- **Don't** 用历史截图或本地展示数据证明生产上线或全量业务验收。
