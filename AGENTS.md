# 项目工作入口

适用仓库：ZZZ Calculator（绝区零面板与伤害计算器）。核对日期：2026-11-18；基准提交：`9d51640c23697a849bdd3674b7f645a30c9f76b0`。

本文件是自动加载的唯一入口：先看项目概览，再按下面的**任务路由表**只读与当前改动相关的文档。不要通读 `docs/`；`docs/archive/` 只在追溯历史时读。

## 项目是什么

Vue 3 + 共享计算核心的绝区零工具：角色面板与伤害快照（含白盒推导）、驱动盘优化器、本地驱动盘仓库与账号、扫描器和 Enka 展柜导入、本地维护页、生产发布流程。**计算和优化在浏览器本地运行**，用户数据（账号、库存、配装、计算选择）只存在浏览器 IndexedDB/localStorage；Node 服务只负责目录、静态资源、本地维护和有限的受控接口。

页面：`/` 工作台（选角色、配 Buff 和事件、看伤害与白盒、跑优化器）、`/discs` 驱动盘仓库、`/accounts`、`/import`、`/settings`，以及仅在开关开启时提供的 `/maintenance` 维护页（编辑角色、技能、音擎、套装、异常、队友/场地/Boss Buff 八类目录）。

## 代码与数据布局

| 位置 | 内容 |
| --- | --- |
| `core/` | 跨平台计算、规范化、校验、优化器内核（不依赖 DOM/浏览器存储/Node 文件系统） |
| `webapp/src/` | Vue 界面：`components/`、`views/`、`stores/`、`runtime/`（存储与扫描器适配）、`workers/`（浏览器优化 Worker）、`styles/` |
| `webapp/e2e/`、`tests/` | Playwright 浏览器测试；根目录 Node 回归测试（`package.json` 的 `test:*` 脚本） |
| `backend/` | 目录/API/静态服务、本地维护、Enka 代理 |
| `data/` | **维护页保存的目录是当前事实**：`agents.json`、`agent_skills.json`、`w_engines.json`、`drive_disc_sets.json`、`combat_buffs.json`（队友与场地 Buff）、`bosses.json`、`anomaly_effects.json`、`enka_zzz_mapping.json` |
| `webapp/public/assets/` | 提交到仓库的图片和缩略图 |
| `config/`、`scripts/`、`deploy/`、`.github/workflows/` | 扫描器 manifest、构建与校验脚本、部署控制面、CI/CD |
| `tmp/`、`.tmp_*` | 已忽略的临时调查产物，不提交 |

## 全局规则

