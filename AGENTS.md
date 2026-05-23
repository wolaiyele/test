# 项目说明

## 项目概览
我是一个技术小白
这是一个基于 React 和 Vite 的待办事项提醒应用。应用运行在浏览器中，用户可以添加待办任务、设置提醒时间和优先级，并在任务到期后通过页面状态、浏览器通知和提示音进行提醒。

项目当前是前端单页应用，没有后端服务，也没有数据库。任务数据保存在浏览器的 `localStorage` 中。

## 技术栈

- 构建工具：Vite
- 前端框架：React 19
- 语言：JavaScript / JSX
- 样式：普通 CSS
- 代码检查：ESLint
- 包管理：npm，项目包含 `package-lock.json`

## 常用命令

- 安装依赖：`npm install`
- 启动开发服务器：`npm run dev`
- 构建生产版本：`npm run build`
- 本地预览构建结果：`npm run preview`
- 运行代码检查：`npm run lint`

## 目录结构

- `index.html`：Vite 入口 HTML，挂载 `#root`，加载 `src/main.jsx`。
- `src/main.jsx`：React 应用入口，使用 `createRoot` 渲染 `App`。
- `src/App.jsx`：应用核心逻辑和主要 JSX 结构。
- `src/App.css`：应用主体布局、表单、任务列表、响应式样式。
- `src/index.css`：全局 CSS 变量、基础排版和页面背景。
- `public/`：公共静态资源，例如 favicon 和图标。
- `src/assets/`：应用内资源，目前包含图片和 Vite/React 默认资源。
- `vite.config.js`：Vite 配置，启用 `@vitejs/plugin-react`。
- `eslint.config.js`：ESLint flat config，包含 JS 推荐规则、React Hooks 和 React Refresh 规则。

## 核心业务逻辑

核心状态都在 `src/App.jsx` 的 `App` 组件中管理：

- `tasks`：待办任务列表。
- `filter`：当前任务筛选条件。
- `form`：新增任务表单状态。
- `notificationState`：浏览器通知权限状态。
- `soundState`：提醒音频状态。

任务字段主要包括：

- `id`：使用 `crypto.randomUUID()` 生成。
- `title`：任务标题。
- `notes`：任务备注。
- `dueAt`：提醒时间，使用 `datetime-local` 兼容的字符串格式。
- `priority`：优先级，支持 `high`、`medium`、`low`。
- `done`：是否完成。
- `reminded`：是否已经提醒过。
- `dismissed`：是否已经停止提醒。
- `lastAlertAt`：最近一次提醒时间戳。
- `createdAt`：创建时间。

## 数据持久化

任务数据使用 `localStorage` 保存，键名是：

`todo-reminder.tasks.v1`

应用初始化时会读取该键，如果不存在则使用内置的 `seedTasks`。任务变化后会通过 `useEffect` 自动写回 `localStorage`。

## 提醒机制

应用每秒检查一次任务是否到期：

- 已完成任务不会提醒。
- 已停止提醒的任务不会继续提醒。
- 没有 `dueAt` 的任务不会提醒。
- 到期且未停止的任务状态为 `ringing`。
- 同一个任务默认至少间隔 10 秒才会再次触发提醒。

提醒触发后会：

- 如果声音已启用，调用 `playReminderSound()` 播放 Web Audio 合成提示音。
- 如果浏览器通知权限是 `granted`，创建浏览器通知。
- 更新任务的 `reminded` 和 `lastAlertAt`。

声音提醒需要用户先点击页面按钮启用，因为浏览器通常会限制未交互页面自动播放音频。

## 任务状态

`getTaskState(task)` 会返回以下状态：

- `done`：任务已完成。
- `open`：没有设置提醒时间。
- `ringing`：任务已到期且没有停止提醒。
- `overdue`：任务已到期，但已经被停止或忽略。
- `upcoming`：任务尚未到期。

任务列表会按完成状态和提醒时间排序，未完成任务优先，时间更早的任务靠前。

## 用户操作

当前界面支持：

- 新增任务。
- 填写备注。
- 设置提醒时间。
- 设置优先级。
- 按全部、即将、提醒中、完成筛选任务。
- 勾选任务为完成。
- 将任务延后 10 分钟。
- 停止正在提醒的任务。
- 删除任务。
- 请求浏览器通知权限。
- 启用或测试提醒声音。

## 样式和布局

应用采用卡片式工作台布局：

- 顶部是标题和提醒权限控制按钮。
- 中间是统计面板，显示全部、即将、提醒中等数量。
- 下方左侧是新增任务表单，右侧是任务列表。
- 宽屏时表单和列表左右排列。
- 小屏时切换为单列布局。

样式主要由 CSS 变量控制颜色、线条、阴影和背景。任务优先级通过不同颜色标签展示。

## 当前注意事项

- `src/App.jsx` 中有多处中文界面文本显示为乱码，像是编码转换后出现了 mojibake。后续修改文案时应注意文件编码，建议统一保存为 UTF-8。
- 项目没有自动化测试，目前主要依赖 `npm run build` 和 `npm run lint` 做基础验证。
- `dist/`、`node_modules/`、`.env*`、日志文件、覆盖率目录和 `tools/` 已在 `.gitignore` 中排除。
- 应用没有服务端同步能力，不同浏览器或设备之间不会共享任务数据。

## 给后续开发者的建议

- 修改提醒逻辑时，优先查看 `src/App.jsx` 中的 `playReminderSound()`、定时检查 `useEffect` 和 `getTaskState()`。
- 修改界面样式时，优先查看 `src/App.css`；全局主题变量在 `src/index.css`。
- 如果要加入新状态，请同步更新状态计算、统计面板、筛选器和任务卡片样式。
- 如果要修复乱码文案，建议一次性检查所有 JSX 文本、按钮文案、通知标题和默认任务内容。
- 提交前建议运行 `npm run build`，较大改动再运行 `npm run lint`。
