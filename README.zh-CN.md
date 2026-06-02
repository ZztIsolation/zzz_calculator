# ZZZ 计算器

这是一个绝区零驱动盘、面板、伤害与优化器工作区。项目由一个无第三方依赖的 Node.js 后端和静态前端页面组成，用于账号管理、仓库维护、局外/局内面板计算、伤害白盒查看，以及驱动盘最优组合搜索。

英文文档见 [README.md](README.md)。

## 上传更新摘要

### 2026-06-03 00:50 +08:00

本次上传主要更新如下：

- 扩展音擎目录和图片素材，新增/补充更多支援、击破、异常、强攻和防护音擎。
- 音擎改装建模从旧版缩放规则迁移为明确的 1 到 5 阶改装数值表，并为新的 `modificationValues` 数据结构补充校验和回归测试。
- 扩展队友战斗 Buff 数据，新增/补充南宫羽、柚叶影画效果、耀嘉音、丽娜、露西、妮可和苍角等团队 Buff。
- 将属性异常增伤和紊乱增伤拆成独立的事件修正区；紊乱不再继承属性异常增伤，也不再吃异常暴击。
- 新增普通/极性紊乱处理，紊乱持续时间改为使用资料目录默认值，不再由前端输入。
- 战斗 Buff 选择升级为队友选择器，并支持按来源分组展示、按来源一键移除，以及队友、音擎团队 Buff、驱动盘团队 Buff 的数量限制。
- 多效果公式/派生 Buff 的运行时输入改为按来源合并，一个输入可以驱动同组相关效果规则。
- 更新首页和优化器伤害控件、伤害白盒行、自定义 Buff 选项、维护校验、建模文档和回归测试，以覆盖新的紊乱与音擎行为。

### 2026-06-02 02:55 +08:00

本次上传主要更新如下：

- 优化器新增“计算配置”流程，支持最大化单个直伤、最大化异常伤害，以及自定义多事件伤害目标。
- 新增每个角色的管理员默认计算配置；维护页可编辑，优化器页可一键应用。星见雅现在带有默认混合循环目标。
- 异常数据改为统一的 `effects` 目录，并通过 `settlementType` 区分属性异常和紊乱；计算器和维护页仍会分别展示两类数据。
- 新增星见雅“烈霜霜寒紊乱”模型，包含 600% 固定倍率、75% 跳伤倍率和 20 秒默认持续时间。
- 扩展伤害事件标准化：紊乱现在作为异常结算类型处理，多事件会汇总为 `totalFinalDamage`，直伤会同时暴露期望/暴击/非暴击结果，伤害白盒包含面板快照方便排查。
- 驱动盘优化器新增推荐的 `exact-super-bound` 算法、旧版精确对照算法、非严格极速算法、超级上界剪枝指标，以及真实评分/剪枝/已处理组合数统计。
- 额外 2 件套限制从单选升级为可选择多个允许套装。
- 优化后台任务、轮询、取消、进度展示、每秒评估速度、复杂度提示和结果指标。
- 新增 `npm run benchmark:optimizer`，用于对比旧版精确优化器和新版超级上界精确优化器。
- 维护校验扩展到默认计算配置、异常结算类型、技能引用、事件次数和紊乱已生效时间。
- 回归测试扩展到优化器算法、进度计数、自定义/默认伤害配置、异常结算、伤害白盒和维护校验。

### 2026-06-01 22:54 +08:00

本次上传主要更新如下：

- 新增多账号支持：不同账号拥有独立的驱动盘仓库、套装预设、导入记录和首页选择状态。
- 新增直伤、属性异常伤害与紊乱伤害计算，并提供防御、抗性、穿透、抗性无视、异常精通、异常等级、属性异常增伤、紊乱增伤、异常暴击和最终伤害等白盒拆解行。
- 新增 `data/anomaly_effects.json`，把异常和紊乱倍率改为数据驱动。
- 新增叶瞬光、星见雅、爱丽丝的技能倍率资料，并为可合并的多段技能生成“总伤害倍率”候选行。
- 音擎支持 1 到 5 阶改装等级；计算使用精确值，展示保留官方四舍五入数值。
- 新增星见雅、爱丽丝、霰落星殿、十方锻星的数据和前端素材。
- 扩展队友、场地、Boss、手动、指定技能、音擎团队 Buff 建模，支持仅修改其他 Buff 的放大类规则。
- 首页和优化器增加目标预设、防御力、元素抗性、技能倍率选择、异常事件和紊乱已生效时间控制。
- 驱动盘导入支持去重、升级合并、移除缺失同步，并会在驱动盘删除或导入移除后清理套装预设中的失效槽位。
- 新增驱动盘套装预设管理，优化器结果可以直接保存为套装。
- 维护页支持技能倍率、音擎改装缩放、异常/紊乱效果、自身/团队拆分效果，并强化数据校验。
- 新增账号、扫描器导入、音擎改装、共享战斗工具、异常伤害、伤害白盒、维护校验和优化器等回归测试。

## 功能

- 维护角色、音擎、驱动盘套装、技能倍率、属性规则、异常效果和战斗 Buff 数据。
- 根据角色属性、核心技等级、音擎、驱动盘和无条件套装效果计算局外面板。
- 在局外面板基础上叠加自身、队友、音擎、驱动盘 4 件套、场地、Boss 和手动 Buff，计算局内面板。
- 战斗 Buff 支持队友、音擎团队、驱动盘团队和自定义来源分组，便于查看与移除。
- 支持直伤、异常和紊乱事件的伤害预览，并输出可检查的公式拆解；属性异常与紊乱使用独立的事件修正区。
- 支持 ZZZ Scanner 驱动盘导入、手动编辑、重复识别、账号隔离存储和可选的“移除缺失”同步。
- 支持保存驱动盘套装预设，首页可套用，优化器结果也可保存。
- 驱动盘优化器支持计算目标预设、预览、后台任务进度、取消、套装结构限制、多选额外 2 件套、主词条限制、最低属性限制、精确/快速算法选择和伤害评分。
- 提供静态资料维护页，用于录入和校验游戏数据 JSON。

