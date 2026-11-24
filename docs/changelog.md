# 当前变更日志

状态：当前发布和实现摘要入口。核对日期：2026-11-18；基准提交：`9d51640c23697a849bdd3674b7f645a30c9f76b0`。

这里记录近期已经进入当前仓库的变化，采用“问题 / 变化 / 关键边界 / 验证”格式。详细公式和长期不变量分别维护在[建模说明](modeling.md)、[角色指南](character-authoring-guide.md)和[回归契约](regression-contract.md)；2026年5月至9月的完整历史位于[归档日志](archive/changelog-2026-05-to-2026-09.md)，2026年10月1日至13日的条目位于[10月归档](archive/changelog-2026-10.md)。提交进入仓库不等于生产已部署，发布状态以实际 CI/CD evidence 为准。

## 2026-11-23 — 防御性文字检查扩展到触发条件

- 问题：`test:description-style` 只扫描 `description.zhCN`，悠真二影、六影 Buff 的 `condition` 字段仍带有“可将覆盖率调至 0.6”“按需添加”之类的说明性文字，检查没有发现。
- 变化：检查同时扫描 `condition`，并补充“可将…调…”句式；悠真二影、六影的条件改为只写触发条件（二影：发动[连携技]或[终结技]获得[电掣]后，拥有[电掣]时的[冲刺攻击：飞弦·斩]；六影：[甲乙矢]命中处于失衡状态或属性异常状态下的敌人后）；套装 `zzz_wiki_2038` 与 `yunkui_tales` 四件套条件里既有的“默认按 N 层计算”列入白名单，不改动。
- 关键边界：覆盖率提示仍在悠真专题的“专属机制与建模假设”表中；数据、数值与默认配置不变。
- 验证：本地运行 `test:description-style`、`test:pr81-characters`、`test:maintenance-validation`、`test:repository-integrity`、`test:skill-targets` 与 webapp 的 `pr81-characters.test.ts`，结果为通过；把改动前的悠真数据放回时，新检查报出这两条违规。未运行完整 `npm test` 与构建，不代表远端 CI 或线上验收。

## 2026-11-23 — 悠真默认轴连携技改为 2 次

- 问题：悠真两条默认轴的连携技均为 1 次，用户决定改为 2 次。
- 变化：P0 与 P1–P6 默认轴的 `chain_huili`（连携技：会·离，12 级伤害倍率 1035.7%）改为 2 次，轴名改为“2连携…”；总基础倍率 P0 由 `11497.7%` 变为 `12533.4%`，P1–P6 由 `13221.9%` 变为 `14257.6%`；同步专题、测试断言与 `verification.defaultObjective`。
- 关键边界：外部资料没有明确写出连携技次数，这是用户决定；二影电掣、六影等按层数快照的效果不随连携事件数变化。
- 验证：本地运行 `test:pr81-characters`（含新的总倍率断言）、`test:skill-targets`、`test:default-calculation-config`、`test:maintenance-validation`、`test:repository-integrity`、`test:description-style` 与 webapp 的 `pr81-characters.test.ts`，均通过；未运行完整 `npm test` 与构建，不代表远端 CI 或线上验收。

## 2026-11-23 — 悠真推荐驱动盘缩减为两套

- 问题：悠真推荐四件套为如影相随、雷暴重金属、激素朋克、河豚电音，其中激素朋克与河豚电音没有留存的依据；改动前的专题写的是用户指定如影相随、不再提供其他四件套候选。
- 变化：悠真推荐四件套只保留如影相随（3 层、覆盖率 `1`）与雷暴重金属（覆盖率 `0.7`），移除激素朋克与河豚电音及其运行输入；4/5/6 号位主词条限制与默认输出轴不变。这是用户决定。
- 关键边界：未找到写明“潜能激发后哪套驱动盘最优”的可核对资料，两套的取舍没有用优化器对比验证；现有外部资料没有留存到 `docs/sources/`。
- 验证：本地运行 `test:pr81-characters`、`test:maintenance-validation`、`test:repository-integrity`、`test:description-style` 与 webapp 的 `pr81-characters.test.ts`，以及 `test:default-calculation-config`、`test:skill-targets`，均通过；未运行完整 `npm test` 与构建，不代表远端 CI 或线上验收。

## 2026-11-23 — 猫又默认轴补入连携技并调整普攻第五段次数

- 问题：猫又 P0 与 P1–P6 的默认轴都没有引用 `chain_claw`（连携技：刃爪挥击），而同期悠真两条轴都含 1 次连携；旧版参考组合与本次改轴均未说明排除连携的原因。原版普攻技能组末段次数为 `5/3`，显示不直观，且与手动用的 `basic_single` 重复。
- 变化（均为用户决定）：
  - P0 默认轴增加 2 次 `chain_1`（`chain_claw`，12 级伤害倍率 1073%，失衡内期望暴击），轴名改为“2连携1大2强化技3套普攻”；P1–P6 默认轴增加 1 次，轴名改为“1连携2大…”。
  - 原版普攻末段恒定 1 次（来源写的是 33.33% 概率重复，不取期望，会低估原版普攻）；`basic_single` 并入 `basic_expected`，后者改名“普攻五段（末段一次，不含爪印）”，保留原 ID 以兼容旧存档；`basic_single` 已删除。
  - 潜能失衡普攻组末段由 3 次改为 4 次，名称改为“末段四次”。
- 关键边界：默认总倍率随之变化；六影连携/终结技暴伤层数仍是快照，不随事件数变化；旧存档若手动选过 `basic_single`，该引用将无法展开（严格计算路径会报“技能组不存在”）；末段次数无逐帧实测。
- 验证：本地运行 `test:pr81-characters`、`test:skill-targets`、`test:default-calculation-config`、`test:maintenance-validation`、`test:repository-integrity`、`test:calculation-skill-groups`、`test:description-style` 与 webapp 的 `pr81-characters.test.ts`，均通过；未运行完整 `npm test` 与构建，不代表远端 CI 或线上验收。

## 2026-11-23 — 清理说明文字中的防御性内容并增加检查

