# ZZZ 计算器

这是一个绝区零驱动盘、面板、伤害与优化器工作区。项目由一个无第三方依赖的 Node.js 后端和静态前端页面组成，用于账号管理、仓库维护、局外/局内面板计算、伤害白盒查看，以及驱动盘最优组合搜索。

英文文档见 [README.md](README.md)。

## 上传更新摘要

### 2026-07-02 扫描器 1.0.35 与云绝区零客户端选择

本次上传为驱动盘扫描弹窗增加明确的客户端选择。默认仍为本地绝区零；选择云绝区零时，网页会发送
`processName="Zenless Zone Zero Cloud"` 和 `visualProfileClient="cloud"`，
让扫描器使用包内已验证的云端视觉 profile。

- OCR 运行时重新来自本机 `publish 1.0.35`，压包时排除生成的 `Scans` 输出，并保留包内 `Data/ocr_fast_templates.json`。
- Pages scanner manifest 和本地 package manifest 已更新为 `scannerVersion=1.0.35`。
- OCR zip 已发布到 GitHub Release tag `scanner-1.0.35`，SHA-256 为 `2a10aa3dc92e50c7ea930d75eda82fef741eff16e8c39f2839240b6fc36b0255`，大小 `47228425` bytes。
- 网页扫描 payload 继续保持稳定 strict DXGI 路线，但会显式区分本地/云端目标，云端扫描不再误找本地 `ZenlessZoneZero` 进程。

### 2026-07-02 扫描器 1.0.34 发布

本次上传将网页唤起的 OCR 运行时替换为 ZZZ Scanner Next `1.0.34`：

- OCR 运行时重新来自本机 `publish 1.0.34`，压包时排除生成的 `Scans` 输出，并保留包内 `Data/ocr_fast_templates.json`。
- Pages scanner manifest 和本地 package manifest 已更新为 `scannerVersion=1.0.34`。
- OCR zip 已发布到 GitHub Release tag `scanner-1.0.34`，SHA-256 为 `d87a993e15a0f9103942b0284d8d5fc552bed348147180682ef42f7b0fc51c30`，大小 `47228531` bytes。
- 网页扫描 payload 继续保持稳定 strict DXGI 路线，并刷新 Helper `1.0.2`：完整下载后的临时包会先进入校验流程，不会继续发 Range 重试；首次下载仍会显示字节数、百分比、速度和重试次数。

### 2026-07-02 扫描器 1.0.33 与弹窗流程更新

本次上传发布网页唤起的 ZZZ Scanner Next `1.0.33`，并一并提交当前优化器/仓库页的待提交 UI 更新：

- OCR 运行时重新来自本机 `publish 1.0.33` 输出包，包内包含 `Data/ocr_fast_templates.json`，网页不会再传 `ocrFastIndex` 覆盖参数。
- 驱动盘扫描请求改用 `1.0.33` 稳定 payload：`fastMode=true`、`captureMode=dxgi`、`profileRouting=strict`、`overlapConflictMode=recover`、`panelAcceptMode=adaptive-early-full-roi`、`scrollAcceptMode=early-one-row`、`postScrollPanelAcceptMode=safe`、`panelMinAcceptFloorMs=120`。
- 非 15 级全仓读取仍不作为默认能力开放，网页默认保持 `stopAtNonLevel15=true`。
- 驱动盘分析弹窗现在默认展示角色感知的“差异计算”，并保留“当前副词条”和“收益曲线”视图。
- 战斗 Buff、优化器 2 件套/4 件套限制、计算配置、驱动盘编辑和套装预设编辑弹窗改为明确的取消/应用或取消/保存页脚，临时选择不会立刻改动当前方案。
- 堆叠型音擎效果支持通过 `stackGroup` 共用一个层数输入；「青溟笼舍」的两个“青溟同行”效果会同步同一层数。

### 2026-07-02 扫描助手下载进度

本次上传刷新现有 `scanner-1.0.33` Release 中的 `ZZZ-Scanner-Helper.exe`：

- Helper 下载 OCR 运行时时会回传已下载字节、总字节、百分比、下载速度和重试次数。
- 驱动盘页会直接显示这些进度，不再只停在固定的“正在下载”文案。
- 如果当前连接的是低于 `1.0.1` 的旧 Helper，页面会提示重新下载新版 Helper，因为旧 Helper 无法回传字节级下载进度。
- 本机诊断确认 GitHub Release 资产存在，但完整下载会出现连接重置或连接 GitHub 超时，因此当前现象更像下载链路不稳定/被阻断，不是单纯的页面假死。

