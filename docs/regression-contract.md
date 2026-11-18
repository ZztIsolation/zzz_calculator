# 长期回归契约

状态：现行行为约定。核对日期：2026-11-18；基准提交：`9d51640c23697a849bdd3674b7f645a30c9f76b0`。本次核对为源码与既有测试静态审查，不代表重新运行全部业务测试或线上验收。

本文档只记录**改了容易坏、且不看文档想不到**的跨角色不变量和测试入口。公式与机制语义见[建模说明](modeling.md)；角色专属验收边界见[角色文档索引](characters/README.md)；布局见[布局契约](frontend-layout-contract.md)；本地数据细节见[本地数据](local-data.md)。目录配置是当前事实，历史样例不是恢复默认值的依据。

按任务读取：计算或角色改动读“计算与 Buff”“优化器”；维护页和目录改动读“目录与维护”；存储、备份、导入读“本地数据与账号”。

## 架构与路径一致性

验证入口：[浏览器本地计算](../tests/browser-local-compute.test.js)、[生产服务](../tests/server-production.test.js)。

- `core/` 只承载可跨平台复用的计算、规范化、校验和搜索逻辑，不依赖 DOM、浏览器存储或 Node 文件系统；`webapp/src/runtime/` 提供目录、IndexedDB/localStorage 和扫描器桥接等适配；`backend/` 提供 Node API、文件存储适配和静态产物服务。同一业务规则不得在后端和浏览器各维护一份。
- 浏览器重优化默认在本地 Worker（[optimizer.worker.ts](../webapp/src/workers/optimizer.worker.ts)，由 [stores/optimizer.ts](../webapp/src/stores/optimizer.ts) 创建）中运行；公开部署不得把用户仓库上传到共享服务端执行重计算。
- **路径一致性（下文所有计算条款默认适用）**：普通、白盒、快速总伤、prepared、compiled、indexed、dense、固定套装评分、Node Worker、浏览器 Worker 和严格优化器对同一输入必须同值。路径一致不能替代对机制正确性的独立算例。

## 计算与 Buff

验证入口：[公式](../tests/formula.test.js)、[效果目标](../tests/effect-rule-targets.test.js)、[白盒](../tests/damage-whitebox.test.js)、[Buff 组件](../webapp/src/components/BuffPickerModal.test.ts)。