- 开始前检查分支、工作区差异、当前目录记录及相关测试。**维护页保存的修改和删除都是需要保护的内容**，不能因旧文档、旧测试或导入器模板而覆盖它们。
- 区分用户明确决定、当前实现、来源证据和潜在缺陷。出现冲突先追踪证据；文档任务不得擅自通过改代码或数据解决冲突，改为在对应文档记录“待核实/已知缺陷”并上报。
- 角色交付同时覆盖机制、默认计算目标、技能组、Buff 归属与默认值、维护界面、工作台、持久化、优化器及已约定的头像、装备关联和 Enka 映射。
- 修改公式时验证独立算例、作用与排除目标，并覆盖受影响的普通计算、白盒、编译评分、固定套装、Worker 和优化器路径；不要用路径一致代替机制正确性的证明。
- 界面任务检查真实容器尺寸、控件和保存回读；失败保留草稿，自动属性避免重复手输。
- 在已授权范围内自主完成。只有资料歧义或影响结果的未定偏好才集中询问，不增加例行审批环节。
- 临时调查脚本、诊断输出和过程报告放在已忽略的 `tmp/`（根目录临时脚本用 `.tmp_*`）；只有核实后的结论进入对应现行文档或变更日志。
- **玩家可见说明保持原文**：核心被动、额外能力、影画、技能、音擎等的 `description` 只放来源原文或忠实缩减，不追加“默认…可调整”“不自动…”“用户确认…”类尾句；默认状态用数据字段表达，未建模边界写进角色专题。规则与检查见[建模手册](docs/character-modeling-handbook.md#九来源与-verification)（`npm run test:description-style`）。
- **“待核实”必须有证据**：只记录来源歧义或数据与实现的冲突并给出证据位置；未留存到 `docs/sources/` 的外部攻略、实测不得写成“已核实/已确认”，也不为证明建模正确而增写反例论证或重复算例。
- 每条完整规则只维护在对应主文档，其他位置用链接引用；行为或人工默认配置改变时同步现行说明。历史档案不作为执行规范。
- 完成说明列出变更、实际运行的验证及未建模边界；不得把历史测试结果或本地检查表述成当前线上验收。
- 提交、推送、合并和部署遵循当次授权；普通文档或角色编辑不隐含部署授权，生产流程见[发布手册](docs/production-deployment-runbook.md)。

## 任务路由表

先判断改动属于哪一类（看会碰到哪些文件），**只读“先读”列**；“按需读”在确实涉及时再读；“不必读”的文档与该类任务基本无关。

| 任务 | 判断信号 | 先读 | 按需读 | 一般不必读 |
| --- | --- | --- | --- | --- |
| **A. 角色与计算**：新增/修订角色、专武、队友 Buff；公式、伤害域、优化器内核 | `data/agents.json`、`agent_skills.json`、`core/`、`webapp/src/workers/`、角色相关测试 | [建模说明](docs/modeling.md)；[回归契约](docs/regression-contract.md)的“计算与 Buff”“目录与维护”“优化器”节；新增或修订角色再读[角色建模手册](docs/character-modeling-handbook.md)（写法与交付包）和[角色制作指南](docs/character-authoring-guide.md)（流程） | **仅当改动涉及某角色时**读 [docs/characters/](docs/characters/README.md) 下对应文件（新增角色先看其中的 `_template.md`） | 布局契约、部署文档；`docs/sources/` 下的原始快照（不整体读取，按需取字段） |
| **B. 周期目录维护**：每期危局/防卫战的场地 Buff 与 Boss、新音擎、新驱动盘套装 | `data/combat_buffs.json`、`bosses.json`、`w_engines.json`、`drive_disc_sets.json` | [周期目录维护手册](docs/catalog-maintenance.md) | 回归契约的“目录与维护”节；建模说明的“效果、来源与目标” | 角色文件（除非涉及）、布局、部署 |
| **C. 界面与本地功能**：前端界面与交互、维护页界面、存储/备份/导入/仓库、扫描器与 Enka | `webapp/src/` 下的 `components/`、`views/`、`styles/`、`runtime/`、`stores/`，以及 `config/*manifest`、`core/enka-import` | 界面读[布局契约](docs/frontend-layout-contract.md)；存储、备份、导入、仓库、扫描器读[本地数据](docs/local-data.md) | 回归契约的“目录与维护”（维护页）、“本地数据与账号”节 | 角色文件、部署文档 |
| **D. 发布与部署**：CI/CD、控制面、恢复 | `.github/workflows/`、`deploy/`、部署相关脚本 | [发布手册](docs/production-deployment-runbook.md) | [部署管理器说明](deploy/production/README.md)、[恢复手册](deploy/production/RECOVERY.md)、回归契约的“路由与发布”节 | 其余全部 |
| **文档维护** | 只改 `*.md` | [文档索引](docs/README.md)（分工、头部格式、验收） | — | — |

**最低验证**（按影响再加）：A、B 改动任何 `description` 文案加 `npm run test:description-style`；A 运行相关 `npm run test:<角色/公式/优化器>` 聚焦脚本，共享逻辑变更跑 `npm test`；B 运行 `test:field-buffs`、`test:boss-catalog`、`test:repository-integrity` 等（清单见目录维护手册）；C 运行 `npm run test:webapp`、`npm run build:webapp`，布局变更加 `npm run test:layout`；D 运行 `node scripts/validate-deployment-config.js`、`npm run test:deployment-workflows`、`npm run test:deployment-timeouts`。纯文档改动不要求业务测试。

## 文档地图

| 文档 | 职责 |
| --- | --- |
| [docs/README.md](docs/README.md) | 文档分工、头部格式标准、更新规则、历史档案索引 |
| [docs/modeling.md](docs/modeling.md) | 通用计算语义：面板、效果与目标、乘区归属、事件、伤害域、紊乱与乱流、接口状态 |
| [docs/regression-contract.md](docs/regression-contract.md) | 跨角色必须保持的不变量与测试入口（计算、维护、本地数据、优化器、发布） |
| [docs/character-modeling-handbook.md](docs/character-modeling-handbook.md) | 角色建模写法：交付包清单、命名约定、原文句式到数据结构的对照、专武与 Enka、询问边界 |
| [docs/character-authoring-guide.md](docs/character-authoring-guide.md) | 角色制作的六阶段流程与历史案例原则 |
| [docs/characters/](docs/characters/README.md) | 每个角色的专属规则、默认意图、验收边界与已知缺陷（低优先级） |
| [docs/sources/README.md](docs/sources/README.md) | 来源快照（Nanoka、官方百科原始数据）的索引与读取规则；体积大，只在核对录入值时按需取字段 |
| [docs/catalog-maintenance.md](docs/catalog-maintenance.md) | 场地 Buff、Boss、音擎、套装的日常维护流程与必须同步的测试 |
| [docs/frontend-layout-contract.md](docs/frontend-layout-contract.md) | 前端布局、响应式、主题、工作台与弹窗规则 |
| [docs/local-data.md](docs/local-data.md) | 存储保护、账号与任务隔离、仓库分页与缓存、备份、导入撤销、结果缓存、扫描翻页 |
| [docs/production-deployment-runbook.md](docs/production-deployment-runbook.md) | 发布流程、工作流门禁表、冻结与晋级 |
| [deploy/production/README.md](deploy/production/README.md)、[RECOVERY.md](deploy/production/RECOVERY.md) | 部署控制面的安装与命令契约；发布失败后的有界恢复 |
| [docs/changelog.md](docs/changelog.md) | 最近的变化记录（问题 / 变化 / 边界 / 验证）；更早条目在 `docs/archive/` |
| [README.zh-CN.md](README.zh-CN.md)、[README.md](README.md) | 面向用户的概览、运行命令、最近五条更新 |
