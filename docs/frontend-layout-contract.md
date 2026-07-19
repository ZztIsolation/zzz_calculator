# 前端布局契约

本文档定义 Vue 界面的防截断约束。目标不是让所有内容保持单行，而是保证业务文字和控件在真实可用宽度内完整、可操作地呈现。

## 共享布局类

- `ui-layout-scope` 或 `data-layout-surface` 建立 `inline-size` 容器。弹窗、抽屉、主从面板和嵌套编辑器必须按这个容器响应。
- `ui-master-detail` 提供 `280-340px + 剩余空间` 的主从布局；容器不足 760px 时自动堆叠。
- `ui-field-grid` 使用 `repeat(auto-fit, minmax(min(100%, 144px), 1fr))`。`ui-field-grid--comfortable` 将基础宽度提高到 180px。
- `ui-field--wide` 占两个可用轨道，`ui-field--full` 占满整行；窄容器下不得生成隐式溢出轨道。
- `ui-field`、`data-layout-field`、`metric`、`maintenance-field`、`custom-field` 和 `compact-field` 统一继承字段收缩、标签换行及 Naive UI 控件宽度规则。

## 内容规则

- 表单标签、当前值、校验错误、状态提示和命令按钮不得使用隐藏裁切来维持单行。
- 中文标签可以自然换行；不可分割的长文本使用 `overflow-wrap: anywhere`。
- 输入框、数值步进器和选择器必须保持在所属字段边界内，字段本身必须设置 `min-width: 0`。
- 表格、图表和导航条可以在明确的局部容器内滚动，但不能把横向溢出传递到页面或弹窗外层。
- 密集列表可以使用省略号，但必须通过 `title` 或 tooltip 提供完整名称；省略号不得用于表单标签或关键结果。

## 断点选择

页面顶栏、整页工作台列数等真正由浏览器宽度决定的结构可以继续使用 `@media`。弹窗、抽屉、卡片、侧栏和维护编辑器内部必须使用 `@container` 或内容驱动网格，不能根据 viewport 猜测自身宽度。

## 自动验收

运行 `npm run test:layout`。Playwright 会构建应用并启动本地服务，在桌面、125% 缩放桌面和移动端检查：

- 页面与 `data-layout-surface` 没有意外横向滚动；
- `data-layout-field` 及维护字段没有越过最近的受保护容器；
- 直接字段标签的 `scrollWidth/scrollHeight` 没有超过可见尺寸；
- Naive UI 输入、数值和选择控件没有越过字段边界；
- 事件管理中的 `已流逝秒数` 在普通和长中文压力文案下都完整显示。

新增复杂表单时，应给最外层添加 `data-layout-surface`，给关键字段添加 `data-layout-field`，并把对应真实交互加入 `webapp/e2e/layout.e2e.ts`。