- 默认角色来自可展示 catalog，合法的旧选择尽力恢复；角色切换后推荐音擎、核心技、影画、默认循环和默认 Buff 按新角色重新解析。音擎改装等级和影画等级夹紧到合法范围，没有核心技等级的角色允许 `none`。
- 计算支持单事件直伤、贯穿、锐化、异常、紊乱、自定义事件和角色 `defaultCalculationConfig`；影画变体取不超过当前影画的最高已配置等级；管理员默认循环载入后必须转换为运行态 `adminDefault`。
- 事件级 `stunned` 缺失默认 `true`，技能组引用展开时覆盖全部组内事件，各路径读取同一状态；目标配置不得保存全局 `stunned`，切换结算属性不得覆盖其他属性输入。
- 乘区归属必须保持[建模说明“乘区归属”](modeling.md#乘区归属)的语义：`stunDmgMultiplierBonusCapAlways`、事件级 `penRatio`、`damageRatioPct`、`anomalyDamageBonus` 的作用域与异放继承、`alienationCoefficientBonus`。独立算例须同时覆盖作用目标和排除目标；`anomalyVariant: polarizedAssault` 显示为“极性强击”。
- 异常掌控的百分比与固定点数不共用累加桶（取整算例见[爱丽丝](characters/alice_thymefield.md)）；音擎“空羽复归之诗”精 1 的 20% 默认异常增伤必须得到属性异常 `1.2`、紊乱 `1.0`、异放 `1.2`、耀变 `1.2`；“壳中之灵”只有以太伤害规则带以太属性要求，其异常增伤和紊乱增伤不得继承该要求；“谶羽之誓”使用默认作用域并额外要求装备者为 `lumiflux`。
- 紊乱与乱流（语义见[建模说明](modeling.md#紊乱与乱流)）：按属性归属过滤，非风角色可添加乱流，风角色不能添加乱流或紊乱，紊乱不得使用风化；`elapsedSeconds` 的步长、保存归一化和计算精度读取目录项 `tickIntervalSeconds`，存储不得按基础时长截断。
- 异放保存为独立 `settlementType: "release"`，通用事件携带 `triggerActorRef`、倍率方案和唯一 `anomalySource`；新保存不得出现 `anomalyVariant: "release"` 或普通异常触发次数，旧事件与旧纯异放规则自动升级。当前角色作为来源读取实时面板，外部来源使用含角色、配置哈希、捕获时间、面板和修正参数的冻结快照，只有刷新才更新；敌人防御、抗性和事件失衡保持实时；不得实现 A+B 联合驱动盘搜索。
- 异放区间上界：固定套装异放评分内核只有在区间上界已实现时才能声明 `releaseIntervalBound: true`，该标记由 `compileForSetCounts()` 原样透传给严格优化器；缺少标记的回退路径必须返回无限上界并禁止剪枝。“初始异常掌控→异常暴击率”的 clamp 公式经白名单解析器证明单调后才可参与；其他动态公式、动态局外属性要求或无法证明的区间必须回退，并以 `releaseBoundFallbackReason`（`fixed-kernel-unavailable`、`dynamic-formula-unsupported`、`dynamic-out-of-combat-requirement`、`interval-bound-unsafe`）标明。该性能修复不得改变伤害语义。
- 锋御域由 `core/sharpDamage.js` 统一处理，规则见[克拉蕾](characters/claret.md)。
- 默认 Buff、影画 Buff、用户手动取消项和 runtime 输入分别保存；Buff 弹窗只编辑草稿，确认后才应用，取消必须无副作用。
- 工作台自定义 Buff 只允许新建面向用户的精简白名单：六属性伤害加成必须分别保留；六属性版贯穿增伤、属性暴击伤害、属性无视防御、属性减抗和属性抗性无视不得出现在候选项中；“异常掌控超过 140 时每点转异常精通”和“初始异常掌控超过 100 时每点转异常暴击率”不得向用户开放（后者在维护端也只能用于“异常目标 + 异放”）。维护端必须继续提供全部明确属性字段和阈值类型，计算核心及存量自定义 Buff 不得因用户白名单收窄而丢失兼容。
- 队友配置优先级为“用户手动修改 > 当前 UID 的完整 Enka 导入 > 管理员默认”：首次从管理员默认接入 Enka 时不得把默认未选 Buff 记录成用户覆盖；用户在导入前后修改的队友、影画、Buff、运行时输入和装备关联在普通刷新中必须保留；没有来源标记的旧队伍按用户配置迁移；只有明确重新同步才清除对应用户覆盖。
- 队友音擎 Buff：每个已勾选项独立选择合法范围内的精修等级，新勾选和缺失默认精 1，取消勾选和批量移除同时清理等级引用与 runtime。等级以 `{ id: "wEngine:<engineId>.team", sourceCategory: "wEngine", sourceKind: "wEngineTeam", wEngineModificationLevel }` 轻量引用保存在 `combat.addedBuffs`，同时保留 active ID 与引用，合法的旧 `addedBuffs`-only 引用恢复为启用；构建输入投影为 `combatBuffs.wEngineTeamModificationLevels[buffId]`；“自定义 N 条”只统计 `sourceKind === "custom"`。
- 事件管理：目标事件列表完整换行展示可读摘要，列表与详情显示当前倍率并实时更新；角色当前普通技能等级覆盖存量事件的等级快照，核心技等级覆盖核心技事件快照；最大化单技能、贯穿或异常伤害时不得从左侧新增、复制或删除事件。管理员默认事件详情以正常文本色展示中文静态值（含只读“是否失衡”），不得用低对比度禁用控件；非管理员计算方式允许逐事件切换。
- 角色、音擎和 Buff 来源已有图片时显示真实资源；所有 catalog `/assets/...` 引用必须在构建时验证存在。

## 目录与维护

验证入口：[维护校验](../tests/maintenance-validation.test.js)、[角色 API](../tests/agent-maintenance-api.test.js)、[维护界面](../webapp/src/views/MaintenanceView.test.ts)、[真实浏览器保存](../webapp/e2e/agent-maintenance.e2e.ts)。布局细节见[布局契约](frontend-layout-contract.md)。

**资源与界面**

- 维护页覆盖角色、角色技能、音擎、驱动盘套装、异常/紊乱、队友 Buff、场地 Buff 和 Boss Buff 八类资源（`systemBuffs` 不在导航显示），使用结构化表单：界面、搜索结果和保存预览不得显示或编辑内部 ID，不得恢复可编辑原始 JSON（角色技能维护器可在默认折叠的“技术信息”中只读显示 ID），不得合并成按字段名推断行为的通用递归编辑器。
- 角色默认计算方式区分“自定义”“最大化单个技能伤害/贯穿伤害”“最大化异常伤害”；技能倍率引用使用技能表、大类、招式和倍率行级联。默认循环根配置固定为 0 影，附加方案只能用未占用的 1–6 影并按等级排序；新增影画方案复制当前循环、重建全部事件 ID 并同步重映射 `selectedEventId`；删除目标事件后选择相邻事件，最后一个事件不可删除；弹窗取消不得修改角色草稿。
- 新建请求允许省略顶层 ID，后端校验前补齐顶层与嵌套 ID，已有 ID 不变；场地 Buff 按玩法、版本、期数和名称生成稳定 ID。异常资料读取 `anomalyEffects.effects` 并按 `settlementType` 区分 `attribute`、`disorder`、`turbulence`。

**增幅目标与规则**

- 增幅对象区分“常规属性/全局效果”“异常目标”“指定角色招式”“通用技能大类”“通用招式标签”。异常目标保存 `target.kind: "anomaly"` 和当前支持的结算类型；可选 `target.releaseTargets`（每项由 `agentId` 与 `profileId` 组成），非空时只能选单一异放结算并按触发者与方案身份匹配，空数组或缺失表示全部异放。
- `anomalyEffects` 缺失或空数组表示命中该结算类型的全部具体异常，非空才是精确白名单，保存和 API 返回省略空数组；异放的筛选指原异常，不筛选触发者或倍率方案；切换异常目标的结算类型必须重置为全部，离开属性异常时清除异常形态；异放定向规则不得伪装为普通异常形态。
- 校验上下文携带完整角色清单（维护页用目录角色并以当前草稿替换同一角色，保存接口用数据文件角色并以清理后的草稿替换），同一次保存中新增的异放方案必须能被引用。
- 标签模式支持多选，同一规则的标签按 OR 匹配，不得与指定招式或通用大类混用；合法标签白名单以 [core/skillTargets.js](../core/skillTargets.js) 的 `SKILL_TAGS` 为准。维护页与自定义 Buff 不得显示或新建 `moveIdPrefixes`，自定义 Buff 不得暴露缺少异常目标选择的 `anomalyDurationBonusSeconds`。
- 每个招式必须保存合法 `skillType`，可选 `skillTags` 只能来自白名单且不重复；类型和标签不得根据中文名称或 ID 推断；冲刺攻击属 `dodge`、强化特殊技属 `special`、支援攻击属 `assist`，连携技与终结技独立匹配；同一角色的一个类型不得拆到多个技能目录；已知旧 ID 前缀在工作台加载、运行时匹配和维护保存前自动迁移，未知前缀阻止保存并给出可操作错误。
- 不得显示或新建旧“适用范围”、伤害类型、伤害属性或技能限定筛选；新保存的规则不含 `appliesTo`（技能范围用 `target.kind: "skill"`，异常范围用 `target.kind: "anomaly"`，属性限制用明确的属性类型，多属性效果拆成共享层数的多条规则）。运行时继续计算旧 `appliesTo` 浏览器状态；可无损转换的筛选在保存前迁移，`damageKinds`、`anomalyEffects` 等无法无损转换的筛选保留读取兼容但阻止落盘并提示重选。
- 驱动盘 2 件套：普通面板型固定按局外面板效果校验，仅 `target.kind: "skill"` 的定向规则按局内事件增幅校验，凑齐后自动注入、不需活动 Buff ID；2 件套的非技能目标不得借伪造 `scope: "inCombat"` 写入事件规则。4 件套的 `selfBuff`/`teamBuff` 固定按局内 Buff 校验，无显式范围时必须允许技能增幅、事件增幅和 Buff 修饰器；清洗后的驱动盘数据省略 `scope` 与 `appliesToOutOfCombatPanel`。
- 效果规则可独立保存条件、持续时间、冷却时间、覆盖率、层数、`requirement.specialty` 和 `requirement.attribute`；时间字段不得自动推算覆盖率，缺失按 100%；团队效果的 `exclusiveGroup` 保证同组只结算一次，当前装备者的原始朋克效果优先于外部队友副本，忽略明细说明同名去重原因。
- 覆盖率只能配置在单条 `effects[]` 规则上：维护页逐规则开启并以 0%–100% 维护 `default`，首页和优化器用 0–1 小数，存储 0–1，`min/max/step` 固定 `0/1/0.1`；未开启的规则按 100% 计算并忽略运行时注入；旧父级 catalog/runtime 覆盖率读取兼容并迁移到各子规则，新保存不再写父级字段。
- 定向 `dmgBonus` 的维护文案为“技能目标伤害加成%”，`skillMultiplierBonus` 为“技能倍率加算%”，各界面不得混用。
- 技能组的 `defaultCount/minCount/step` 由系统固定为 `1/0/1`，技能组不保存也不执行最大次数；`eventCountRange.max` 只用于单条倍率行的真实机制上限，聚合后的次数不得重复套用单组上限（算例见[11号](characters/soldier_11.md)）。共享层数组通过中文显示名选择或新建，复制时重建组标识并保持范围内共享关系。
- 音擎 `effect.description.zhCN` 是纯展示文案：数值按精炼 1→5 用 `/` 枚举全部五档并与 `modificationValues` 一一对应（百分比逐档带 `%`，点数类整组只写一次单位）；禁止 `25%-35%` 这类区间写法；固定阈值（如“暴击率超过100%”）不属于精炼档位。图片来源与 `sources[]` 分开编辑，多条来源增删和往返不得相互覆盖；音擎与驱动盘效果可维护现有条件、持续时间、分段文案、覆盖率和 Buff 修饰器。
- 角色可维护 `importantSubStats`（取值限定为驱动盘副词条池属性标识，去重）与 `importantPanelStats`（同时作用于局外与局内面板；命破角色可选项含 `sheerForce`，锋御角色含 `lacerationDmg`）：只用于展示高亮，不得进入伤害计算、优化器、评分或排序；空数组保存时省略，旧数据缺少字段按未配置处理。

**队友 Buff**

- 队友角色分组在角色层保存合法 `attribute` 与 `specialty`（新增或保存时必填，`/api/catalog` 与 `/api/meta` 完整保留）；队友 Buff 页签用两个不可重复的槽位，按特性分组选择并保留搜索，批量添加/移除只作用于当前可见 Buff；新选队友默认勾选普通 Buff，影画选择累积切换对应影画 Buff，潜能 Buff 独立手动选择。
- 程序联动不新增 `enabled:*` 手动键，用户直接编辑槽位、影画、Buff 开关或参数才记录 `manualKeys`，显式批量添加/移除也属手动。旧配置 `legacyUser` 在未接入 Enka 时普通刷新保持旧值，管理员默认可采用完整导入且已有手动覆盖优先；绑定 UID 后可显式“从导入资料重新同步”，只更新草稿，应用后保存，取消保留原配置和覆盖率等场景输入。
- 槽位按账号和角色保存，替换队友只清理原队友的选择及运行时输入；旧配置超过两名队友且无槽位状态时，打开前保留自身及自身音擎 Buff 并持久化重置其余；保存失败恢复原配置并允许重试，重置成功后取消弹窗不得撤销已完成的迁移。队友 Buff 支持删除当前 Buff 和确认后删除整个角色组；旧版 `zzz_maintenance_vue_draft_v1` 草稿可迁移到结构化草稿。

**协议、并发与安全**

- 跨资源引用使用可搜索的可读名称选项，复制条目重建拥有的嵌套 ID 并重写范围内引用。八类资源均支持新增、复制、编辑、校验、保存、删除、删除确认、未保存离开提示和本地草稿恢复。
- 保存或删除成功后重新获取完整 `/api/maintenance/catalog`，不得用单文件响应覆盖组合 catalog；写请求成功但目录刷新失败时保留“已经写入”身份，重试只重新 GET，不得重复 POST/DELETE；保存、删除期间禁止重复提交。
- catalog 文件的 read-modify-write 串行执行并通过同目录临时文件原子替换。角色维护返回独立 `agentRevisions`：更新/删除用 `If-Match`，新增用 `If-None-Match: *`，版本在写入队列内以最新磁盘资料验证，缺少条件返回 428、过期返回 412；其他资源沿用原协议。
- 角色旧草稿采用基础快照、本机修改、最新资料三方合并（对象逐字段合并，数组整体；冲突显式选择；缺基线或角色已删除时保留草稿并阻止写回；v5 草稿保留冲突选择，失败和刷新不丢修改）。角色维护历史保存在 Git 忽略的 `data/.agent-history/`，每角色保留最近 30 次变更及前后快照；预写历史失败不得修改角色，落盘后完成标记失败应报告已保存并在后续恢复。
- 服务默认只监听 `127.0.0.1`；维护写入拒绝非 allowlist 的跨源 Origin（含 DNS rebinding），公开域名通过 `MAINTENANCE_ALLOWED_ORIGINS` 授权。维护关闭时 `/maintenance` 与 `/maintenance.html` 返回 404、维护 API 返回 403、导航隐藏入口；开启时 `/maintenance` 提供 Vue 页面，`/maintenance.html` 以 308 跳转到 `/maintenance`。

## 本地数据与账号

验证入口：[完整备份](../webapp/src/runtime/personal-backup.test.ts)、[IndexedDB 备份](../webapp/src/runtime/personal-backup-indexeddb.test.ts)、[备份恢复浏览器流程](../webapp/e2e/personal-backup.e2e.ts)、[存储兼容](../webapp/src/stores/local-store-indexeddb-compat.test.ts)、[导入事务](../tests/drive-disc-import-transaction.test.js)、[撤销](../webapp/src/runtime/drive-disc-import-transaction.test.ts)、[配装保存锁](../webapp/e2e/drive-disc-loadout-save-lock.e2e.ts)。

**备份、撤销与缓存**

- 完整个人备份覆盖全部账号库存、套装预设、绑定、角色计算配置和应用设置，范围由统一的 `isAppStorageKey` 定义；库存 fallback 原串与无关站点键不得进入备份，恢复也不得删除或改写无关站点键。恢复先预览并核对数据指纹，确认前下载恢复前副本，经 `personalDataRestore` 事务日志写入，失败回滚、启动时恢复中断日志；存在日志时，除恢复事务自身外任何库存写入和“清除浏览器数据”必须被拒绝。坏库存 fallback 只有显式恢复且原始字符串未变时才可替换。细节见[本地数据](local-data.md#完整个人备份)。
- 普通导入撤销只允许当前账号最近一次成功 JSON/扫描导入；预览和确认都检查导入后状态指纹，相关驱动盘、配置或套装引用变化时拒绝（仅切换当前角色不受影响）；复用导入事务，失败回滚、中断恢复和冲突提示保留，成功后清除撤销记录。细节见[本地数据](local-data.md#撤销普通导入)。
- 优化结果刷新缓存（`zzz-calculator.webapp.optimizer-results.v1`，按账号+角色，最多 6 组）恢复时必须核对目录指纹与每张盘的内容指纹，变化时不得把旧结果标为可用；缓存损坏或写入失败只能丢弃缓存；没有可恢复缓存且界面仍处于“优化结果”模式时，必须回退到“自选”并提示、持久化该模式。细节见[本地数据](local-data.md#优化结果缓存)。
- 账号新建、改名、切换和删除必须防重复提交，失败时保留名称草稿或删除确认，旧账号列表加载结果不得覆盖后发操作，陈旧读取返回后必须落定加载状态。工作台优化任务必须绑定账号、角色、请求代号和目录内容指纹：切换上下文、重置、取消、错误或 Worker 终止后，旧任务的成功、错误、进度和预估消息一律丢弃，等待中的 Promise 必须结算，临时结果不得保留或写入缓存；搜索进度可携带当前 Top 10 快照但只能展示，不能保存或锁定，只有完整结果才可自动选中方案；离开工作台时仅在仍有进行中任务时终止并结算。

**读取、存储与导入**

- 库存 localStorage fallback、构筑选择、账号选择和优化设置的 JSON 解析失败必须保留原始内容并阻止相关保存，键不存在才使用默认值；页面提供原始内容导出入口，不得自动猜测或修补；扫描器偏好和维护草稿沿用各自的读取与恢复边界。
- 账号、当前账号、驱动盘、导入记录和套装预设继续使用既有 IndexedDB `zzz-calculator-user-store` 与 localStorage fallback `zzz-calculator.userStore.v1`，不迁移结构或键名；旧构建选择键 `zzz-calculator.homeSelection.v1` 继续用于尽力恢复；`zzz-calculator.webapp.build.v1` 的兼容保存必须透传未知角色字段和自定义事件字段，未来版本写入的异常来源快照、异放触发者及原异常来源引用不得被旧版删除。
- 驱动盘加载、Scanner 导入、Calculator 原生备份导入、直接 upsert 与保存必须复用同一套装规范化器：精确中文 `setName` 已在别名表中时，空 `setId` 或 `scanner-set-*` fallback 补为正式 ID，正式 ID 缺少 `canonicalSetName` 时补全；未知名称与自定义非 Scanner ID 保持原样。首次加载迁移只允许改变命中盘的 `setId` 和 `canonicalSetName`，不得改变仓库版本、顶层时间戳、盘数量与顺序、盘 ID、指纹、词条、锁定、装备、专属/排除、来源/raw、导入记录、账号、套装预设引用或未知扩展字段；重复加载不得再次写；IndexedDB 在同一 `readwrite` 事务内读取、转换、写回并等待完成，localStorage fallback 在无异步间隙的最新值上转换；持久化失败时当前页面仍使用内存补全结果，原始记录不被破坏；不得要求重新扫描或导入，不得变更 Helper、Scanner、manifest、协议、原生包或 IndexedDB schema。
- 驱动盘仓库始终按当前账号隔离，手动 1–6 号位、套装预设和优化结果互不复制或串改底层驱动盘。导出包含当前账号全部驱动盘且不受搜索、槽位或主词条筛选影响，不含其他账号或套装预设；原生文件使用带版本号的 `zzz-calculator-drive-disc-export` 格式，移除 `ownerId` 和派生指纹，回导时重算指纹并归入当前账号。原生导出文件与扫描器 JSON 共用导入预览和确认流程：同账号同 ID 记录原位更新，完整重复回导不新增副本，同内容不同 ID 的原生记录可在空账号中完整恢复；未知原生版本和损坏结构明确拒绝，不降级为扫描器数据解析。
- 扫描器导入先展示差异，“同步删除缺失盘”只能在确认流程中显式启用；删除驱动盘、套装和账号必须展示影响范围，当前账号不可直接删除。扫描器本地/云客户端选择、Helper 连接、包准备进度、取消和导入结果保留；扫描 payload 与 manifest 由自动化测试锁定。

**优化结果一键锁定**

- “一键锁定”只处理当前选中方案的六张驱动盘，为当前角色写入 `reservedForAgentId`（与单盘专属锁一致，不是游戏内锁定标记，不处理其他方案、账号或角色的盘）。执行前按当前账号仓库最新记录确认 1–6 号位六张盘都存在，缺盘、失效或无当前角色时不可操作；六张盘均已专属当前角色时按钮切换为“一键解锁”，整批解除本方案的专属，写入前按最新库存核对归属，任一变化则整批停止并提示刷新，不解除其他角色专属，也不改主动排除记录或游戏锁定字段。
- 任一盘已专属于其他角色或被当前角色主动排除时，首次操作整批不写入，界面列出冲突盘、槽位及原专属角色或排除状态，用户确认后才整批更新，取消不产生修改；确认后的写入复用现有批量持久化路径，保留其他角色排除记录与无关字段，写入期间禁止重复操作，失败不显示成功也不遗留部分更新，成功后单盘与整套状态一致且刷新可恢复；不得触发新一轮优化、改变方案排名或把盘复制为新记录。槽位展示关系见[驱动盘布局](frontend-layout-contract.md#工作台)。

## 优化器

验证入口：[优化器](../tests/optimizer.test.js)、[fuzz](../tests/optimizer-fuzz.test.js)、[浏览器 Worker](../webapp/e2e/velina-optimizer.e2e.ts)。

- 默认算法为 `exact-super-bound`，公开算法名、输入输出、进度和取消数据结构保持兼容。
- “严格精准”必须保持完整 Top 10 驱动盘 ID、稳定顺序和浮点误差契约，合法方案不足 10 套时返回全部。`exact-legacy`、`exact-super-bound`、Node 并行和浏览器 Worker 在各类合法筛选后必须保留完整候选，不得在枚举前执行未经证明的单盘 dominance 删除，`candidateCountsBySlot` 与 `estimatedCombinationCount` 以完整合法空间为基准；非精准 `heuristic-potential` 可压缩候选，但等属性盘的稳定比较与最终结果统一用“来源顺序、驱动盘 ID”字典序，不得形成互相支配或空槽。完整候选空间仍可使用已声明安全的普通上界、后缀 Top-K 上界和异放 `releaseIntervalBound` 剪枝。
- 精准优化器与关闭剪枝的穷举必须具有相同 Top 10 盘 ID、稳定顺序和容差内分数，逐分支上界不得低于真实后代最大伤害；区间上界可用时 `scoredCombinationCount + prunedBySuperBound === estimatedCombinationCount`。
- 优化输入以 `settings.fourPieceSetIds` 保存候选 4 件套（兼容旧 `fourPieceSetId`），角色推荐以 `preferredDriveDiscs.defaultSetIds` 保存（兼容旧 `defaultSetId`），推荐只是缺省值而非白名单；手动选择及无来源标记的旧有效选择须跨切角色和刷新保留，手动空列表不得静默选回推荐或目录第一套，运行前仍需至少选一套。多套优化按候选顺序逐套调用单套严格内核，可复用当前全局第 10 名安全下界，最终结果严格等于各单套 Top 10 合并后的全局 Top 10；每条结果带实际 `fourPieceSetId`，总指标汇总预计量、进度与耗时并保留分套明细，取消覆盖准备、分支切换和分支内部计算。
- 角色默认 2 件套使用 `preferredDriveDiscs.defaultTwoPieceSetIds`，维护支持多选、清空、名称预览及保存回读；优化请求省略两件套参数时采用角色推荐，显式空数组表示不限，缺少候选盘时不得自动放宽。前端用 `twoPieceSetSource` 区分跟随推荐与手动设置，旧版无来源标记的已存值（含单数 `twoPieceSetId` 与空数组）按用户选择保留，`twoPieceDefaultsVersion` 不再授权覆盖，手动清空跨刷新保留，其他角色及优化条件不得被串改。
- 主词条仅在对应槽位参数缺省时采用角色推荐，显式空数组表示不限，非空数组按玩家所选过滤，不得隐式回填推荐；旧版自动保存的空数组也按不限处理（可能扩大搜索范围、增加耗时），不得推断或恢复此前被覆盖且未备份的选择；优化设置指纹包含筛选语义版本，不含该版本的旧结果指纹判为过期。
- 优化器的“手动配置触发参数”默认启用：旧配置首次读取从旧自动默认迁移为手动，之后明确保存为自动的配置继续按自动参数执行。角色推荐驱动盘可在 `preferredDriveDiscs.defaultFourPieceBuffRuntimeInputs` 维护 self/team 4 件套默认层数和覆盖率（只允许推荐套装及其现有效果规则，经规则边界校验），优化器首次初始化补齐，用户已保存字段优先，并以独立版本标记阻止后续管理员修改覆盖既有用户配置；普通工作台 Buff 不读取该角色级默认。
- `zzz-calculator.webapp.optimizer.v1` 的兼容基础读取版本 2、3、4：版本 2 保存单选四件套时同时写旧 `fourPieceSetId` 和单元素 `fourPieceSetIds`；回滚读取版本 3 时只用首项驱动旧 UI，但保留完整数组、未知角色字段、其他角色记录、顶层元数据和原版本号；版本 4 的最低面板字段可含锋御防御力。
- 标准、白盒、compiled、dense、固定套装评分、乐观上界、Node 优化器和浏览器 Worker 必须按候选套装计数识别定向 2 件套并携带同一 `skillTags`（拂晓生花 2 件套只提升有技能来源的普通攻击，不提升终结技或手填倍率事件）。未限定额外 2 件套时只允许完整 4+2 和限定套装 6 件同套，4+1+1、5+1 不得进入预计组合数或结果；无合法计划时统一提示“已有驱动盘太少，无法组成 4+2 或 6 件同套。”，最低面板失败不得误用该提示。
- Node 适配器保留 `worker_threads` 并行；浏览器适配器只允许一个控制 Worker，禁止嵌套任务 Worker，保留事件循环让步和准备阶段进度；历史 `exact-super-bound-parallel` 浏览器设置静默迁移为 `exact-super-bound`。Worker 只复用内容指纹仍一致的目录数据，账号、库存、限制、计算输入或目录变化使缓存失效，取消、错误和部分结果不写入缓存。
- 状态机区分准备、运行、取消中、已取消、完成和错误，进入取消中后不保留可重复点击的取消操作。固定套装专用评分器、套装计数内核缓存、目标相关词条淘汰和后缀前沿必须带安全回退；固定/自动 4+2 fixture、Node 并行、浏览器串行、历史设置迁移、进度、取消及 160-seed fuzz 保持通过。

## 路由与发布

验证入口：[生产服务](../tests/server-production.test.js)、[晋级工作流](../tests/deploy-promotion-workflows.test.js)、[超时](../tests/production-deployment-timeouts.test.js)、[配置静态校验](../scripts/validate-deployment-config.js)。

- Vue 路由包括 `/`、`/discs`、`/accounts`、`/import`、`/settings`、受保护的 `/internal/scans` 和配置开启时的 `/maintenance`；旧 HTML 入口兼容跳转按服务端映射维护；角色导入和维护另有运行配置门禁。
- Node 只服务 Vue 构建产物，不回退到旧静态前端，缺少产物时开发服务给出明确构建提示；非法 URL 百分号编码返回 400 且不得终止服务进程，路径只解码一次。
- `dist/`、`output/`、`downloads/`、日志和本地用户数据不进入 Git；`examples/`、业务数据、源代码和回归测试必须保留。
- main 的 Pull Request、push 和手动 CI 负责验证，成功的 main CI 可提供同 SHA 不可变产物；生产只由显式 `Promote deploy` 晋级，失败恢复使用 `Resume deploy`，推送 main 不部署生产；Pages 仅 `workflow_dispatch` 手动备用，默认不含维护页面。门禁与参数见[生产发布手册](production-deployment-runbook.md#工作流门禁表)。
- 生产计算/分析/优化 API 返回 403，退役账号与库存 API 返回 410；开发保留的预约、排除和配装适配器不代表生产恢复服务端库存。状态见[建模说明](modeling.md#接口状态)。

## 验收要求

按影响范围运行聚焦检查：计算或共享逻辑变更完成根回归，UI 变更验证构建及实际浏览器流程，发布遵守[当前手册](production-deployment-runbook.md)。

- `npm test` 已包含 `npm run test:webapp`，不需要重复运行同一套 Vue 测试。
- UI 构建使用 `npm run build:webapp`；布局回归使用 `npm run test:layout`，它自身包含构建。
- Pages 兼容或发布产物变更验证 `npm run build:pages`；CI 产物需与冻结提交相同。
- 维护数据变更检查保存回读、旧草稿冲突和候选目录中的人工修改。
- 纯文档修改执行差异、链接、命令和仓库完整性检查，不要求为了文字修改运行全部计算、布局及生产流程。
