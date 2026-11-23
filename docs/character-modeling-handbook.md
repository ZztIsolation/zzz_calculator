# 角色建模手册

状态：现行写法约定。核对日期：2026-11-18；基准提交：`11eee162721c161dfcd02d351444eb708a834cf5`。

本手册回答“怎么把游戏原文写成本项目的数据”，目标是新角色首轮就按既有习惯建模完整，包括专武、Enka 映射、头像和队友条目。分工：通用语义见[建模说明](modeling.md)（模型怎么算），流程和交付要求见[角色制作指南](character-authoring-guide.md)，必须保持的不变量见[回归契约](regression-contract.md)，角色专属内容见[角色文档](characters/README.md)。

范例指向 `data/*.json` 里当前认可的写法，用“角色 / 字段 ID”定位；数据以文件当前内容为准，手册只给规则。维护页保存过的修改是需要保护的内容，不得因本手册改动已有角色，除非任务明确要求。

## 一、生成顺序

1. **资料核对**（[指南阶段一](character-authoring-guide.md#阶段一资料核对)），保存来源快照。
2. **填效果清单**：先写进 `docs/characters/<角色ID>.md` 的“专属机制与建模假设”，再动数据。表头见[指南阶段二](character-authoring-guide.md#阶段二机制映射)。
3. **分诊**：效果清单的每一行必须能对应到第四节的某个写法。对应不上的，说明需要扩展核心：先单独实现并带独立测试，再录数据。不得用最接近的现有字段凑数，也不得写代码不读取的字段（南宫羽的 `minCinemaLevel`、`cinemaValues` 曾因此静默失效）。
4. **按依赖顺序生成产物**：技能表 → 角色条目 → 专武 → 队友条目 → Enka 映射与头像 → 测试与基线 → 角色文件与变更日志。技能表在前，是因为 Buff 的 `sourceSkillRef` 和默认事件都引用招式 ID。
5. **自检**：第二节“自动检查”一列的命令必须全部通过；再按[指南阶段五](character-authoring-guide.md#阶段五验证验收)补独立算例。
6. **交付说明**：按[指南阶段六](character-authoring-guide.md#阶段六交付保护)的清单写。

## 二、交付包清单

一个角色的完整交付必须同时包含下表所有行；不适用的行要在角色文件里写明原因。

| 产物 | 位置 | 要点 | 自动检查 |
| --- | --- | --- | --- |
| 角色条目 | `data/agents.json` | 面板、核心、Buff、推荐盘、默认方案；规则见第三、四、六、八节 | `test:maintenance-validation`、`test:repository-integrity` |
| 技能表 | `data/agent_skills.json` | 每个角色一条，规则见第五节 | `test:skill-targets` |
| 专武 | `data/w_engines.json` | 绑定角色，规则见第七节 | `test:w-engine-modification`、`test:attack-w-engines`、`test:anomaly-w-engines` |
| 队友条目 | `data/combat_buffs.json` 的 `teammates` | 凡有全队效果的角色必须建，规则见第四节末 | `test:shared-combat`、`test:maintenance-validation` |
| Enka 映射 | `data/enka_zzz_mapping.json` | 由脚本生成，规则见第八节 | `test:enka-import`、`test:enka-server` |
| 头像和缩略图 | `webapp/public/assets/agents/`、`thumbs/` | `images.portrait` 指向本地文件，缩略图随之生成 | `test:repository-integrity`、`build:webapp` |
| 来源快照与 fixture | `docs/sources/`、`tests/fixtures/` | 官方结构化数据的原始快照，第九节；快照必须登记到[来源快照索引](sources/README.md) | 无 |
| 专属测试 | `tests/<角色>-damage.test.js`、`package.json` | 独立算例；脚本必须加入 `npm test` 链 | `npm test` |
| 目录基线 | `tests/skill-targets.test.js` | 招式数、倍率行数、标签统计、目标数的写死基线随新角色手工更新 | `test:skill-targets` |
| 角色文件 | `docs/characters/<角色ID>.md`、角色索引表 | 按[模板](characters/_template.md) | 无 |
| 变更日志 | `docs/changelog.md` | 问题 / 变化 / 边界 / 验证 | 无 |

新角色在资料或 Enka 上游未齐全时保持 `hidden: true`，齐全并验收后再取消隐藏。已隐藏角色不受 Enka 覆盖检查约束。

## 三、命名与标识

| 项目 | 规则 | 范例 |
| --- | --- | --- |
| 角色 ID | 官方英文名或拼音，小写蛇形；一经使用不得更改 | `anby_demara`、`soldier_11`、`nangongyu` |
| 专武 ID | `zzz_wiki_<官方词条ID>`；从旧语义 ID 迁移时把旧值放进 `legacyIds` | `zzz_wiki_2259`、`zzz_wiki_1908` |
| 效果 ID | 语义化 kebab-case，形如 `<角色>-<来源>-<效果>`；不新建 `effect-1` 这类自动编号 | `fioni-core-anomaly-proficiency` |
| 技能组 ID | 语义化 snake_case；`skill_group_<哈希>` 只由维护页生成，不手写 | `fire_suppression_string` |
| 队友 Buff ID | `<角色ID>.<core\|additional\|cinema_N\|skill>.<效果>`；已有的 `buff_<哈希>` 不改名，因为用户已保存的 Buff 选择按 ID 引用 | `velina.cinema_1.turbulence_res_ignore` |
| Buff 名称 | `核心被动：<名>`、`额外能力：<名>`；影画 Buff 用 `cinemaName` 写影画名 | `核心被动：涅槃` |
| 描述 | 逐字保留官方原文，数值档位用 `/` 连接；首行重复 Buff 名称 | 见 `fioni` 的 `corePassive` |
| 影画用词 | 一律写“N影”“影画N”，不写“命”“N命” | `0影…`，不写 `0命…` |
| 标点 | 名称和说明使用全角中文标点，`＋` 与括号都用全角 | `（长按普攻）` |

## 四、原文句式与建模写法

原文先落在“目标模式”：全局面板、指定招式、异常。三种模式各有自己的属性集合，可选项以 [`maintenance-options.ts`](../webapp/src/components/maintenance/maintenance-options.ts) 的 `PANEL_STATS`、`SKILL_TARGET_STATS`、`ANOMALY_TARGET_STATS`、`EVENT_STATS` 为准；不在集合里的属性不能录入，需要扩展核心。

| 原文句式 | 写法 | 范例 |
| --- | --- | --- |
| 核心被动按 A–F 成长的固定属性 | `corePassive.effects[]` 用 `type: fixed` 加 `valueSource: { kind: corePassiveScaling, field }`；档位表只写在 `coreSkill.corePassiveScaling`，`coreSkill.levels[]` 只放 A–F 节点白值和技能等级加成 | `fioni` / `fioni-core-anomaly-proficiency` |
| 造成的伤害提升 X%（无指定招式） | 默认目标：`target.kind: default`，`stat: dmgBonus` 或元素伤害（`fireDmg`、`iceDmg`…） | `soldier_11` / `prairie-fire-stunned-damage` |
| 对某类招式伤害提升 | `target.kind: skill`，`skillTargets` 按下面的招式分类选 `skillType`、`skillTag` 或 `specific` | `soldier_11` / `heat-wave-fire-suppression-damage` |
| 只对某几个招式或倍率行生效 | `skillTargets` 用 `specific`（`agentSkillId`、`categoryId`、`skillType`、`moveId`、可选 `rowId`），`skillType` 必须与招式一致 | `claret` / `claret-c4-selected-damage` |
| 暴击率、暴击伤害提升 | 面板：`critRate`、`critDmg`；只对指定招式：放在 `target.kind: skill` | `asaba_harumasa` / `harumasa-core-ultimate-crit` |
| 属性异常的暴击率、暴击伤害 | `target.kind: anomaly`，`stat: anomalyCritRate` 或 `anomalyCritDmg`，用 `settlementTypes` 限定结算类型，`anomalyEffects` 限定异常 | `jane_doe` / `jane-assault-crit-rate-from-proficiency` |
| 无视防御、降低防御、无视或降低抗性 | `enemyDefIgnore`、`enemyDefReduction`、各元素 `*ResIgnore`、`allResIgnore`、`enemyResReduction`；三类相互独立，不得互换 | `aria` / `release-delusion-def-ignore-8` |
| 每层提升 X%，最多 N 层 | `type: stacked`，`valuePerStack`、`maxStacks`、`defaultStacks`；同一机制的多条效果共用 `stackGroup` | `ellen_joe` / `storm-ice-damage` |
| 层数达到阈值才获得的效果 | 在 `stacked` 上加 `activationStacks`，值是固定激活量 | `ellen_joe` / `storm-potential-ice-res-ignore` |
| 持续 N 秒、触发后生效 | `durationSeconds` 和 `condition` 只作说明；是否生效靠 `coverage`，默认 1 表示已进入窗口，不自动推导覆盖率 | `soldier_11` / `high-temperature-convergence-damage` |
| 仅失衡状态下生效 | `requirement: { eventStunned: true }` | `pyrois` / `mirage-ultimate-crit-dmg` |
| 按某属性换算另一属性（每超过 X 点转 Y） | `type: formula` 或 `derived`，由公式引用面板；单位用 `valueUnit`；自动面板来源不增加重复手填控件 | `velina` / `velina-energy-damage-bonus`、`claret` / `claret-initial-crit-dmg-to-crit-rate` |
| 潜能 P1–P6 才有的效果 | `requirement.minPotentialLevel` / `maxPotentialLevel`；成长值用 `valueSource.kind: potentialVisionScaling`，档位表放 `potentialVision.scaling` | `jane_doe` / `jane-potential-assault-crit-dmg` |
| 影画 N 的效果 | `cinemaBuffs[]`，只为有建模效果的影画建条目；不写 `defaultChecked: true` | 见下 |
| 属性异常、异放、乱流 | `target.kind: anomaly` 的规则；异放表达式写在 `anomalyReleaseProfiles`，影画门槛用 `minimumCinemaLevel`，影画成长用 `cinemaValues` | `nangongyu`、`fioni`，语义见[建模说明](modeling.md#伤害与评分域) |
| 能量、喧响、动画时间、异常积蓄等资源 | 不建模：只留在描述，并写进 `verification.unsupportedMechanics` | 见 `sigrid` 的 `verification` |
| 全队、队伍中任意角色获得的效果 | 除写进本角色 Buff 外，还必须在 `teammates` 建条目，只放对队友生效的部分 | `fioni`、`vivian`、`jane_doe`、`velina` 的队友条目 |
| 依赖队友自身面板数值的效果（队友条目内） | `type: formula`，`source: { variable, label, defaultValue, min, max }`，默认取使效果达到上限的值，用户可改 | `jane_doe`（375）、`fioni`（255） |
| 只对某类定位的主控生效 | 效果规则加 `requirement.specialty`（或 `excludedSpecialties`） | `claret` / `claret_additional_remnant_edge_laceration` |

**核心、额外能力与影画的归属**

- 核心被动、额外能力默认启用，不写 `defaultChecked`；条件未确认的额外能力显式写 `defaultChecked: false`。
- 影画 Buff 由所选影画等级自动启用，不读取 `defaultChecked`，校验拒绝 `true`。
- `cinemaBuffs` 通常只有 1、2、4、6 影；3、5 影是技能等级加成，写进 `cinemaDescriptions`（六档齐全，建模过的标 `modeled`），不额外自动加等级，工作台技能等级输入是最终等级。
- 技能来源 Buff（`skillBuffs`）按真实来源归类，必须有 `sourceSkillRef`（来源不是技能的通用状态，如浸染，可省略它并改填 `source` 来源标签，显示为“异常效果｜浸染”），不因为原文提到招式名就新建独立开关；只有它使用 `defaultChecked: true`。

**招式分类**：`skillType` 与 `skillTags` 必须显式保存，不得由中文名或 ID 推断（[回归契约](regression-contract.md#目录与维护)）。名称与类型、标签的对应关系：

| 招式名前缀 | 分类 `category` | `skillType` | `skillTags` |
| --- | --- | --- | --- |
| 普通攻击、强化普攻 | basic | basic | 无 |
| 冲刺攻击 | dodge | dodge | `dashAttack` |
| 闪避反击 | dodge | dodge | `dodgeCounter` |
| 特殊技 | special | special | 无 |
| 强化特殊技 | special | special | `exSpecial` |
| 快速支援、支援突击 | assist | assist | `assistAttack` |
| 招架支援、反制支援 | assist | assist | 无 |
| 连携技 | chain | chain | 无 |
| 终结技 | chain | **ultimate** | 无 |

火力镇压（`fireSuppression`）、追加攻击（`followUp`）是人工标注的专属标签：没有原文依据不得添加，原文已说明才标。一个招式同时属于两种机制时标两个标签（例如简的强化特殊技同时是 `exSpecial` 和 `dashAttack`）。

**队友条目**：`teammates[]` 的 `id` 与角色 ID 相同，同时带 `name`、`attribute`、`specialty`、`images`（`images.icon` 指向与角色立绘相同的本地文件）；队友影画 Buff 的档位由 `source` 文本“影画N”或 ID 里的 `cinema_N` 识别，二者至少写一个；触发条件在描述末尾写“选中本 Buff 表示……已满足”；`buffs[]` 只保留对队友生效的效果，每条有 `id`、`source`、`description`、`scope`、`effects`、`buffModifiers`。角色自身 Buff 与队友条目里的效果必须口径一致，修改一处要同步另一处。

## 五、技能表

- 每个角色在 `agent_skills.json` 里一条：`id` 与 `agentId` 都是角色 ID，名称写 `<角色>技能倍率`。
- 大类 `categories[].id` 取 `basic`、`dodge`、`assist`、`special`、`chain`；核心技、额外能力、影画里有独立伤害的招式才另加 `core_skill`、`additional_ability`、`cinema`。
- 招式名写 `<类别>：<名称>`，类别词取自上面的前缀表；`id` 用 `<类别前缀>_<英文>` 的蛇形。
- 等级范围：普通攻击等 1–16 级，默认 12；缺失的等级必须有明确来源，不外推。
- 来源单元格含多段或多个参数时，按完整行名逐项提取并保留各级值；不得取首个数字或首个带 `%` 的值代替整个单元格。替代命中与普通命中分开表达，不能同时加入总倍率。
- 倍率行：`kind` 取 `damageMultiplier`、`dazeMultiplier`、`energyCost`；行 ID 用 `damage`、`hit_N`、`daze`、`energy_cost` 等既有形态；`values` 保存为百分数数值（15.6 表示 15.6%）。
- 基础：默认以攻击力为基础，不写 `damageBasis`；锋御用 `def`，命破用 `sheerForce`，以异常精通为基础的直伤用 `anomalyProficiency`。`damageElement` 必须写。
- 同一 `skillType` 只能属于一个大类。

## 六、默认方案、技能组与默认队友

- 默认方案的目标由用户决定，属于必须询问的事项；默认配置以 `data/agents.json` 为准，角色文件只写设计意图。
- 名称以“N影”开头，后接动作组合，如“0影单次失衡”；假设和参数写进角色文件，不塞进名称。
- `mode` 的取值：只含单个技能事件用 `single`，含属性异常或异放事件用 `anomaly`，多事件组合用 `custom`。
- 同类事件必须合并成一个事件并设置次数 `count`，不得重复出现相同事件。
- 技能组名称要描述其实际子事件，包含的连携、附带攻击和追击必须能从名称看出；一个方便的按钮不得改变机制。
- 影画或潜能改变默认方案时，用 `variants`、`potentialVariants` 表达，不写多套互相冲突的默认。
- 可以有意省略默认方案和技能组（薇薇安），不得为“内容完整”编造无依据的整套循环。
- 新角色只有用户明确要求才创建技能组和管理员循环；缺省保持未配置，在角色专题说明。旧角色的既有方案按当前维护记录保留。
- `defaultTeammates` 选两名人工确认的队友及其影画，只在用户没有保存过队友选择时生效，不授予队友装备。队友优先级为用户手动 > Enka 完整导入 > 管理员默认。

## 七、专武

- 条目放在 `w_engines.json`，`relatedAgentId` 指向新角色；`id`、`name`、`rarity`、`specialty`、`images`、`level60`、`modification`、`effect`、`sources`、`verification` 都要填。
- `level60`：`atkBase` 与 `defBase` 恰有一个为正（锋御音擎用 `defBase`）；`advancedStat` 写属性、数值和 `mode`。
- `modification`：`minLevel: 1`、`maxLevel: 5`、`defaultLevel: 1`；`effect.description.zhCN` 必须按精炼 1→5 枚举全部五档（[回归契约](regression-contract.md#目录与维护)）。
- `effect.requirement.specialty` 写适配定位；有元素条件时在效果规则里写 `requirement: { attribute }`。
- `effect.selfBuff` 与 `teamBuff` 分开：只对装备者生效的写 `selfBuff`；有全队效果的写 `teamBuff`，没有则为 `null`。数值档位放 `modificationValues`，每条效果写 `coverage`。
- 图片：`images.icon` 指向 `/assets/w-engines/<ID>.png`，`images.source` 写官方词条页，缩略图随新图片生成。
- 来源：`sources` 写官方词条页和 `entry_page` 接口，`verification` 至少含 `officialEntryPageId`、`officialEntryVersion`、`level60Stats`、`effectText`、`effectBuff`。
- 专武创建后要回填角色的推荐盘和重要属性，并确认 Enka 映射已含该音擎。
- 音擎的日常维护规则见[周期目录维护手册](catalog-maintenance.md#三音擎与驱动盘套装)。

## 八、Enka、头像与推荐配装

**Enka 映射**

- `data/enka_zzz_mapping.json` 由 `scripts/update-enka-metadata.js` 在固定的 `ENKA_METADATA_COMMIT` 上生成，不得手改。
- 流程：确认上游 `avatars.json`、`weapons.json` 已收录新角色和专武；Enka 官方名与目录名不同时，在 `core/enka-import/aliases.js` 登记 `AGENT_ID_OVERRIDES` 或 `WENGINE_ID_OVERRIDES`；升级固定提交后运行脚本，审阅差异，更新 `test:enka-import` 里的映射断言。
- 上游尚未收录时，角色保持 `hidden: true`，待上游收录后升级固定提交重新生成。

**头像**：文件放 `webapp/public/assets/agents/<角色ID>.png|webp`，`images.portrait` 写 `/assets/agents/<角色ID>.<扩展名>`，`images.source` 写官方来源 URL；用 `npm --prefix webapp run assets:thumbnails` 生成缩略图，`build:webapp` 会用 `--check` 校验。新角色一律用 `portrait`，不使用 `icon`。

**推荐配装**：`preferredDriveDiscs` 的 `defaultSetIds`（4 件套）必须存在于 `drive_disc_sets.json`；`mainStatLimits` 与重要属性按定位给模板，具体取舍以资料和用户为准，重要属性只影响展示，不进入优化权重。

| 定位 | 4 号位 | 5 号位 | 6 号位 | 重要副词条 |
| --- | --- | --- | --- | --- |
| 强攻 | `critRate`、`critDmg`、`atkPct` | 本属性伤害、`penRatio`、`atkPct` | `atkPct` | `atkPct`、`critRate`、`critDmg`（可加 `penFlat`） |
| 异常 | `anomalyProficiency`、`atkPct` | 本属性伤害、`atkPct`、`penRatio` | `anomalyMastery`（可加 `atkPct`、`energyRegen`） | `atkPct`、`anomalyProficiency` |

击破、命破、锋御没有统一模板：4、5、6 号位和重要属性跟随倍率基础（命破 `hpPct`、锋御 `defPct`），可参考仪玄、克拉蕾、南宫羽。

推荐 4 件套需要手动触发参数时，写 `defaultFourPieceBuffRuntimeInputs`，只保存明确维护的层数和覆盖率。

## 九、来源与 verification

- 官方词条 ID、修订号、读取日期和来源 URL 必须记录；动态百科用 `entry_page` 接口读取结构化技能表，不从截图推测数值。
- 官方接口请求带 `x-rpc-wiki_app: zzz`；响应必须同时核对词条ID与名称，防止不同游戏的同号词条混淆。游戏/Enka编号不得充当官方词条ID。
- 公式录入前确认来源、输出、单位及依赖顺序均有消费者；面板节点成长与被动效果成长分别映射；影画按档位逐项核对名称与原文，不能复制邻档替代。描述只放来源原文或忠实缩减，未建模内容放角色专题与交付说明。
- 来源快照放 `docs/sources/`，命名与登记规则见[来源快照索引](sources/README.md)（新增快照必须同步该索引和角色文件的“资料来源”）；较大的来源数值放 `tests/fixtures/<角色>-source-values.json`。
- `verification` 必含键：`officialEntryPageId`、`officialEntryVersion`、`level60Stats`（核对说明）、`acquiredAt`、`unsupportedMechanics`。有补充来源或特殊假设时再加，如 `defaultObjective`。
- 调查脚本和中间产物放在被忽略的 `tmp/` 或 `.tmp_*`，不提交。

## 十、询问边界

**必须询问**（影响结果且无法从既有决定推导）：默认计算目标；资料歧义或来源之间的差异；未公开或未确认的机制；Enka 上游缺失时是否推迟上线。

**已经决定，不再询问**：

- 影画 Buff 不默认启用，由影画等级决定。
- 凡有全队效果的角色必须建队友条目。
- 专武 ID 用 `zzz_wiki_<词条ID>`，影画 Buff 只为有建模效果的档位建，`cinemaDescriptions` 写满六档。
- 同类事件合并为次数；队友优先级为用户手动 > Enka 导入 > 管理员默认。
- 快照口径、描述格式、维护保护由制作者直接落实。

## 十一、已知偏差（待核实）

下列现有数据与本手册不一致，新角色不得照抄；它们是否需要处理，核实后再决定。

- **队友条目缺失**：星见雅（影画一，全队属性异常积蓄效率 +20%）和爱丽丝（影画二，全队强击伤害 +15%）有全队效果但没有条目，按用户决定暂不建模。
- **既有队友 Buff ID**：南宫羽使用 `buff_<哈希>` ID，蕾米埃尔使用 `core_passive`、`special` 等分类词，简使用 `core_insight` 一类 ID，与第三节的 `<core|additional|cinema_N|skill>` 形式不统一；已保存的 Buff 选择按 ID 引用，不得批量改名。
