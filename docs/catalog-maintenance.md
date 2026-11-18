# 周期目录维护手册

状态：现行操作手册。核对日期：2026-11-18；基准提交：`9d51640c23697a849bdd3674b7f645a30c9f76b0`。证据来自 `data/` 当前记录、相关测试和近几次真实改动（危局强袭战 3.3 第二期 `9d51640`、防卫战 3.3 第一期 `e01b1c9`）。

适用于每个版本周期的日常目录维护：危局强袭战与防卫战的**场地 Buff**、**Boss 与敌情**，以及新**音擎**和**驱动盘套装**。新增或修订角色见[角色制作指南](character-authoring-guide.md)；通用语义见[建模说明](modeling.md)。

## 开工前

- 检查分支、工作区差异和当前目录记录。维护页保存的修改和删除是需要保护的内容，以当前目录文件为准，不用旧导入器或旧测试去覆盖。
- 本地维护写入目录 JSON，保存不等于提交，也不会更新生产。收尾时按[回归契约](regression-contract.md#目录与维护)的要求核对保存回读和人工修改。

## 一、场地 Buff

数据在 `data/combat_buffs.json` 的 `fieldBuffs`（当前 54 项）。

**来源。** 近几期使用 nanoka 页面内嵌的来源 JSON（危局 `zzz.nanoka.cc/boss/<id>`，防卫战 `zzz.nanoka.cc/shiyu/<id>`）加用户提供的游戏内截图。把页面 URL、来源 JSON 的版本号和周期起止时间写进变更日志条目；逐字来源文本保留在记录的 `description`。

**记录结构**（以 `field.critical_assault.v3_3.p2.zhuoyao` 为例）：

| 字段 | 内容 |
| --- | --- |
| `id` | `field.<modeId>.v<主>_<次>.p<期>.<名称拼音>`；新建请求可省略，由后端按玩法、版本、期数和名称生成稳定 ID |
| `sourceType` / `scope` | `field` / `inCombat` |
| `period` | `modeId`（`critical_assault` 或 `defense_v5`）、`gameVersion`、`phaseNo`、`phaseName` |
| `name` / `source` / `sourcePeriod` / `description` | 均为 `zhCN` 文本 |
| `effects[]` | `type`、`target`、`stat`、`mode`、`basis`、`value`、`requirement`（特性/属性）、`coverage`（`default/min/max/step`） |
| `buffModifiers[]` | 当前均为空 |

**建模约定**

- 按机制命名，站点上的占位标题（如 `(Test1)TBD`）不能当作 Buff 名称。
- 火属性异常积蓄效率、失衡值、能量、喧响值、部位破坏、支援点数、抗打断、操作得分和触发冷却等未建模机制，只保留在 `description` 里，不生成效果规则（与[建模说明](modeling.md#范围与架构)一致）。
- “无视首领 X% 防御力”按 `enemyDefIgnore` 处理；以局外攻击力为基准的效果使用 `basis: outOfCombatAtk`。
- `[强攻]`、`[锋御]` 这类“或”条件无法由单条 `requirement` 表达时，拆成多条同值规则。
- 触发类效果使用独立覆盖率（`coverage`），不要推导触发时机。
- 来源 JSON 与游戏内截图冲突时保留截图口径，并在变更日志的“待核实”里写明差异（例：提丰的火抗性，来源 JSON 的 `monster_resistance` 为空）。
- 条目收尾时如果用户在维护页调整了内容，按维护页保存结果提交，并在变更日志写明（例：锋蚀的穿透率规则）。

**默认显示。** `BuffPickerModal.vue` 的 `fieldPeriodOptions` 决定：先取最新版本，再取最高期号，同版本同期两种玩法并存时防卫战优先。默认显示不等于自动勾选，旧期内容和用户勾选保持不变。

## 二、Boss 与敌情

数据在 `data/bosses.json`（当前 25 个 Boss）。

- Boss 记录：`id`（`boss.<slug>`）、`name`、`aliases`、`images`（`icon`、`source`）、`target`（`defense`、`weaknessElements`、`resistanceElements`、`resistanceOverrides`）、`encounters[]`、`hidden`。
- 敌情记录：`id`（`boss_encounter.<slug>.v<版本>.p<期>`）、`appearances[]`（`modeId`、`gameVersion`、`phaseNo`）、`enemyIntel`、`recommendedSpecialties`、`playerBuffs`、`playerDebuffs`、`sources`、`hidden`。
- 同一个 Boss 在新一期的目标数据（防御、弱点、抗性）与旧期不同时，**新建带版本后缀的 Boss 条目，旧条目保持不变**（例：`boss.replica_blood_hunter_janitor.v3_3`）；目标数据相同时，在既有 Boss 上追加 `encounters` 即可。
- 头像放在 `webapp/public/assets/bosses/<slug>.webp`，记录里写 `images.icon: "/assets/bosses/<slug>.webp"` 和 `images.source`。仓库完整性测试会校验所有 `/assets/...` 引用文件存在；最近一次新增 Boss 头像（`9d51640`）没有改动缩略图清单。

## 三、音擎与驱动盘套装

- 数据在 `data/w_engines.json` 和 `data/drive_disc_sets.json`，图片在 `webapp/public/assets/w-engines`、`drive-discs`。新图片需要生成缩略图：`npm --prefix webapp run assets:thumbnails`；`npm run build:webapp` 会以 `--check` 校验缩略图是否最新。
- 音擎 `effect.description.zhCN` 必须按精炼 1→5 枚举全部五档（规则见[回归契约](regression-contract.md#目录与维护)）。
- 目录里存在不等于可由 Enka 导入：需要核对 `data/enka_zzz_mapping.json` 的 `wEngines`、`driveDiscSuits` 和别名适配。
- 相关测试：`npm run test:drive-disc-set-effects`、`test:w-engine-modification`、`test:attack-w-engines`、`test:anomaly-w-engines`。

## 新增一期时必须同步的位置

| 改动 | 同步修改 |
| --- | --- |
| 新增场地 Buff | `tests/field-buffs.test.js`（ID 表、`fieldBuffs` 总数、数值与作用范围断言）；新增了技能目标时更新 `tests/skill-targets.test.js` 的 `expectedTargetCount`；`webapp/src/components/BuffPickerModal.test.ts` 中真实目录的默认期断言 |
| 新增或修改 Boss/敌情 | `tests/boss-catalog.test.js`（Boss 数、敌情数、该期 Boss 清单、目标数值）；头像文件 |
| 任何新增的 `/assets/...` 引用 | `npm run test:repository-integrity` |
| 收尾 | [变更日志](changelog.md)新增条目：问题、变化、边界（含未建模机制和待核实项）、验证；写明来源 URL 与版本 |

## 验证命令

- 目录与计算：`npm run test:field-buffs`、`test:boss-catalog`、`test:maintenance-validation`、`test:percent-sanity`、`test:skill-targets`、`test:catalog-loader`、`test:effect-rule-targets`、`test:repository-integrity`。
- 界面：`npm run build:webapp`；`npm --prefix webapp run test -- --run src/components/BuffPickerModal.test.ts`。
- 这些是本地检查，不代表远端 CI 或生产验收；发布见[生产发布手册](production-deployment-runbook.md)。
