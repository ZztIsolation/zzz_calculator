# 长期回归契约

本文档记录 Vue、共享核心、Node 服务和静态发布必须长期保持的用户语义。界面布局与内部实现可以演进，但以下数据、计算、持久化和兼容入口不得静默改变。

## 架构边界

- `core/` 只承载可跨平台复用的计算、规范化、校验和优化搜索逻辑，不直接依赖 DOM、浏览器存储或 Node 文件系统。
- `webapp/src/runtime/` 提供 catalog、IndexedDB/localStorage、扫描器桥接和浏览器 Worker 等平台适配。
- `backend/` 提供 Node API、文件存储适配和静态产物服务；同一业务规则不得在后端和浏览器各维护一份。
- 浏览器重优化默认在本地 Worker 中运行；公开部署不得把用户仓库上传到共享服务端执行重计算。

## 选择、计算与 Buff

- 默认角色来自可展示 catalog；合法的旧选择应尽力恢复。角色切换后，推荐音擎、核心技、影画、默认循环和默认 Buff 必须按新角色重新解析。
- 音擎改装等级和角色影画等级必须夹紧到合法范围；没有核心技等级的角色允许使用 `none`。
- 计算支持单事件直伤、贯穿、异常、紊乱、自定义事件和角色 `defaultCalculationConfig`；影画变体使用不超过当前影画的最高已配置等级。
- 目标的防御、等级系数、失衡倍率和各元素抗性相互独立；切换结算属性不得覆盖其他属性输入。
- 默认 Buff、影画 Buff、用户手动取消项和 runtime 输入分别保存。Buff 弹窗只编辑草稿，确认后才应用，取消必须无副作用。
- 角色、音擎和 Buff 来源已有图片时必须显示真实资源；所有 catalog `/assets/...` 引用必须在构建时验证存在。

## 驱动盘、账号与本地数据

- 账号、当前账号、驱动盘、导入记录和套装预设继续使用既有 IndexedDB `zzz-calculator-user-store` 与 localStorage fallback `zzz-calculator.userStore.v1`，不迁移存储结构或键名。
- 旧构建选择键 `zzz-calculator.homeSelection.v1` 继续用于尽力恢复；新版自己的状态键不得破坏旧数据。
- 驱动盘仓库始终按当前账号隔离；手动 1-6 号位、套装预设和优化结果互不复制或串改底层驱动盘。
- 扫描器导入必须先展示差异；“同步删除缺失盘”只能在确认流程中显式启用。删除驱动盘、套装和账号必须展示影响范围，当前账号不可直接删除。
- 扫描器本地/云客户端选择、Helper 连接、包准备进度、取消和导入结果必须保留；扫描 payload 与 manifest 由自动化测试锁定。

## 优化器

- 默认算法为 `exact-super-bound`，公开算法名、输入输出、进度和取消数据结构保持兼容。
- Node 适配器保留 `worker_threads` 并行；浏览器适配器保留 Worker、事件循环让步和准备阶段进度。
- 状态机必须区分准备、运行、取消中、已取消、完成和错误；进入取消中后不得保留可重复点击的取消操作。
- 固定 fixture、Node 并行、浏览器 Worker、进度、取消及 160-seed fuzz 必须保持通过。

## 维护功能

- 维护页覆盖角色、角色技能、音擎、驱动盘套装、异常/紊乱、队友 Buff、场地 Buff 和 Boss Buff 八类资源；`systemBuffs` 不在导航中显示。
- 异常资料读取 `anomalyEffects.effects` 并按 `settlementType` 区分异常和紊乱；队友 Buff 保存时保持“队友 ID + Buff ID”双层结构。
- 八类资源均支持新增、复制、编辑、校验、保存、删除、删除确认、未保存离开提示和本地草稿恢复。
- 保存或删除成功后必须重新获取完整 `/api/maintenance/catalog`，不得用单文件响应覆盖组合 catalog。
- 写请求成功但完整目录刷新失败时，界面必须保留“已经写入”的身份，重试只能重新 GET 目录，不得重复 POST/DELETE；保存、删除期间禁止重复提交。
- catalog 文件的 read-modify-write 必须串行执行，并通过同目录临时文件原子替换；两个并发维护请求不得互相覆盖。
- 服务默认只监听 `127.0.0.1`。维护写入拒绝非 allowlist 的跨源 Origin，并覆盖 DNS rebinding 场景；公开域名必须通过 `MAINTENANCE_ALLOWED_ORIGINS` 明确授权。
- 维护关闭时 `/maintenance` 与 `/maintenance.html` 返回 404、维护 API 返回 403、导航隐藏入口；开启时 `/maintenance` 提供 Vue 页面，`/maintenance.html` 以 308 跳转到 `/maintenance`。

## 路由与发布

- SPA 正式路由为 `/`、`/discs` 和 `/accounts`；`/calculate.html`、`/drive-discs.html`、`/accounts.html` 继续跳转到对应 Vue 路由。
- Node 只服务 Vue 构建产物，不回退到旧静态前端。缺少产物时，开发服务必须给出明确构建提示。
- 非法 URL 百分号编码必须返回 400，不能终止服务进程；路径只允许解码一次。
- Pages 默认不生成维护页面，也不复制维护专用脚本或样式；部署工作流只由 `main` 更新触发。
- `dist/`、`output/`、`downloads/`、日志和本地用户数据不进入 Git；`examples/`、业务数据、源代码和回归测试必须保留。

## 发布前验收

- `npm test`
- `npm --prefix webapp run test`
- `npm --prefix webapp run build`
- `npm run build:pages`
- 干净 checkout 后重新安装依赖、运行测试并构建。
- 桌面与移动端冒烟覆盖：计算、Buff 草稿、优化取消、仓库导入、扫描器、账号切换和维护开关。
- 检查 Pages SPA 路由、兼容跳转、catalog/config、scanner manifest、静态资源、包大小与 SHA-256。