- 问题：猫又与悠真的核心被动、额外能力说明末尾带有“默认按…可调整”“不自动推导”一类面向维护者的尾句，悠真六影电磁爆炸招式说明带有“按需手动添加”；角色专题新增了“已核实边界”“待游戏实测确认”等小节，其中引用的 B 站、Prydwen、海外专版等材料没有留存到 `docs/sources/`，无法核对。
- 变化：
  - 删除上述 5 处说明尾句和猫步秀中的覆盖率解释，默认状态仍由数据字段表达，数据与计算不变。
  - 角色专题的“已核实边界”改为只依据来源原文的陈述，“待游戏实测确认”改为“待核实”并给出来源字段位置；移除未留存来源的外部引用。
  - 新增 `npm run test:description-style`（已加入 `npm test`）：扫描全部目录的 `description.zhCN`，拒绝默认值、覆盖率、未建模边界类措辞；艾莉娅、西格莉德、菲奥妮、伊芙琳和浸染系统 Buff 的 5 条既有说明列入白名单，不改动。
  - [AGENTS.md](../AGENTS.md)、[角色建模手册](character-modeling-handbook.md#九来源与-verification)、[回归契约](regression-contract.md)与[角色模板](characters/_template.md)补充“玩家可见说明保持原文”“待核实必须有证据”两条规则。
- 关键边界：猫又默认琉音双大轴与推荐四件套的依据是未留存的社区攻略，是否保留待用户确认；不改变任何数值、技能组与默认配置。
- 验证：本地运行 `test:description-style`、`test:pr81-characters`、`test:skill-targets`、`test:maintenance-validation`、`test:repository-integrity`、`test:default-calculation-config`、`test:catalog-loader` 与 webapp 的 `pr81-characters.test.ts` 均通过；把清理前的数据放回时新测试报出 5 处违规，确认检查有效。未运行完整 `npm test` 与构建；均为本地验证，不代表远端 CI 或线上验收。

## 2026-11-23 — 猫又与浅羽悠真潜能觉醒建模优化与公开显示

- 问题：猫又（`nekomata`）与浅羽悠真（`asaba_harumasa`）此前处于隐藏审阅状态（`hidden: true`），存在空影画 Buff 占位与缺失六档 `cinemaDescriptions`、额外能力默认关闭、推荐盘子与潜能觉醒后主流失衡轴脱节等问题；悠真仅录入了 4 个大招/强化技招式，缺少普攻、冲刺斩击、逐雷、连携、支援与二影/六影电磁爆炸建模，且潜能 2–6 攻击加成的基准写为 `baseAtk`。
- 变化：
  - 规范与公开：移除猫又（二/三/五影）与悠真（一/三/四/五影）的空 `cinemaBuffs` 条目，补齐六档 `cinemaDescriptions`；移除核心被动冗余 `defaultChecked: true` 并默认启用两位角色的额外能力（猫步秀、超频）；将两者 `hidden` 设为 `false`，同步更新[猫又专题](characters/nekomata.md)、[浅羽悠真专题](characters/asaba_harumasa.md)、[角色索引](characters/README.md)与[角色建模手册](character-modeling-handbook.md)。
  - 猫又（`nekomata`）：P1–P6 默认计算目标升级为“0影琉音双大失衡轴：2大2绒爪穿刺2强化技1套普攻＋10爪印”（P0 保持原版 1大2强化技3套普攻）；按人工维护的覆盖率（依据为社区攻略，原文未留存到来源快照，不作为来源证据），将推荐 4 件套调整为啄木鸟电音（3 层、覆盖率 `0.7`）、河豚电音（大招后 12 秒攻击覆盖率 `0.8`＋常驻 20% 终结技增伤）、激素朋克（`0.7`）、獠牙重金属（`0.7`），移除如影相随。
  - 浅羽悠真（`asaba_harumasa`）：依据 Nanoka `3.3.12+19520738` 补齐 6 大类 19 招式（普通攻击：穿云按物理 1–3 段 / 电伤 4–5 段拆分、冲刺攻击：飞弦·斩、逐雷、特殊技：天罗、连携技：会·离、支援技与影画六：电磁爆炸 1500%）；补全 P0/P1+ 核心暴击与锋芒暴伤目标、P2–P6 `outOfCombatAtk` 攻击加成及仅限飞弦·斩/逐雷的 5%–15% 电抗无视、二影「挥霍」+50% 飞弦·斩增伤；新增 `dash_slash_combo` 技能组，默认轴升级为 P0 12 刀失衡轴（总倍率 `11497.7%`）与 P1–P6 12 刀＋12 逐雷失衡轴（总倍率 `13221.9%`）；推荐 4 件套扩展为如影相随（`1.0`）、雷暴重金属（`0.7`）、激素朋克（`0.7`）、河豚电音（`0.8`）。
  - 测试与基线：同步 `tests/skill-targets.test.js`（277 招式、665 行、132 目标、标签基线），重写 `tests/pr81-characters.test.js` 独立手算算例、排除反例、影画/潜能校验与公开 Enka 映射断言，并更新 `webapp/src/stores/pr81-characters.test.ts`。
- 关键边界：两者均无全队 Buff，不创建队友条目，不预绑 `defaultTeammates`；不模拟动作时长、喧响/能量、电壶/电囚/呼噜能量收支、自动叠层或站位判定；猫又 `超凶爪印` 仍不挂 `followUp`、悠真 `逐雷` 不挂 `dashAttack`；悠真六影 `电磁爆炸` 为可选手动影画招式，不自动进入 0 影默认轴。未提交、推送或部署。
- 验证：本地运行完整 `npm test`（全部根目录 Node 回归测试包括 `test:pr81-characters`、`test:skill-targets`、`test:maintenance-validation`、`test:repository-integrity`、`test:enka-import`、`test:optimizer` 等均通过；`test:webapp` 在默认 UTC-8 环境下 78/79 文件、1046/1047 用例通过，唯一失败为与本次无关的 `ImportView.test.ts:310` 时区格式化断言，在 `TZ=Asia/Shanghai` 下复验 `ImportView.test.ts` 与 `pr81-characters.test.ts` 共 38/38 全部通过）；`npm run build:webapp`（含 179 张缩略图 `--check`、`vue-tsc --noEmit`、`vite build`）与 `git diff --check` 通过。均为本地验证，不代表远端 CI 或线上验收。

## 2026-11-22 — 赛维里安公开显示

- 问题：赛维里安与专武禁罪囚笼此前为 `hidden: true`，工作台、优化器选择和公开 Enka 导入都不可用。
- 变化：`data/agents.json` 的 `severian_lowell.hidden` 与 `data/w_engines.json` 的 `zzz_wiki_2305.hidden` 改为 `false`；[角色专题](characters/severian_lowell.md)的“首页与优化器”“专武”“验收边界”同步改为公开显示，专属测试的 `agent.hidden`/`weapon.hidden` 与 `displayAgents`/`displayWEngines` 断言改为公开状态，维护页草稿断言改为读取目录值。
- 关键边界：公开只影响选择与导入可见性，不改角色数值、默认循环、Buff 默认值或 Enka 映射；维护页仍可编辑。隐藏期间的历史条目保留原记录。
- 验证：`test:severian-damage`、`test:enka-import`、`test:maintenance-api`、`test:webapp`（1047 项）通过。

## 2026-11-22 — 赛维里安浸染描述修正

- 问题：浸染 Buff 描述写成“队伍中角色触发其他属性异常形成浸染”，与机制不符：浸染由风化状态下首次非风属性伤害触发，不需要先触发另一种异常。
- 变化：`severian_lowell.combatBuffs.skillBuffs.imbuement.description` 改为“敌人处于风化状态时，队伍中角色首次对其造成非风属性（火、冰、电、物理、以太）伤害，形成对应属性的浸染……”并删去结尾的推导说明；效果 `condition` 同步改为“敌人处于风化状态且队伍首次造成非风属性伤害形成浸染”。文案依据见[角色专题](characters/severian_lowell.md)与官方维琳娜机制前瞻。
- 关键边界：只改文案，`imbuementDmgBonus` 10%、默认勾选与覆盖率口径不变；`system.imbuement` 仍保留旧文案并保持隐藏。单人风属性队伍仍无法实际触发浸染，默认按条件满足计算仍是偏乐观假设，但不再用“触发异常”表述。
- 验证：`test:maintenance-validation`、`test:severian-damage`、`test:webapp` 通过；8787 目录 API 回读新文案。

## 2026-11-22 — 赛维里安普通攻击疾锋技能组

- 问题：赛维里安此前只能把普通攻击：疾锋的一至四段分别加四个独立事件，不能作为一个按钮组合整体重复；按用户要求需要把这一套普攻收成一个技能组。
- 变化：在 `severian_lowell.skillGroups` 新增 `gale_edge_sequence`（显示名“疾锋1至4段（不含第四段极限闪避分支）”，`defaultCount` 1、`minCount` 0、`step` 1），子事件为 `basic`/`basic_move_1` 的 `row_1`（一段）、`damage_2`（二段）、`damage_3`（三段）、`damage_4`（四段），全部 `kind: "direct"`、`count: 1`、`stunned: true`、`critMode: "expected"`。第四段取普通命中，`basic_gale_edge_dodge_fourth`（第四段极限闪避成功）保持独立替代招式，不并入组内，避免多段合计时重复求和。同步[角色专题](characters/severian_lowell.md)的取值边界、默认目标与交付核对，并把专属测试的“无技能组”断言改为校验组结构、展开结果与替代段排除。
- 关键边界：技能组只表达四段倍率本身，不含极限闪避成功后的倍率提升、流息累积、无敌帧、动作时间或段数打断判定，也不复制第四段替代招式；默认循环不引用该组，仍直接使用原四个事件（技能组重复次数由工作台选择）。
- 验证：`test:severian-damage`（用 `tmp/` 中性化 `hidden` 断言的副本通过；原命令仍因工作区既有 `hidden` 冲突在首条断言失败）、`test:maintenance-validation`、`test:repository-integrity`（201 项目录资源）、`test:calculation-skill-groups`、`test:catalog-loader`、`test:damage-whitebox`、`test:compiled-score`、`test:optimizer`、`test:default-calculation-config`、`test:maintenance-api` 通过；`node tmp/verify_severian_skillgroup.mjs` 确认维护校验、清洗与严格展开为四行。均为本地检查，不代表远端 CI 或生产验收。

## 2026-11-22 — 赛维里安浸染独立乘区

- 问题：赛维里安作为风属性角色可吃到浸染的 10% 独立乘区，但通用条目 `system.imbuement` 隐藏，工作台选不到。
- 变化：在 `severian_lowell.combatBuffs.skillBuffs` 新增 `imbuement`（`imbuementDmgBonus` +10%，`defaultChecked: true`，覆盖率默认1，只作用于普通、贯穿、锐化直伤）。与洛克茜额外能力可同时选择，沿用既有“同类取最高”，不叠加；`system.imbuement` 保持隐藏且未改。
- 关键边界：默认循环因此整体 ×1.1，默认按“敌人已风化、队伍首次造成非风属性伤害形成浸染”计算，而该角色无默认队友，属偏乐观假设。来源不是技能，故不挂 `sourceSkillRef`，改用 `source` 标签“异常效果”，界面显示“异常效果｜浸染”；为此放宽 `skillBuffs` 校验（无 `sourceSkillRef` 且有来源标签即合法，半填的技能引用仍报错）、服务端清洗（有标签且未选技能时不写空引用）和维护页编辑器（新增“来源标签”输入与“无”目录选项）。
- 验证：`test:severian-damage`（用 `tmp/` 中性化 `hidden` 断言的副本通过；原命令仍因工作区既有 `hidden` 冲突失败）、`test:maintenance-validation`、`test:repository-integrity`、`test:damage-whitebox`、`test:compiled-score`、`test:optimizer`、`test:default-calculation-config`、`test:maintenance-api`、`test:enka-import`、`test:field-buffs`、`BuffPickerModal.test.ts`、`combatBuffs.test.ts` 通过；`test:webapp` 1047 项中仅工作区既有的 `draft.hidden` 断言失败。本地检查，不代表远端 CI 或生产验收。

## 2026-11-22 — 赛维里安默认计算循环

- 问题：赛维里安（`severian_lowell`）此前按约定没有 `defaultCalculationConfig`，工作台只能从单个手动事件起步，与用户当前要求的固定循环不符。
- 变化：按用户要求新增默认循环“0影2强普2连携1大招1强特”（`mode: "custom"`、`cinemaLevel: 0`、本配置无 `variants`）：普通攻击：苍风影猎（`basic`/`basic_move_3`/`row_1`）×2、连携技：冽刃收割（`chain`/`chain_move_1`/`row_1`）×2、终结技：戮灭的风灾（`chain`/`chain_move_2`/`row_1`）×1、强化特殊技：瞬风裂毁（`special`/`special_move_2`/`row_1`）×1，四个事件均为 `direct`、`stunned: true`、`critMode: "expected"`，同类事件合并为一个 `count`。同步[角色专题](characters/severian_lowell.md)的“默认计算目标”与“交付核对”，并把专属测试中“无默认配置”的断言改为校验事件结构。
- 关键边界：按期望暴击和失衡状态计算，不模拟 `[流息]` 上限与回复（苍风影猎×2 只看倍率）、烁影/凭风/风起、自动闪避、无敌帧、喧响和计时器。强化特殊技的 `row_1`（组合技伤害倍率）与 `damage_2`（风刃最大伤害倍率）是点按与长按两种互斥用法，默认循环按用户要求的点按组合技只取 `row_1`，不叠加长按风刃；`energy_cost_*` 与 `daze_*` 行不入循环。技能组与 `defaultTeammates` 仍不创建，其他角色条目未改动。待核实：本次只改默认循环，未处理工作区中角色/专武 `hidden` 标记的未提交改动，因此角色专题“验收边界”的“继续隐藏”与专属测试的 `hidden: true` 断言仍需与那次改动一并核对。
- 验证：本地 `test:maintenance-validation`、`test:repository-integrity`（201 项目录资源）、`test:catalog-loader`、`test:skill-targets`、`test:percent-sanity`、`test:effect-rule-targets`、`test:field-buffs`、`test:boss-catalog`、`test:default-calculation-config`、`test:calculation-skill-groups`、`test:maintenance-api`、`test:enka-import`、`test:damage-whitebox`、`test:compiled-score`、`test:optimizer` 与 `build:webapp` 通过；`node tmp/verify_severian_loop.mjs` 确认新配置能通过维护校验、清洗不丢字段，并解析出四个事件与`selectedEventId`。`test:severian-damage` 中新增的默认循环断言通过（用 `tmp/` 里仅中性化 `hidden` 断言的副本验证）；原命令仍在 `agent.hidden`/`weapon.hidden` 两条断言失败，`test:webapp` 亦在 `maintenance-model.test.ts` 的 `draft.hidden` 断言失败——两处都是工作区既有 `hidden: false` 与测试 `hidden: true` 的冲突，不由本次默认循环改动引起。均为本地检查，不代表远端 CI 或生产验收。

## 2026-11-19 — 危局强袭战 3.3 第三期场地 Buff 与敌情

- 问题：3.3 版本第三期危局（2026-11-20 04:00 至 2026-12-02 03:59）此前未入库，场地页签与 Boss 页签在 3.3 只能默认到第二期，第三期的场地 Buff 与敌情数据缺失。
- 变化：依据 [nanoka.cc/boss/690501](https://zzz.nanoka.cc/boss/690501) 页面内嵌来源 JSON（`https://static.nanoka.cc/zzz/3.4.4+20539349/zh/boss/690501.json`，周期 2026-11-20 04:00 至 2026-12-02 03:59），在 `data/combat_buffs.json` 新增三条 `field.critical_assault.v3_3.p3.*` 场地 Buff（`fieldBuffs` 共 60 项）：**掠霜**建模风属性伤害 +30% 与风属性伤害抗性无视 30%，以及 `[强攻]` 特性暴击伤害 +40%、`[普通攻击]` 伤害 +50%；**奔霆**建模防御力 +10%（按局外防御力）、锐化伤害 +15%，以及发动 `[强化特殊技]`/`[特殊技]`/`[终结技]` 后电属性与风属性伤害 +20%（持续 15 秒，独立覆盖率）；**极魄**建模 `[异常]` 特性攻击力 +10%（按局外攻击力）与触发式属性异常伤害 +20%（持续 20 秒，独立覆盖率）。`data/bosses.json` 新增本期四条敌情：熔狱行赭（`boss_encounter.molten_hunt.v3_3.p3`）、库萨里库（`boss_encounter.kusariku.v3_3.p3`）、焚昼余火·法厄同（`boss_encounter.scorched_horizon_phaethon.v3_3.p3`）与异构·基塔布鲁（新建 `boss.integrated_girtablullu.v3_3` 记录及 `boss_encounter.integrated_girtablullu.v3_3.p3`）；Boss 目录 25→26、敌情 34→38，未新增图片资源。异构·基塔布鲁本期目标数据（弱点风/火）与此前记录（弱点与抗性均为空）不同，按维护手册新建带版本后缀的 Boss 条目，旧条目保持原样。
- 关键边界：火属性和风属性异常积蓄效率、全队获得 20 点能量、`[紊相值]` 积累、操作得分、部位破坏、失衡与触发冷却等未建模机制只保留在逐字来源文本中，不生成效果规则；`[紊相]` 按固定窗口描述，触发类效果使用独立覆盖率而不推导触发时机。同一来源页面还包含 `zone_type 1002` 模式（mode 690502）的异构·基塔布鲁阶段；3.2 第三期、3.3 第一期与第二期均按 `critical_assault` 记录该阶段，本期沿用。场地页默认期依据“同版本取最高期号”变为 `危局强袭战 · 3.3版本 · 第三期`，默认显示不等于自动勾选，旧期内容与用户勾选保持不变。待核实：`boss.integrated_girtablullu` 与 `boss.integrated_girtablullu.v3_2` 的弱点/抗性为空，而本期来源为风/火，未回溯修改旧期数据；掠霜、奔霆、极魄的拼音 ID（`lueshuang`、`benting`、`jipo`）为本项目命名，来源无拼音依据；熔狱行赭本期敌情文本与第二期相同，仍按各期独立条目录入。
- 验证：本地运行 `test:field-buffs`（新增 3.3 第三期数值与排除断言）、`test:boss-catalog`（Boss 26、敌情 38、条目 69、效果 82 基线）、`test:maintenance-validation`、`test:skill-targets`（技能目标 122→123）、`test:percent-sanity`、`test:effect-rule-targets`、`test:catalog-loader`、`test:repository-integrity`（201 项目录资源，无新增资源）、`test:default-calculation-config`、`test:maintenance-api` 与 `build:webapp`；`BuffPickerModal.test.ts` 71 项通过，真实目录默认 `critical_assault|3.3|3`。均为本地检查，不代表远端 CI 或生产验收。

## 2026-11-19 — 防卫战第二期与隐藏赛维里安整合

- 问题：防卫战3.3第二期与赛维里安停留在旧分支，main未包含这批资料；角色初稿存在核心成长未引用、暴击率转攻击力静默失效、六影错录、多段技能仅采首值与专武导入缺失。
- 变化：从当前main增量加入「岚火燎天」「炽阳焚夜」「极凛破界」（场地共57项，来源 Nanoka `3.4.3+20291004/zh/shiyu/62061.json`）；修订后加入[赛维里安](characters/severian_lowell.md)、禁罪囚笼、头像/缩略图及生成的Enka映射。核心效果读取七档成长；额外能力允许全局暴击率转固定攻击力并先于伤害公式计算；六影对完整苍风影猎固定加350个百分点；技能保留39行来源资料，另派生一影登场替代招式，补齐支援/强化特殊技标签。专武使用官方词条2305，旧ID14163兼容；同风、影画和专武触发效果有独立覆盖率。新增来源快照、角色专题、专属算例与浏览器测试，并把多行提取、公式支持范围和ID区分补回手册。
- 整合边界：按角色/目录条目提取，原main所有既有记录逐项保持相同；旧分支对其他角色的影画说明/空条目删除及其配套测试不混入此次防卫战和赛维里安交付，保留本会话已确定的当前main规则。三/五影只保留说明，六档影画说明齐全；不创建管理员循环、技能组或队友预设。角色与专武均为 `hidden: true`，工作台、优化器选择和公开Enka导入继续隐藏；维护页保留编辑入口。不模拟资源、自动闪避和时间线，苍风影猎只支持完整招式加算，不伪造末击基础倍率；场地Buff不模拟触发时间与计分。没有生产晋级。
- 验证：完整 `npm test` 通过（前端79个文件、1045项）；`build:webapp`、缩略图179项与201项目录资源检查通过。角色专项覆盖独立算例、核心/影画/精炼档位、合法和排除目标、旧ID兼容、普通/compiled/indexed/dense/固定套装以及独立穷举Top10、Node Worker；桌面1440和移动390共6项浏览器检查通过，包含维护保存回读、隐藏状态与真实浏览器Worker。均为本地验证；远端检查以PR运行结果为准。

## 2026-11-18 — 蕾米埃尔头像改用本地资源

- 问题：蕾米埃尔·丹的角色头像仍指向官方远程链接，未使用仓库已有的本地头像和缩略图；手册误记为本地资源缺失。
- 变化：重新下载官方头像，确认其 SHA-256 与已提交的 `webapp/public/assets/agents/remielle_dan.png` 一致；将角色的 `images.portrait` 改为 `/assets/agents/remielle_dan.png`，与队友条目复用同一资源；重新生成缩略图，并移除手册中已解决的偏差。
- 关键边界：原图为 300×300 PNG，缩略图为 192×192 WebP；重新生成后的图片、清单和内容哈希均无变化。保留官方来源链接，不改变角色机制或计算配置。
- 验证：本地 `test:repository-integrity`（199 项目录资源）、`test:maintenance-validation`、`test:remielle-teammate-buffs`、`test:luminescence` 与 `build:webapp` 通过；构建内缩略图检查通过（177 张），并查看生成的缩略图确认内容完整。未运行浏览器端到端测试，不代表线上验收。

## 2026-11-18 — 手册偏差处理与三个队友条目

- 问题：手册第十一节列出的偏差：dodgeCounter、assistAttack、dashAttack、exSpecial 标签在 20 个招式上漏标（`dodgeCounter` 晚于 7 个旧角色加入且未回填，其余是新角色没有按既有写法补标），以这些标签为目标的音擎与套装增伤会漏算；简和菲欧妮的头像写在 `images.icon`，维护页编辑器绑定 `portrait`；菲欧妮、薇薇安、克拉蕾的全队效果没有队友条目（原先的测试和文档明确写“不建立灼蚀队友 Buff”，现按用户决定改为必须建立）。
- 变化：按招式名前缀补齐 20 个招式的标签（闪避反击 7、快速支援与支援突击 8、冲刺攻击 2、强化特殊技 3）；简和菲欧妮改用 `images.portrait`，`officialPage` 地址已在 `sources` 中，不再单独保存；新增三个队友条目：菲欧妮（灼蚀异常暴击率与暴击伤害，核心 F 级、额外能力 +15%、影画一 +25%，外部初始异常掌控默认 255）、薇薇安（额外能力全队侵蚀伤害与紊乱 +12%，影画一预言易伤 +16%）、克拉蕾（残锋锐暴伤害 +25%，仅锋御主控生效）；新增 `test:teammate-team-effects` 并接入 `npm test`；`test:skill-targets` 增加招式名前缀与标签对应检查，`test:maintenance-validation` 增加角色 `images.portrait` 检查；`test:formula` 与 `test:fioni-damage` 的队友目录断言同步。
- 关键边界：补标会改变装备了这些音擎或套装时相关角色的计算结果：防暴者Ⅵ型、旋钻机-赤轴、残心青囊、如影相随、极地重金属现在作用于克拉蕾和维琳娜的冲刺攻击，鎏金花信与混沌爵士作用于维琳娜的强化特殊技，混沌爵士的支援增伤作用于爱芮、佩洛伊斯、维琳娜、艾莲、南宫羽、菲欧妮、猫又的快速支援与支援突击；标签依据是官方招式名前缀，未逐一用游戏内实测核对。克拉蕾残锋条目目前没有可见的实际使用者（目录中只有她自己是锋御）。菲欧妮外部掌控默认 255 是项目假设。星见雅、爱丽丝的队友条目按用户决定暂不建模；南宫羽等既有队友 Buff ID 不改名。
- 验证：完整 `npm test` 通过（前端 79 个文件、1043 项用例），缩略图 `--check` 通过（177 张）；队友条目的独立算例覆盖菲欧妮掌控 0 至 400 的暴击率分段、三条效果叠加、不命中紊乱、命中乱流，薇薇安侵蚀与非侵蚀的区分，克拉蕾对锋御与非锋御主控的区别。未运行浏览器端到端测试，不代表线上验收。

## 2026-11-18 — 角色建模手册

- 问题：新角色常在录入后经多轮返工才达到预期。原因之一是既有建模习惯没有成文：生成者只能从 20 个已有角色里猜写法；专武和 Enka 映射在指南里各只有一句话；效果清单要求填写却不存档；已有数据在命名、影画 Buff 档位、默认方案取值上互不一致。
- 变化：新增[角色建模手册](character-modeling-handbook.md)：生成顺序与分诊、交付包清单（含专武、队友条目、Enka、头像、测试基线）、命名与标识约定、原文句式到数据结构的对照、技能表与默认方案规则、专武和 Enka 流程、推荐配装模板、询问边界和已知偏差。AGENTS 路由表、文档索引、制作指南和角色模板同步链接；模板新增必填的效果清单表和“交付核对”一节。约定均来自 20 个已有角色数据的横向比对和已确认的用户决定。
- 关键边界：只改文档，不改数据；手册第十一节列出与新约定不一致的现有数据（技能标签漏标、队友条目缺失、图片字段不统一），它们是否有意待核实。Enka 上游缺失时让角色保持隐藏是本次采用的假设，尚待用户确认。
- 验证：新增文档与相关入口共 96 个相对链接和锚点逐一核对无失效；`test:repository-integrity` 与 `git diff --check` 见本次提交；未运行业务测试。

## 2026-11-18 — 克拉蕾终结技类型、Enka 映射与影画默认启用修正

- 问题：克拉蕾「终结技：血华誓·千锤百炼」的 `skillType` 误存为 `chain`，通用终结技增伤漏算、通用连携技增伤误算；菲欧妮专武（Enka 14164）及另外 28 个目录音擎没有 Enka 映射，Enka 导入时提示音擎无法映射；映射文件靠手工补丁维护，生成脚本在固定提交上无法重新生成（11号、希格莉德缺名称覆盖），简的映射名与目录名不一致；13 个影画 Buff 带有无效的 `defaultChecked: true`（运行时按影画等级自动启用，不读取该字段），维护页还提供了会误导的“默认启用”开关。
- 变化：克拉蕾终结技改为 `ultimate`，影画四的精确目标和一处测试输入同步；`ENKA_METADATA_COMMIT` 升至 `9780bb7`，补两个名称覆盖后用 `update-enka-metadata.js` 重新生成（新增 29 个音擎映射，简的名称改为“简·杜”）；13 个影画 Buff 的 `defaultChecked` 改为 `false`，维护页移除影画 Buff 的“默认启用”开关，维护校验拒绝影画 Buff 的 `defaultChecked: true`。新增三项自动检查：“终结技：”招式类型、可见角色与音擎的 Enka 映射覆盖、目录中无默认启用的影画 Buff。
- 关键边界：未改任何公式；影画 Buff 仍按所选影画等级自动启用。星见雅、爱丽丝以及薇薇安、克拉蕾、菲欧妮的全队效果尚未建立队友条目，另行处理。dodgeCounter、assistAttack、dashAttack、exSpecial 标签在部分角色招式上缺失，仍待核实游戏语义，本次未改。Enka 映射的生成输出会重排原先手写的角色条目顺序，语义差异只有简的名称。
- 验证：完整 `npm test` 通过（前端 79 个文件、1043 项用例），`npm run build:webapp` 通过；`test:skill-targets`、`test:enka-import`、`test:enka-server`、`test:maintenance-validation` 含新增检查；未运行浏览器端到端测试，不代表线上验收。

## 2026-11-18 — 异放影画修复与回归入口补齐

- 问题：南宫羽六影方案使用旧门槛字段，二影常量成长未进入公式求值；工作台缺少南宫羽层数方案选择器。佩洛伊斯元数据仍引用已移动文档，艾莲集成测试未进入默认测试链。
- 变化：迁移南宫羽八个方案的门槛字段，运行时兼容旧名，维护保存拒绝冲突；七档常量按当前构筑影画进入普通、白盒、倍率预览、暴击附加公式、编译和区间评分。维护页增加七档数值编辑，工作台为多方案异放显示受影画门槛约束的选择器。修正文档路径并增加引用检查，南宫羽专项与艾莲集成测试接入 `npm test`。
- 关键边界：保留当前人工维护目录，仅修改八个门槛字段及一处文档路径；简和南宫羽仍无人工技能组。核心四层颤音在0/1影乘2，2–6影乘2.4，六影颤音改仍乘2；未增加自动时间轴、联合优化或游戏实测结论，见[南宫羽边界](characters/nangongyu.md#未建模边界与测试覆盖)。未提交、推送或部署。
- 验证：完整 `npm test` 通过（包含79个前端测试文件、1043项用例），前端构建通过；南宫羽专项核对独立倍率、固定套装上界、64套独立穷举Top 10及Node/浏览器运行时路径。真实Chrome通过五种尺寸的15项南宫羽浏览器用例，覆盖方案选择与持久化、临时目录保存回读、控件边界和Worker连续影画计算；`test:layout -- -- layout.e2e.ts fioni-modeling.e2e.ts --workers=1`另通过72项、按既有条件跳过8项（包含匹配到的计算弹窗布局文件）。159处本地文档链接检查及 `git diff --check` 通过。均为本地验证，不代表线上验收。

## 2026-11-18 — 文档体系重组

- 问题：现行文档约 8.4 万 token，仅回归契约就占约 2.2 万；角色专属规则散落在回归契约、制作指南和专题里；变更日志日期乱序、验证行冗长；部分内容与代码或数据不符；已提交的 `tmp/` 调查产物会干扰检索；周期目录维护（每期场地 Buff 与 Boss）没有操作文档。
- 变化：
  - 入口：[AGENTS.md](../AGENTS.md) 增加项目概览、代码布局和任务路由表（角色与计算 / 周期目录维护 / 界面与本地功能 / 发布与部署）；本文档索引降级为分工与格式标准；双语 README 的文档区只链接索引，更新摘要保留最近五条。
  - 结构：10 个角色/机制专题与新增的 8 个角色文件移入 `docs/characters/<角色ID>.md`（低优先级，按[角色索引](characters/README.md)读取）；回归契约重写为跨角色不变量（476 行降到 135 行）；建模说明翻译为中文并并入通用的紊乱/乱流规则与乘区归属；新增[周期目录维护手册](catalog-maintenance.md)；本地数据工具与驱动盘性能合并为[本地数据](local-data.md)；布局契约按功能重组；部署管理器与恢复手册翻译为中文并去掉与门禁表重复的内容；本变更日志按日期倒序，2026-10-01 至 13 日的条目移入[归档](archive/changelog-2026-10.md)。
  - 修正：发布手册新增工作流门禁表与 Resume 前置步骤；分页（可选 5/10/20/50，选盘弹窗 20）与切回标签页重读、顶栏高度变量、菲欧妮灼蚀作用范围、简与南宫羽无人工技能组、异常三档说明等与代码或数据不符之处。
  - 移出：已提交的 `tmp/` 和根目录 `.tmp_*` 调查产物（58 个文件），并加入忽略规则。
- 关键边界：不改代码或数据。文档记录了几处与实现不符、需另行处理的问题：南宫羽异放方案的六影门槛（数据字段 `minCinemaLevel` 与代码读取的 `minimumCinemaLevel` 不一致）和二影常量成长（`cinemaValues` 无人读取）已在[南宫羽](characters/nangongyu.md#已知缺陷)记录并给出复现命令；顶栏高度变量窄屏不更新、`tests/ellen-integration.test.js` 未接入 `npm test`、`data/agents.json` 佩洛伊斯记录的 `modelingNotes` 仍指向已移动的旧路径 `docs/pyrois-modeling.md`，均仅记录，未修改。
- 验证：本地运行 `test:repository-integrity`、`validate-deployment-config.js`、部署工作流与超时测试、临时链接与锚点检查（42 个文件 0 失效）和 `git diff --check`；未运行业务测试，不代表远端 CI 或生产验收。

## 2026-11-06 — 危局强袭战 3.3 第二期 Boss 与场地 Buff

- 问题：3.3 版本第二期危局（2026-11-06 至 2026-11-20）此前未入库，场地页签与 Boss 页签在 3.3 只能默认到第一期。条目收尾时用户在维护页调整了锋蚀的穿透率规则，本次按维护页保存结果发布。
- 变化：依据 [nanoka.cc/boss/690491](https://zzz.nanoka.cc/boss/690491) 页面内嵌来源 JSON（`https://static.nanoka.cc/zzz/3.4.2+20052336/zh/boss/690491.json`，周期 2026-11-06 04:00 至 2026-11-20 03:59）与用户提供的游戏内截图，在 `data/combat_buffs.json` 新增三条 `field.critical_assault.v3_3.p2.*` 场地 Buff（`fieldBuffs` 共 54 项）：**灼曜**建模 `[异常]` 特性攻击力 +10%（按局外攻击力）、触发后全队异常精通 +30 点与属性异常伤害 +10%（持续 15 秒，独立覆盖率）；**岚劫**建模风属性伤害 +40%、风属性暴击伤害 +40%，以及 `[强攻]` 特性攻击力 +25% 与 `[普通攻击]` 伤害 +40%；**锋蚀**建模电属性伤害 +30%、锐化伤害 +10%、穿透率 +20%（维护页后续调整为不限定特性）与 `[强攻]`/`[锋御]` 特性 `[特殊技]`/`[强化特殊技]` 伤害 +30%（按特性拆成两条同值规则）。`data/bosses.json` 新增本期四条敌情与区域增益：僭越者（`boss.hollow_venger`，弱点火/抗性冰）、熔狱行赭（在既有 Boss 上追加本期敌情）、自律强袭单位·「提丰·破坏者型」（`boss.typhon_destroyer`，弱点电/风/抗性火）与复写体·猎血清道夫（本期弱点火/风、抗性物理，因目标数据不同新建 `boss.replica_blood_hunter_janitor.v3_3` 版本条目；3.1 条目保持不变）；Boss 目录 22→25、敌情 30→34，并新增三张本地 Boss 头像。
- 关键边界：火属性异常积蓄效率、异常积蓄效率、失衡值提升/积累、部位破坏、能量、支援点数、抗打断与操作得分等未建模机制只保留在逐字来源文本中，不生成效果规则；站点占位标题 `(Test1)TBD` 不作为 Buff 名称，条目按机制命名；维护页将锋蚀的 `[锋御]` 重复穿透率规则并入一条不限定特性规则，本次按维护结果保留；`[强攻]` 或 `[锋御]` 无法由单条 requirement 表达，特殊技伤害按特性拆成同值规则；「无视首领 40% 防御力」按 `enemyDefIgnore` 处理；提丰抗性按来源元素表与游戏内截图记为火（来源 JSON 的 `monster_resistance` 为空），保留截图口径。只新增目录数据，不改变计算语义、弹窗布局或用户勾选；同版本更高期的场地数据优先，真实目录默认显示 `危局强袭战 · 3.3版本 · 第二期`，默认显示不等于自动勾选。待核实：3.3 第一期既有 `boss.ether_mutant_trivia` 与本期的僭越者引用同一个 nanoka 头像来源（`Monster_HollowVenger.webp`），且 3.3 第一期来源页的 69048101 现显示为僭越者；本期不回溯修改第一期数据，保留差异另行核对。
- 验证：本地运行 `test:field-buffs`、`test:boss-catalog`、`test:maintenance-validation`、`test:repository-integrity`（199 项目录资源，较基线新增三张头像）、`test:percent-sanity`、`test:skill-targets`（目标数 118→121）、`test:catalog-loader`、`test:effect-rule-targets` 与 `build:webapp`；`BuffPickerModal.test.ts` 71 项通过，真实目录默认 `critical_assault|3.3|2`。均为本地检查，不代表远端 CI 或生产验收。

## 2026-11-03 — 暂时隐藏猫又与浅羽悠真

- 问题：11-01 重建 PR81 时将尚未核对完毕的[猫又](characters/nekomata.md)、[浅羽悠真](characters/asaba_harumasa.md)与已交付的[伊芙琳](characters/evelyn_chevalier.md)一并写入 `main`；前台工作台因此可选中未完成核对的角色。
- 变化：仅将两人目录记录改为 `hidden: true`，沿用维护页「首页/优化器显示」开关。模型、技能、Buff、头像、Enka 映射和测试算例保留；伊芙琳保持可见。
- 关键边界：不撤回角色内容，不隐藏专武钢铁肉垫、残心青囊；维护页仍可编辑。工作台、优化器和 Enka 导入不再列出这两人，已保存的浏览器配置不会删除。
- 验证：未在本条记录；提交进入 `main` 后按发布手册走 Promote，不直接 push `deploy`。

## 2026-11-01 — 补全伊芙琳技能倍率表

- 变化：补齐普通攻击、闪避攻击、支援和普通特殊技，共14个带倍率表的招式、42行数值；目录仅保存核对后的最终1–16级数值，现有四个招式的ID及倍率保持兼容。
- 范围：遵循[伊芙琳专题](characters/evelyn_chevalier.md)的普攻火伤约定；不新增技能组、重复状态倍率、六影追击事件或相关Buff。保留当前单次终结技默认目标及人工维护的角色描述。
- 验证：本地完整 `npm test`（前端 1041 项）与前端构建通过；专项覆盖倍率、排除目标、独立算例、分段合计、各评分路径、独立穷举 Top 10 及 Node/浏览器 Worker；Playwright 在隔离数据副本验证技能资料保存回读和工作台刷新恢复。均为本地验证。

## 2026-11-01 — 基于当前 main 重建 PR81 三角色分支

- 问题：PR81 后续分支 `58cfc0b` 落后于当前 main，包含旧异放接口和过时的目录测试基线，不能整体覆盖。
- 变化：以 main `b857be0` 为基线建立 `codex/pr81-characters-refresh`，迁入[猫又](characters/nekomata.md)、[浅羽悠真](characters/asaba_harumasa.md)、[伊芙琳](characters/evelyn_chevalier.md)及技能、默认目标、Buff、三把专武关联、头像/缩略图和 Enka 映射；接入直伤技能倍率乘算与如影相随定向两件套。保留原作者 George0590 与 GuanshanJoy 的贡献归属。
- 关键边界：按 ID 比较确认已有角色、技能记录保持不变，装备只修改三把专武和如影相随；未迁入旧南宫羽异放改造，未改变当前菲欧妮及 Release 接口。保留三角色已有来源版本、固定状态假设和未建模范围，不模拟时间轴或自动资源收支；没有推送、合并或生产发布。
- 验证：本地完整 `npm test`（前端 1041 项）、`build:webapp` 与缩略图校验通过；新增三角色独立算例、作用/排除目标、各评分路径、独立穷举 Top 10（含不足十套）、Node Worker、维护清洗和 Enka 解析映射检查。
- 浏览器验收：Playwright 在隔离目录副本验证三角色的维护保存回读、工作台选择与刷新恢复、1440/390px 无横向溢出，以及构建后 Worker 的 Top 10、进度、取消和复用；截图保存在本地 `output/`，不进入发布目录，不代表远端 CI 或线上验收。

## 2026-10-31 — 防卫战 3.3 第一期场地 Buff（补齐危局强袭战同期条目）

- 问题：3.3 版本第一期此前只有危局强袭战的炽陨、烁穹、极韵入库，防卫战 v5 同期没有场地 Buff；场地页签在 3.3 只能默认到危局强袭战。
- 变化：依据用户提供的游戏内截图与 [nanoka.cc/shiyu/62060](https://zzz.nanoka.cc/shiyu/62060)（页面内嵌来源 JSON `https://static.nanoka.cc/zzz/3.4.1+19851435/zh/shiyu/62060.json`，周期 2026-10-30 04:00 至 2026-11-13 03:59），在 `data/combat_buffs.json` 新增三条 `field.defense_v5.v3_3.p1.*` 场地 Buff（`fieldBuffs` 共 51 项）：**焚韵燃竭**建模火属性伤害 +20%（仅 `[异常]` 特性）与触发式属性异常伤害加成 +30%（触发后持续 20 秒，覆盖率可调）；**刃铠裂宸**建模锐化伤害加成 +20% 与防御力 +20%（按局外防御力）；**凝能霜爆**建模以太伤害 +20%、冰属性伤害 +20% 与暴击伤害 +40%（仅 `[强攻]` 特性）。场地页签沿用既有“同版本同阶段双模式并存时优先防卫战”的排序，因此真实目录默认显示 `防卫战 v5 · 3.3版本 · 第一期`。
- 关键边界：能量恢复、喧响值回复、敌人失衡恢复速度降低 15%（持续 15 秒）以及“每 20 秒可触发一次”的触发冷却只保留在机制描述中，未建模资源变化或自动覆盖率（[建模说明](modeling.md#范围与架构)明确不模拟能量、喧响值、资源转换与自动 Buff 覆盖率）；属性异常暴击触发条件保留为描述并由手动覆盖率表达，不自动推算触发。只新增目录数据，不改变计算语义、弹窗布局、分组或交互；默认显示不等于自动勾选，旧期条目与用户勾选保持不变。
- 验证：本地运行 `test:field-buffs`、`test:maintenance-validation`、`test:percent-sanity`、`test:skill-targets`、`test:repository-integrity`（193 项目录资源）与 `build:webapp`；`BuffPickerModal.test.ts` 覆盖真实目录默认 `defense_v5|3.3|1`。均为本地检查，不代表远端 CI 或生产验收。

## 2026-10-30 — 控制面审计期限放宽（#113）

- 变化：控制面审计超时由 30 秒调整为 90 秒，清理宽限由 15 秒调整为 30 秒；恢复流程 runner 总预算同步为 125 秒（120 秒执行加 5 秒终止）。详细期限只维护在[部署控制面说明](../deploy/production/README.md)和[恢复手册](../deploy/production/RECOVERY.md)。
- 验证：以 #113 的 CI 为准；期限校验见 `tests/production-deployment-timeouts.test.js`。

## 2026-10-29 — 发布前加固（清除数据保护、IndexedDB 备份测试与文档同步）

- 问题：`clearAllBrowserData()` 绕过全局库存锁直接删除 IndexedDB 与本地键，可能在存在可恢复 `personalDataRestore` 日志时清掉唯一的恢复前快照；完整备份此前只有 localStorage 路径的单测，IndexedDB 后端与真实浏览器恢复流程缺少回归入口；工作台右栏吸顶偏移仍写死像素。
- 变化：`clearAllBrowserData()` 参与全局库存锁，并在存在可恢复 `personalDataRestore` 日志时拒绝删除数据，提示刷新完成恢复后再清除；存储本身不可读时仍可清除，保留显式逃生入口。新增 IndexedDB 个人备份单测 `webapp/src/runtime/personal-backup-indexeddb.test.ts` 与浏览器完整备份/恢复 e2e `webapp/e2e/personal-backup.e2e.ts`；工作台右栏吸顶偏移改为 `calc(var(--app-topbar-height) + 18px)`；文档核对基准、布局契约、本地数据、回归条款与双语 README 摘要同步。
- 关键边界：不改变存储键、数据结构、IndexedDB 数据库/object store/版本、目录数据或计算语义；清除数据仍删除全部应用键并重建数据库，不触碰无关站点键；不改变发布流程和部署产物。
- 验证：本地 `npm test`（webapp 1032 项）、`test:layout:ci`（326 passed / 109 skipped）、`validate-deployment-config.js` 与 `build:webapp` 通过；`build:server`/`build:pages` 按 CI 命令复核。本地运行不代表远端 CI 或生产验收。

## 2026-10-28 — 工作台 Buff/事件交互与 Buff 选择弹窗（#111，收敛 #104–#106）

- 问题：工作台「局内 Buff」与事件摘要平铺、难以扫读；方案来源用普通单选按钮；Buff 弹窗所有说明和参数一次性展开，长列表难浏览；工作台也缺少统一的展开按钮与顶栏高度基准。
- 变化：局内 Buff 默认收起并持久化、按来源分组、标题显示已启用数量；事件摘要默认收起，开关固定在标题行；方案来源改为支持方向键的分段控件；Buff 弹窗改为一行一个 Buff、效果/特性筛选、已选置顶与页签计数、长技能列表折叠、固定宽高；新增 `ExpandToggle`、顶栏高度变量与工作台区块圆角/间距统一。
- 关键边界：**不改变布局结构**——工作台仍使用普通页面滚动，右栏仍为「面板 → 最终伤害 → 白盒」；既有右栏在 >1280px 下保留吸顶定位，偏移由 `--app-topbar-height` 派生，未新增吸顶、三栏等高、栏内滚动或结果优先；不包含吸附/响应式重排、视觉截图基线；#104 原布局改版与其前置依赖一并收敛到本 PR。
- 验证：本地 webapp 单测、构建、根目录回归和 Playwright 主题+布局/Buff 弹窗场景通过；远端 CI 以该 PR 检查为准。

## 2026-10-27 — PR #103 工作台结果栏与套装选择弹窗拆分（内部重构）

- 问题：`WorkbenchView` 同时承担左/中/右三栏与结果、白盒、套装弹窗逻辑，文件过大且样式在主视图与子组件间重复，后续工作台改版难以分层。
- 变化：右栏（面板 → 结果条 → 伤害白盒）抽成 `components/workbench/WorkbenchResultColumn.vue`；4/2 件套弹窗抽成 `components/workbench/OptimizerSetChoiceModal.vue`（草稿仅点“应用限制”提交）；共用区块样式移到全局 `styles/workbench.css`。
- 关键边界：纯内部重构，不改变计算、持久化键、右侧栏目顺序、弹窗草稿语义与视觉；保留 #93 任务清理、#94 结果恢复提示、#97“不预填 4 件套首套”行为；不包含吸顶布局、分段控件、Buff 弹窗改版等后续层。实现边界见[布局契约](frontend-layout-contract.md#工作台)。
- 验证：本地 webapp 单测、构建、根目录回归和 Playwright 主题+布局 19/19 通过；远端 CI 以该 PR 检查为准。

## 2026-10-26 — PR #102 驱动盘分析副词条收益条形图

- 问题：词条分析只有精确表格，难以一眼看出“再刷一条时哪个副词条收益最高”。
- 变化：在差异计算上方增加边际收益条形图，按每加一条副词条的伤害提升排序；最佳项常驻显示百分比，其余项在悬停或键盘聚焦时显示；攻击力百分比与固定值自动补 `%` /“（固定）” 区分；精确数据表与替换参考保留。完整规则见[布局契约](frontend-layout-contract.md#工作台)。
- 关键边界：只增加展示层，不改变分析计算与收益排序口径；无正收益时条长为 0 且不标记最佳；弹窗窄屏不得横向溢出；不包含抓包、数据文件或其他 UI 改版。
- 验证：本地 webapp 单测、构建、根目录回归和 Playwright 主题+布局 19/19（含分析弹窗深色可读性）通过；远端 CI 以该 PR 检查为准。

## 2026-10-25 — PR #101 工作台结果区细节与技能快捷设置

- 问题：面板区用两张表分别展示局外/局内，对照关系需要来回看；白盒推导全部展开、信息密度高；逐项调整技能等级步骤多；手动/已有套装评分与有效副词条分散在不同位置。
- 变化：面板改为一张「属性 / 局外 / 局内」表，只显示原始数值（不推导差值，任一侧无数据时显示 `—`）；评分与有效副词条分卡展示；白盒推导默认折叠并提供“全部展开/全部收起”；新增“全 Lv12 / 全满级”技能等级快捷设置；驱动盘空槽显示可点击占位。完整规则见[布局契约](frontend-layout-contract.md#工作台)。
- 关键边界：不改变伤害计算、配置结构与持久化键；快捷设置只在用户点击时批量写入有变化的类别并一次性持久化；面板不再用 0 冒充缺失的局内数据，也不展示任何增量结论。
- 验证：本地 webapp 单测、构建、根目录回归和 Playwright 主题+布局 19/19 通过；远端 CI 以该 PR 检查为准。

## 2026-10-25 — PR #100 设置与库存操作整理

- 问题：账号页是横向面板列表，当前账号不突出；库存工具栏常驻“刷新/批量导出”按钮，筛选条件多时看不到当前生效项；设置页的“清除网页数据”与普通存储信息混在一起，容易误触。
- 变化：账号改为卡片网格并突出当前账号；库存工具栏保留“扫描”为唯一主按钮，批量导出保留为常驻按钮，删除“刷新库存”按钮并改为切回浏览器标签页时自动重读库存；新增“已筛选”标签（可单独清除/全部清除）；设置页把清除网页数据移入页面末尾的红色危险操作区。完整规则见[布局契约](frontend-layout-contract.md#驱动盘仓库与设置)。
- 关键边界：只调整入口与呈现，不改变库存/账号数据语义；刷新行为改为标签页可见时重读当前账号库存（其他标签页改写数据不再需要手动按钮，同一页面内的外部改动仍需整页刷新）；筛选标签限宽换行，不得造成页面横向溢出；不包含后续工作台改版（pr6 链）的任何文件。
- 验证：本地 webapp 单测、构建、根目录回归通过；Playwright 主题+布局用例含 320px 长搜索词无横向溢出断言；远端 CI 以该 PR 检查为准。

## 2026-10-25 — PR #99 主导航滑块与窄屏可滚动导航

- 问题：主导航原来靠每个链接各自的选中底色，切页时没有连续反馈；窄屏下链接被压扁，空间不足时文字被裁切且导航不能局部滚动。
- 变化：主导航改为胶囊容器 + 当前页滑块，切页时用缓存的链接坐标只做 `transform` 动画（0.34s），首帧用静态选中底色兜底；尺寸、功能开关与最终路由变化时重新测量；`prefers-reduced-motion` 下关闭过渡并跳过切页等待。≤900px 导航恢复独立横向滚动，链接宽度由内容决定。完整规则见[布局契约](frontend-layout-contract.md#顶栏导航)。
- 关键边界：只改导航呈现与滚动容器，不改变路由、页面结构、计算、角色数据或本地偏好存储；滑块阴影改用 `tokens.css` 的 `--app-shadow-sm` 语义变量；不包含后续工作台改版（pr6 链）的任何文件。
- 验证：本地 webapp 单测、构建、根目录回归通过；Playwright 覆盖六个入口点击、`aria-current`、滑块对齐（≤2px）、320/360/390px 局部滚动与减少动画偏好；远端 CI 以该 PR 检查为准。

## 2026-10-24 — 本地数据与优化器体验批次（#91–#94、#96–#98）

- #91 完整个人备份/恢复：整份替换，提供预览、恢复前副本、`personalDataRestore` 事务日志与刷新启动恢复；范围包含浏览器级设置，不改变 IndexedDB schema 或数据库版本。规则见[本地数据工具](local-data.md#完整个人备份)。
- #92 普通导入撤销：只处理当前账号最近一次 JSON / 扫描导入，构造反向事务并核对导入后指纹；撤销会恢复导入时的当前角色，记录按账号隔离。规则见[本地数据工具](local-data.md#撤销普通导入)。
- #93 账号与优化任务隔离；#94 刷新恢复最近一次完整优化结果（最多 6 组，按目录与逐盘内容指纹校验；旧结果只用于查看与继续保存，临时结果从不保存）。
- #96 驱动盘分页（5/10/20/50，选盘弹窗固定 20，按有效副词条条数排序）；#97 优化器偏好语义（主词条显式空数组表示不限，旧版自动保存的空数组可能扩大搜索范围与耗时；两件套旧值按用户选择保留，不再被静默替换为推荐）；#98 首屏分包与级联选择器延迟初始化。
- 关键边界：批次包含用户可见的交互与性能变化（分页、刷新后恢复结果、偏好语义、首屏加载），但不包含数据文件、目录内容或服务端接口变更；#96/#98 只改变渲染与加载路径，#97 只改变优化约束解释与候选空间（可能改变优化方案与耗时，但不改变伤害计算口径），#94 只缓存既有完整结果。
- 验证：各 PR 的测试与构建结果见对应 PR 的检查记录；本次文档同步未重跑该批次，不把历史记录当作当前验证。分页与缓存边界见[回归契约](regression-contract.md#本地数据与账号)，偏好语义见[优化器](regression-contract.md#优化器)。

## 2026-10-24 — 菲欧妮精准优化剪枝修复

- 问题：默认异放事件叠加初始异常掌控→异常暴击率 clamp 公式后，固定套装 objective 内核无法给出异放区间上界，`releaseIntervalBound=false`，精准优化退化为全枚举；真实库存 283,708 组合实测约 186s。
- 变化：新增 `compileInitialMasteryAnomalyCritFormula` 白名单解析器，仅编译可证明单调的 `clamp(base + max(x - threshold, 0) * rate, 0, cap)`；固定套装 objective 内核以区间上界纳入该项，`releaseIntervalBound` 可为 true；严格优化器 metrics 新增 `releaseIntervalBoundEnabled` 与 `releaseBoundFallbackReason` 诊断。机制见[菲欧妮专题](characters/fioni.md#优化器)，验收边界见[回归契约](regression-contract.md#优化器)。
- 关键边界：只支持上述可证明形状，其他动态公式或无法证明的区间继续返回无限上界并全枚举；伤害语义不变，Top 10 与 `exact-legacy` 全等，`scoredCombinationCount + prunedBySuperBound === estimatedCombinationCount`。
- 验证：`npm test` 全部通过（含菲欧妮、固定评分、Worker、优化器与 WebApp 883 项）；`npm run build:server` 通过并生成绑定当前 SHA 的服务器制品。当前仍需通过远端 CI/CD 后才能视为生产发布。

## 2026-10-23 — CI 浏览器布局套件并行（#109）

- 问题：CI 的浏览器布局回归单进程运行，是发布检查的主要耗时项；部署配置静态校验仍要求旧的 `npm run test:layout`。
- 变化：新增 `test:layout:ci`（`npm --prefix webapp run test:layout -- --workers=2`），CI 在已完成的 `build:webapp` 之后用它运行布局套件，不重复根构建；`scripts/validate-deployment-config.js` 的必需命令同步为 `npm run test:layout:ci`。
- 关键边界：只影响 CI 并行度与静态校验期望，本地 `npm run test:layout` 语义不变，不改变生产行为、构建产物或部署流程。
- 验证：该 PR 同时更新了静态校验期望；实际布局通过数量以对应 CI run 为准，本文不预写结果。

## 2026-10-23 — PR #90 主题切换与深色可读性

- 问题：三态偏好只有运行时接口，没有用户按钮；工作台和部分弹窗的浅色硬编码导致深色文字不可读。
- 变化：参考本地“绝区零计算器”打包版的顶栏按钮交互，增加电脑/太阳/月亮三态切换；Naive UI 深色主题同步导入，移除独立下载、重试和启动等待，集中共享主题配置；修复工作台、选盘、分析、Buff、配置弹窗和库存的主题颜色。完整规则见[布局契约](frontend-layout-contract.md#深色模式与颜色变量)。
- 关键边界：沿用偏好存储键；只改变呈现，不改变计算、排序、角色数据、账号管理或工作台结构。没有引入其他待合并 PR 的导航动画或工作台重排；不宣称首屏减包或彻底消除闪烁。
- 验证：本地 WebApp 单测 911 项、类型检查与生产构建通过；主题浏览器聚焦测试 6 项覆盖 1440/390/320px、键盘、刷新、路由、系统变化、弹窗草稿和关键文本对比度；仓库完整性与链接检查通过；未在本地重跑完整计算与布局套件，未合并或部署。

## 2026-10-23 — 危局强袭战 3.3 第一期 Boss 与场地 Buff

- 来源：[nanoka.cc 690481](https://zzz.nanoka.cc/boss/690481)，本期为 2026-10-23 至 2026-11-06。新增炽陨、烁穹、极韵，以及特里薇亚、未知复合侵蚀体、薇斯珀、异构·基塔布鲁·滞变畸兽的本期敌情与 Buff。
- 场地和 Boss 选择器按最新版本默认显示 3.3 第一期；默认显示不等于自动选中，旧期内容和用户勾选仍保留。
- 炽陨队伍异常人数使用手动人数输入；触发增益使用独立覆盖率。火属性异常额外增伤只指定灼烧来源；极韵额外 25% 使用事件失衡条件。凋蚀印记两条增伤共享 0–3 层，锐化使用独立锐化伤害加成。
- 沿用现有快照模型，不模拟异常积蓄、失衡值积累与恢复速度、能量、喧响值、操作得分、部位和壁垒伤害。触发与持续时间保留在正常机制描述中，不自动推算覆盖率。
- 本次为独立工作树本地预览，不代表线上发布。
- 验证：本地运行场地数值回归、Boss 目录及层数回归、compiled-score、资源完整性；`BuffPickerModal.test.ts` 62 项与 WebApp 构建通过；真实浏览器确认两类筛选默认 3.3 第一期、三场地和四 Boss 可见、四张头像加载成功、页面无横向溢出。均为本地验证。

## 2026-10-16 — 防卫战 3.2 第三期 Buff 与默认选择

- 变化：新增鸣风刺电、秦音共振和刹那熔光三条场地 Buff，并让同版本同一期同时存在危局强袭战与防卫战时默认显示防卫战（默认选择规则见[周期目录维护手册](catalog-maintenance.md#一场地-buff)）。本条原只载于 README 更新摘要。