### 2026-07-01 角色感知词条差异分析

本次更新复用现有“词条分析”弹窗，新增“差异计算”视图：

- 副词条差异以当前六件驱动盘、当前 Buff 和当前伤害目标为基线，按真实边际伤害排序。
- 4/5/6 号位主词条候选直接读取角色 `preferredDriveDiscs.mainStatLimits`，缺省才回退槽位可选池。
- 当前已经装备的主词条不会生成无意义的反向扣除行，例如物伤盘不会再出现 `-30 physicalDmg`。
- 前端本地计算、后端分析 API 和回归测试已保持一致。

### 2026-07-01 扫描器包体瘦身

本次上传在不改变网页唤起流程的前提下降低扫描器下载体积：

- `ZZZ-Scanner-Helper.exe` 改为 NativeAOT 小助手，下载体积从约 67.6MB 降到 7.4MB。
- `1.0.28` OCR 扫描器 zip 去掉未使用的视频/诊断负载，包体从约 129.9MB 降到 115.2MB。
- 已同步扫描器 manifest 的 hash/size；Helper 协议、扫描器版本、入口程序和 OCR 模型保持不变。
- 公开 Pages manifest 现在优先使用已验证的 GitHub Release 新包，避免旧 ECS 镜像返回瘦身前的大包。

### 2026-07-01 02:55 +08:00

本次上传修复公开 Pages 站点首次准备 OCR 扫描器容易卡住的问题：

- 已将 `1.0.28` OCR zip 上传到 ECS 备用镜像，并让生成的扫描器 manifest 优先尝试该镜像，再尝试 GitHub Releases。
- 前端准备 OCR 扫描器的超时时间已放宽，覆盖当前 130MB 包在低带宽镜像上的实际下载耗时。
- 如果 Helper 探测接口已经报告扫描器已安装，驱动盘页会直接启用扫描按钮，不再等待额外的 launcher progress 流程。

### 2026-06-30 22:20 +08:00

本次上传迁移到不备案的 GitHub Pages + GitHub Releases 发布方式：

- 新增 `npm run build:pages`，生成 `dist/pages` 静态站点，导出 `static/catalog.json`、`static/app-config.json`、`downloads/zzz-scanner/manifest.json` 和 `CNAME`。
- 前端优先读取静态 JSON，保留本地 Node server 的 `/api/catalog`、`/api/meta`、`/api/app-config` 作为开发兜底。
- 驱动盘页的小助手下载改为 GitHub Releases 下载；OCR manifest 增加 `packageUrls`，便于小助手在镜像更新后尝试多个 OCR 包来源。
- 新增 GitHub Actions Pages 工作流，只上传 Pages artifact，不提交 `dist/pages` 或 `downloads/` 大文件。

### 2026-07-01 01:00 +08:00

本次上传更新网页唤起 OCR 扫描器的 1.0.28 稳定版集成：

- `/downloads/zzz-scanner/manifest.json` 已改为提供 ZZZ Scanner Next `1.0.28`，下载路径为 `/downloads/zzz-scanner/1.0.28/ZZZ-Scanner.Next-win-x64.zip`。
- 网页扫描请求现在会发送更稳的 fast DXGI 路线：`overlapConflictMode=recover`、`panelMinAcceptFloorMs=120`、`postScrollPanelAcceptMode=safe`，非 15 级全仓库扫描仍不作为默认能力开放。
- 扫描失败弹窗会显示 scanner 版本和本地运行目录，便于确认实际运行的是哪个 OCR 包。
- `npm run test:scanner-bridge` 新增扫描器 manifest、包大小、SHA-256 和 `scan_req` payload 校验。

### 2026-06-24 01:31 +08:00

本次上传主要更新如下：

- 新增官方百科驱动盘套装「呼啸沙龙」与「拂晓行纪」，包含本地图标素材、2 件套属性和 4 件套自身 Buff 建模。
- 补齐风属性统计链路，维护页、首页面板、计算页、驱动盘背包、扫描导入、优化器评分和属性规则均支持 `windDmg`、`windResIgnore`、`enemyWindResReduction` 与 `windSheerDmg`。
- 5 号位主词条池新增风属性伤害加成，S 级主词条上限按现有属性伤害主词条统一为 30%。
- 扩展百分比 sanity、维护校验、共享战斗工具、驱动盘导入/分析、优化器、面板编译和伤害白盒等回归验证。