## 目录结构

```text
zzz_calculator/
  README.md
  README.zh-CN.md
  package.json
  backend/
    server.js
    calculator.js
    driveDiscInventory.js
    driveDiscOptimizer.js
  data/
    agents.json
    agent_skills.json
    anomaly_effects.json
    w_engines.json
    drive_disc_sets.json
    stat_rules.json
    combat_buffs.json
    user_drive_discs.example.json
  docs/
    changelog.md
    goal.md
    modeling.md
  examples/
    out_of_combat_panel.example.json
    ye_shunguang_panel.example.json
  frontend/
    index.html
    drive-discs.html
    calculate.html
    accounts.html
    maintenance.html
    app.js
    calculate.js
    drive-discs.js
    accounts.js
    accounts-page.js
    maintenance.js
    shared-combat.js
    skillMultiplierCandidates.js
    assets/
  tests/
```

## 运行

需要支持 ES module 的 Node.js。当前不需要安装第三方 npm 依赖。

```bash
cd zzz_calculator
npm start
```

启动后打开终端打印的本地地址，通常是 `http://localhost:8787`。如需指定端口，可以使用 `PORT=8791 npm start`。

主要页面：

- `/`：首页计算器、面板、局内 Buff 和伤害白盒
- `/drive-discs.html`：驱动盘仓库和套装预设
- `/calculate.html`：驱动盘优化器
- `/accounts.html`：账号新增、切换、改名和删除
- `/maintenance.html`：静态资料维护

## 本地运行数据

`data/user_drive_discs.json` 会被 Git 忽略，因为它保存本地玩家的驱动盘、导入记录、账号、套装预设和当前账号状态。全新克隆仓库时可以没有这个文件；后端会先使用空仓库，并在导入或编辑驱动盘后创建本地文件。

`data/user_drive_discs.example.json` 是空仓库结构示例。复制到 `imports/` 或 `data/imports/` 的扫描器导出文件也会被忽略。

`data/` 下的公开静态数据、前端素材、示例、文档和测试应保持提交状态，这样其他用户克隆后可以直接运行。

## 测试

可以用 npm 运行这些聚焦测试：

```bash
npm run test:atk-basis
npm run test:percent-sanity
npm run test:maintenance-validation
npm run test:formula
npm run test:damage-whitebox
npm run test:shared-combat
npm run test:w-engine-modification
npm run test:anomaly-damage
npm run test:optimizer
npm run test:optimizer-progress
npm run test:optimizer-api
npm run test:drive-disc-import
npm run test:accounts
```

对比精确优化器策略时，可以运行 benchmark 脚本：

```bash
npm run benchmark:optimizer
```

常用语法检查：

```bash
node --check backend/calculator.js
node --check backend/server.js
node --check frontend/app.js
node --check frontend/calculate.js
node --check frontend/drive-discs.js
node --check frontend/maintenance.js
node --check frontend/accounts-page.js
```

## API 概览

- `GET /api/health`
- `GET /api/meta`
- `GET /api/accounts`
- `POST /api/accounts`
- `POST /api/accounts/current`
- `PUT|DELETE /api/accounts/:id`
- `GET /api/maintenance/catalog`
- `POST|PUT|DELETE /api/maintenance/:resource`
- `DELETE /api/maintenance/anomaly-effects/:type/:id`
- `GET /api/example/out-of-combat`
- `GET /api/example/ye-shunguang`
- `POST /api/calculate/out-of-combat`
- `POST /api/calculate/in-combat`
- `POST /api/optimize/drive-discs/preview`
- `POST /api/optimize/drive-discs/jobs`
- `GET|DELETE /api/optimize/drive-discs/jobs/:id`
- `POST /api/optimize/drive-discs`
- `GET|DELETE /api/user-drive-discs`
- `POST /api/user-drive-discs/import/zzz-scanner`
- `POST /api/user-drive-discs`
- `PUT|DELETE /api/user-drive-discs/:id`
- `GET|POST /api/user-drive-disc-loadouts`
- `PUT|DELETE /api/user-drive-disc-loadouts/:id`

## 建模说明

- 基础攻击力等于 `角色基础攻击力 + 音擎基础攻击力 + 核心技基础攻击力`。
- 局外面板是后续条件性局内 Buff 的稳定基准。
- 局内 Buff 可以贡献普通属性、运行时缩放效果、伤害修正、音擎团队 Buff 和指定技能效果。
- 优化器伤害目标可以使用单个直伤/异常事件，也可以使用自定义的直伤、异常、紊乱多事件列表。
- 特殊显示属性可以声明真实结算属性；例如叶瞬光显示为贯穿，但伤害按物理结算。
- 异常和紊乱伤害使用 `data/anomaly_effects.json` 中统一 `effects` 列表的数据倍率，并通过 `settlementType` 区分结算类型。
- 属性异常和紊乱伤害使用不同的增伤区：`anomalyDamageBonus` 只作用于属性异常，`disorderDamageBonus` 只作用于紊乱。
- 音擎改装等级只物化每阶明确的 Buff 数值，不改变 60 级基础攻击力或高级属性。

更多细节见 [docs/modeling.md](docs/modeling.md) 和 [docs/changelog.md](docs/changelog.md)。

## 维护规则

所有绝区零计算器的数据模型、示例、前端代码、后端代码和后续计算器实现都应保留在本仓库内，除非之后的集成步骤明确要求迁移到其他位置。
