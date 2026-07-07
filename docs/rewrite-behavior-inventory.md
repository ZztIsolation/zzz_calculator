# Vue 前端重写行为清单

本清单用于约束 `webapp/` 重写，不描述理想 UI，而描述旧前端已经承载的用户语义。新版可以改变界面组织，但不能悄悄改变这些行为。

## 基线

- 分支：`codex/vue-ui-rewrite`
- 基线命令：
  - `npm test`：当前根目录没有 `test` 脚本，命令失败。
  - `npm run test:browser-local-compute`：通过。
  - `npm run test:server-production`：通过。

## 选择与持久化

- 构建选择旧键：`zzz-calculator.homeSelection.v1`。
- 新版应使用自己的构建选择键，但启动时只读旧键做尽力恢复。
- IndexedDB/localStorage 用户资产继续通过 `frontend/local-store.js` 读取，不迁移 schema：
  - IndexedDB：`zzz-calculator-user-store`
  - localStorage fallback：`zzz-calculator.userStore.v1`
- 账号当前态仍以 `local-store.js` 的 `currentOwnerId` 为准，导航显示使用账号 label。

## 角色、音擎与核心技

- 默认角色来自 catalog 中可展示角色列表的第一项，旧选择存在且合法时优先旧选择。
- 音擎默认必须走 `SharedCombat.defaultWEngineIdForAgent` 语义：换角色时选择该角色推荐音擎，旧保存值合法时保留。
- 音擎精修等级必须按音擎可用范围夹紧。
- 核心技默认必须走 `SharedCombat.coreSkillDefaultLevel`；没有核心技等级时允许 `none`，并禁用无效选择。
- 影画等级按 0-6 处理，并随角色切换独立保存。

## 图标资产

- 角色选择必须渲染 `agent.images.portrait`。
- 音擎选择必须渲染 `wEngine.images.icon`。
- Buff 来源分组优先渲染 `images.icon`；单条 Buff 继承来源分组图标。
- 已有图片路径的条目不能退化成纯文字；缺失路径时使用统一占位图并在测试里列出缺失项。

## 伤害目标与计算配置

- 伤害目标默认预设为正常 Boss；默认防御按 catalog preset 或旧默认 `953`。
- 默认等级系数为 `794`。
- 默认失衡倍率为 `150%`，旧保存缺失时按已启用处理。
- 抗性按元素单独保存和展示，当前元素切换不能覆盖其它元素输入。
- 计算模式必须支持：
  - 单事件直伤
  - 贯穿/烈破相关伤害
  - 异常伤害
  - 自定义事件
  - 角色 `defaultCalculationConfig` 管理员默认循环
- 角色存在 `defaultCalculationConfig` 时，默认优先使用管理员默认循环，并展示事件摘要。

## Buff 行为

- 默认勾选来源类型：自身 Buff、音擎自身 Buff、音擎团队 Buff。
- 影画类默认 Buff 仍按旧逻辑自动应用。
- 用户手动取消默认 Buff 时，保存到 `manuallyUncheckedDefaultBuffIds`，不能只从 `activeBuffIds` 推断。
- Buff runtime 输入包括层数、覆盖率、来源值、音擎精修等级等；同组 runtime 规则需要同步更新。
- Buff 弹窗必须编辑草稿，点击确认才应用，取消必须还原。

## 驱动盘与套装

- 首页/工作台驱动盘来源至少支持手动 1-6 槽和套装预设两种。
- 手动槽位选择按角色独立保存，移除某槽位不能影响其它槽位。
- 套装预设仍来自 `driveDiscLoadouts`，应用时不复制驱动盘数据。
- 优化结果保存为套装预设时默认名沿用“角色名-分数-第 N 名”语义。

## 优化器

- 默认算法：`exact-super-bound`。
- Worker 仍走浏览器本地计算，不启用生产服务端重优化 API。
- 状态机必须区分准备、运行、取消中、已取消、完成、错误。
- 用户点击取消后，只展示一个禁用的取消中状态，不保留可重复点击的旧按钮。
- 进度指标至少保留已评估/预估组合、百分比、耗时、速度或 ETA 中的核心信息。

## 仓库、导入与账号

- 仓库列表读取当前账号作用域下的驱动盘。
- 导入扫描器数据必须复用 `importScannerExportToStore`。
- “同步删除缺失盘”必须在导入确认流程里显式展示，不作为危险常驻开关。
- 删除驱动盘、删除套装预设、删除账号必须展示影响范围。
- 账号删除不能删除当前账号，仍遵循 `local-store.js` 约束。

## 验收用例

- 同一 fixture 下，旧核心与新版 store 计算出的伤害数字一致。
- 切换角色后，核心技、音擎、影画、默认循环、Buff 默认态均刷新到该角色语义。
- 角色、音擎、队友 Buff 选择器在桌面和移动端都有实际图片。
- 老用户 IndexedDB 数据在新版中能看到账号、驱动盘和套装预设。
- 构建产物下 `/`、`/discs`、`/accounts`、legacy redirect 和 assets 均可访问；旧维护页 `/maintenance.html` 仅在维护显式启用时暴露。