### 2026-06-23 12:55 +08:00

本次上传主要更新如下：

- 将驱动盘优化器工作区合并到首页，`/` 现在同时承载自选驱动盘、套装预设、优化结果候选、局外面板、局内面板和伤害白盒。
- 移除旧的 `/calculate.html` 独立页面，改为兼容重定向到 `/`；不存在的静态文件现在返回 `404`。
- 首页驱动盘方案改为统一切换：自选、套装和优化候选共用同一个方案列表，并支持当前方案 4 件套 Buff 运行时设置、保存套装和应用套装。
- 扩展战斗 Buff 与驱动盘套装资料，补充新队友和 4 件套行为，并新增多名队友头像素材。
- 新增统一优化器 UI、旧入口重定向、伤害修正、维护校验、优化器套装逻辑、共享战斗工具和音擎改装数值等回归测试。

### 2026-06-09 20:28 +08:00

本次上传主要更新如下：

- 新增 Boss 失衡状态与失衡倍率建模，覆盖直伤、贯穿、属性异常和紊乱伤害，并补充伤害白盒行、建模文档和回归测试。
- 新增按核心技等级缩放的技能倍率支持，技能倍率可以使用 `0`、`A-F` 等核心技等级；星见雅补充「霜灼·破」核心技伤害数据和影画定向 Buff。
- 驱动盘优化器新增 `exact-super-bound-parallel` worker 并行精确搜索路径、compiled/dense 评分内核、worker 指标和并行 benchmark 覆盖。
- 优化器新增推荐 4 件套选择、角色默认 4 件套、以及 4 件套 Buff 自动/手动运行时输入控制。
- 新增共享前端页面通知组件，首页、优化器、驱动盘、账号和维护页的错误/成功反馈更统一。
- 队友 Buff 维护升级为按队友分组编辑，并支持头像/图标元数据；战斗 Buff 浏览也会展示队友头像。
- 维护页保存时保留“无视防御”作为独立属性，不再折叠成“防御降低”。
- 新增 compiled-score、compiled-panel-score、维护属性、失衡倍率、推荐驱动盘和队友图片校验等测试覆盖。

### 2026-06-07 21:15 +08:00

本次上传主要更新如下：

- 深化计算器、优化器、驱动盘、账号和维护页的前端可用性：优化空状态、移动端导航、sticky 操作条、优化器运行反馈和技能倍率搜索选择。
- 新增共享前端弹窗助手，替换账号操作、驱动盘删除/导入同步、套装删除和优化器套装命名中的浏览器原生 prompt/confirm。
- 首页计算后会同步展示最终伤害摘要，并自动定位到伤害白盒区域，降低结果查找成本。
- 按角色保存战斗 Buff 勾选状态，并把自定义抗性输入改为明确的正/负号与数值组合。
- 将贯穿力和贯穿伤害限制为命破角色生效，并补充非命破角色触发贯穿事件时伤害为 0 的回归测试。
- 扩展精确优化器剪枝与性能指标，增加预热种子分数、计时指标、跳过上界检查统计，以及 exact-super-bound 与 exact-legacy 对齐的 fuzz 测试。

### 2026-06-04 00:46 +08:00

本次上传主要更新如下：

- 新增仪玄作为命破/玄墨角色，包含头像素材、基础属性、核心技 Buff、默认贯穿伤害计算配置，以及按贯穿力建模的完整技能倍率资料。
- 新增贯穿伤害体系：支持 `sheer` 伤害事件、派生贯穿力、固定贯穿力、通用/分属性贯穿增伤、暴击、抗性处理和专用伤害白盒公式行。
- 扩展属性规则、驱动盘套装效果、音擎效果、音擎图片素材、维护校验、自定义 Buff 选项和优化器评分，使其支持贯穿伤害构筑。
- 新增多把命破相关音擎及改装数值测试，覆盖物理、火、冰、以太和固定贯穿力等 Buff 变体。
- 新增驱动盘分析 API 和前端工具，用于查看当前副词条有效词条数，以及额外副词条带来的伤害收益曲线。
- 优化计算器和优化器界面，新增贯穿目标/事件控件、实体选择辅助、分析面板和相关样式。
- 新增 `npm run test:drive-disc-analysis`，并扩展贯穿伤害白盒、优化器进度、共享战斗工具、维护校验和音擎改装值回归测试。
- 新增当前计算器与优化器体验的前端可用性审计文档。

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
- 支持直伤、贯穿、异常和紊乱事件的伤害预览，并输出可检查的公式拆解；目标防御、抗性与失衡乘区可配置，不同伤害类型使用独立的事件修正区。
- 支持 ZZZ Scanner 驱动盘导入、一键唤起本地扫描助手、手动编辑、重复识别、账号隔离存储和可选的“移除缺失”同步。
- 支持保存驱动盘套装预设，首页可套用，优化器结果也可保存。
- 驱动盘优化器支持计算目标预设、预览、后台任务进度、取消、套装结构限制、多选额外 2 件套、推荐/默认 4 件套辅助、4 件套 Buff 自动或手动处理、主词条限制、最低属性限制、精确/快速/并行算法选择和伤害评分。
- 驱动盘分析工具支持查看当前副词条有效词条数，以及额外副词条带来的预测伤害收益。
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
    driveDiscAnalysis.js
    driveDiscInventory.js
    driveDiscOptimizer.js
    driveDiscOptimizerWorker.js
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
    frontend-usability-audit.md
    goal.md
    modeling.md
  examples/
    out_of_combat_panel.example.json
    ye_shunguang_panel.example.json
  frontend/
    index.html
    drive-discs.html
    accounts.html
    maintenance.html
    app.js
    calculate.js
    drive-disc-analysis.js
    drive-discs.js
    dialogs.js
    entity-select.js
    feedback.js
    accounts.js
    accounts-page.js
    maintenance.js
    maintenanceStats.js
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

驱动盘页的「扫描」会优先连接本地小助手。公开站点上的小助手下载按钮指向 GitHub Releases；本地 Node server 开发模式仍可从 `/downloads/ZZZ-Scanner-Helper.exe` 提供文件。OCR 包 manifest 当前使用已验证的 GitHub Release 新包。小助手会注册 `zzz-scanner://` 协议，在 `127.0.0.1:22355` 与网页通信，并按 `/downloads/zzz-scanner/manifest.json` 自动下载/更新真正的 OCR 扫描器大包。当前网页发布的大包版本是 ZZZ Scanner Next `1.0.35`。

主要页面：

- `/`：Vue 工作台，承载角色配置、伤害配置、Buff、驱动盘方案和优化器
- `/discs`：Vue 驱动盘仓库，包含套装预设、导入预览、扫描流程和词条分析
- `/accounts`：Vue 账号新增、切换、改名和删除
- `/maintenance.html`：旧版静态资料维护界面，用于维护游戏数据 JSON；本地开发或显式开启维护时可用，普通生产构建默认隐藏
- `/maintenance`：兼容入口，跳转到 `/maintenance.html`
- `/calculate.html`、`/drive-discs.html`、`/accounts.html` 保留为旧入口兼容，分别跳转到 Vue 工作台、仓库和账号页。

## 本地运行数据

用户态数据保存在浏览器本地 IndexedDB 中，包括账号、当前账号、驱动盘仓库、导入记录和套装预设。线上部署后，A 用户在自己浏览器里的上传、编辑、删除和账号切换不会写入服务器公共仓库，也不会影响 B 用户。

旧版的 `data/user_drive_discs.json` 仍被 Git 忽略，只用于后端历史测试和本地迁移参考；公开页面不再通过服务器用户数据 API 读写它。

`data/user_drive_discs.example.json` 是空仓库结构示例。复制到 `imports/` 或 `data/imports/` 的扫描器导出文件也会被忽略。

`data/` 下的公开静态数据、前端素材、示例、文档和测试应保持提交状态，这样其他用户克隆后可以直接运行。

## 生产环境

当前公开站点推荐部署到 GitHub Pages，不再把 `zzzcaculator.top` 解析到中国内地 ECS，因此不走 ICP 备案。

静态站构建命令：

```bash
npm run build:pages
```

构建产物在 `dist/pages`，包含首页、驱动盘页、账号页、静态资料 JSON、`CNAME` 和 OCR manifest。GitHub Actions 会在 `main` 分支更新后运行同一命令，并用 Pages artifact 发布；不要提交 `dist/pages`。

Helper 和 OCR 大包通过 GitHub Releases 发布，不进入 Git 仓库：

- tag：`scanner-1.0.35`
- `ZZZ-Scanner-Helper.exe`
- `ZZZ-Scanner.Next-win-x64.zip`

域名设置完成后，GitHub Pages 自定义域名为 `zzzcaculator.top`，`www.zzzcaculator.top` 作为兼容入口。DNS 记录应指向 GitHub Pages，而不是旧 ECS 公网 IP。

本地或自托管 Node 服务仍可使用原生产模式。

生产部署建议设置：

```bash
NODE_ENV=production
```

此时服务端会返回 `maintenanceEnabled: false`，并硬拦截 `/maintenance.html`、`/maintenance.js`、`/maintenanceValidation.js`、`/maintenanceStats.js` 和 `/api/maintenance/*`。如确需显式覆盖，可设置 `MAINTENANCE_ENABLED=true|false`。

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
npm run test:maintenance-stats
npm run test:compiled-score
npm run test:compiled-panel-score
npm run test:optimizer
npm run test:optimizer-progress
npm run test:optimizer-api
npm run test:optimizer-ui
npm run test:optimizer-fuzz
npm run test:drive-disc-analysis
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
node --check backend/driveDiscAnalysis.js
node --check backend/driveDiscOptimizer.js
node --check backend/server.js
node --check frontend/app.js
node --check frontend/calculate.js
node --check frontend/dialogs.js
node --check frontend/drive-disc-analysis.js
node --check frontend/drive-discs.js
node --check frontend/entity-select.js
node --check frontend/maintenance.js
node --check frontend/accounts-page.js
```

## API 概览

- `GET /api/health`
- `GET /api/app-config`
- `GET /api/meta`
- `GET /api/maintenance/catalog`（生产环境默认 `403`）
- `POST|PUT|DELETE /api/maintenance/:resource`（生产环境默认 `403`）
- `DELETE /api/maintenance/anomaly-effects/:type/:id`（生产环境默认 `403`）
- `GET /api/example/out-of-combat`
- `GET /api/example/ye-shunguang`
- `POST /api/calculate/out-of-combat`
- `POST /api/calculate/in-combat`
- `POST /api/optimize/drive-discs/preview`
- `POST /api/optimize/drive-discs/jobs`
- `GET|DELETE /api/optimize/drive-discs/jobs/:id`
- `POST /api/optimize/drive-discs`
- `POST /api/analysis/drive-disc-substats`
- `POST /api/analysis/drive-disc-stat-gains`

以下旧用户数据接口已退役并返回 `410 Gone`，用户数据改由浏览器本地保存：

- `/api/accounts*`
- `/api/user-drive-discs*`
- `/api/user-drive-disc-loadouts*`

## 建模说明

- 基础攻击力等于 `角色基础攻击力 + 音擎基础攻击力 + 核心技基础攻击力`。
- 局外面板是后续条件性局内 Buff 的稳定基准。
- 局内 Buff 可以贡献普通属性、运行时缩放效果、伤害修正、音擎团队 Buff 和指定技能效果。
- 目标配置支持防御力、等级基数、分元素抗性，以及可选的失衡倍率。
- 优化器伤害目标可以使用单个直伤、贯穿、异常或紊乱事件，也可以使用自定义的多事件列表。
- 特殊显示属性可以声明真实结算属性；例如叶瞬光显示为贯穿，但伤害按物理结算。
- 命破/玄墨伤害按贯穿伤害建模：贯穿力由局内生命值、局内攻击力和固定贯穿力派生，再进入贯穿增伤区，并跳过防御/穿透乘区。
- 异常和紊乱伤害使用 `data/anomaly_effects.json` 中统一 `effects` 列表的数据倍率，并通过 `settlementType` 区分结算类型。
- 属性异常和紊乱伤害使用不同的增伤区：`anomalyDamageBonus` 只作用于属性异常，`disorderDamageBonus` 只作用于紊乱。
- 音擎改装等级只物化每阶明确的 Buff 数值，不改变 60 级基础攻击力或高级属性。

更多细节见 [docs/modeling.md](docs/modeling.md) 和 [docs/changelog.md](docs/changelog.md)。

## 维护规则

所有绝区零计算器的数据模型、示例、前端代码、后端代码和后续计算器实现都应保留在本仓库内，除非之后的集成步骤明确要求迁移到其他位置。
