# ZZZ 计算器

ZZZ 计算器是一个基于 Vue 3 和共享核心的绝区零工具，覆盖角色面板、伤害快照、驱动盘优化、本地仓库和扫描器导入。计算与优化在浏览器本地运行；Node 服务负责目录、静态资源、本地维护和受限集成。

语言： [English](README.md)

## 上传更新摘要

- **2026-10-09 — 队友菜单自适应**：队友选择菜单按可用空间定位和限高，分类列固定、角色列独立滚动，兼容窄屏和极矮窗口。
- **2026-10-08 — 文档与角色制作指南**：分离当前规范和历史证据，修正过时的角色/默认配置/发布说明，并整理爱芮、希格莉德、11号、薇薇安、克拉蕾、佩洛伊斯和维琳娜的制作经验。
- **2026-10-07 — 目录资源**：补齐并核验当前音擎记录与带内容版本的缩略图。
- **2026-10-04 — Web/运行时加固**：保留网页提权重试时的扫描器设置，并使用 ETag 重新验证紧凑目录响应。
- **2026-10-03 — 生产恢复控制**：为部署阶段、审计证据和恢复诊断增加有界门禁，未改变现行精确 SHA 晋级边界。
- **2026-10-02 — Enka 队友 Buff 同步**：将展柜导入接入原生队友 Buff 配置，同时保留手动选择、来源详情、配装和可重试的保存冲突。
- **2026-10-02 — 防卫战 3.2 第二期场地 Buff**：新增第二期三项场地 Buff，覆盖锐化、属性、触发式防御降低和失衡易伤；未支持机制继续只作说明。
- **2026-10-01 — 维琳娜风属性异常建模**：区分风化、乱流和异放结算语义，加入已确认倍率、维护控件、Enka 映射和可编辑默认推荐。
- **2026-09-30 — 异常音擎**：新增四把官方异常音擎，包含 60 级数据、精确精炼值、可调叠层和明确的异常目标。
- **2026-09-27 — 驱动盘评分与分析**：新增有效副词条数量、当前与优化方案评分对比及更清晰的分析入口，底层计算精度保持不变。
- **2026-09-26 — 佩洛伊斯展柜映射与发布**：将 Enka 角色 ID `1551` 映射到佩洛伊斯，并验证展柜角色识别与跳过结果。
- **2026-09-19 — 佩洛伊斯四分支终结技建模**：新增佩洛伊斯、四种终结技及独立的强袭训令技能组，遵循既有直伤快照建模口径。
- **2026-09-18 — 防卫战 3.2 第一期场地 Buff**：新增第一期场地 Buff 目录和选择器覆盖，复用现有场地 Buff 计算路径。
- **2026-09-18 — 重要副词条高亮**：新增角色级可选字段 `importantSubStats` 和维护编辑器，用于高亮相关驱动盘副词条。
- **2026-09-17 — 工作台与目录清理**：优化工作台操作、事件摘要、优化器控件和响应式行为，移除过时影画条目并明确音擎覆盖率元数据。

更早的发布和实现过程见[归档摘要](docs/archive/)与[当前变更日志](docs/changelog.md)。

## 架构

- `core/`：跨平台计算、规范化、校验和优化器逻辑。
- `webapp/`：Vue 界面、浏览器存储、Worker 适配和本地导入/维护流程。
- `backend/`：目录/API/静态服务、本地维护、Enka 代理和运维接口。
- `data/`：正式目录和来源fixture。账号、驱动盘、配装和计算选择保存在浏览器 IndexedDB `zzz-calculator-user-store` 及现有 localStorage fallback。
- `webapp/public/`：提交到仓库的图片和缩略图，生产环境不实时处理图片。

通用规则以[建模说明](docs/modeling.md)为准；新角色遵循[角色制作与维护指南](docs/character-authoring-guide.md)；长期行为以[回归契约](docs/regression-contract.md)验收。

## 环境与安装

- Node.js 20 或更高版本。
- 按锁文件安装根依赖和 WebApp 依赖：

```bash
npm install
npm --prefix webapp ci
```

## 本地运行

```bash
npm run build:webapp
PORT=8787 npm run serve
```

Windows PowerShell 使用 `$env:PORT='8787'; npm run serve`。准备完成的标准是监听器存在，并且 `/` 与 `/api/health` 返回 HTTP 200，健康结果为 `ok: true`、服务名为 `zzz_calculator`。

## 路由与数据边界

- `/` 是工作台；`/discs`、`/accounts`、`/import`、`/settings` 是 Vue 路由。
- `/maintenance` 只在维护开关开启时提供；`/internal/scans` 是受保护的运维路由。
- `/api/health`、`/api/meta`、`/api/catalog`、`/api/app-config` 是正常目录/服务接口。
- `/api/calculate/*`、`/api/analysis/*`、`/api/optimize/*` 是开发/验证接口，生产返回403；计算在浏览器执行。
- 已退役的 `/api/accounts*`、`/api/user-drive-discs*` 返回410；用户数据属于浏览器本地。Enka展柜导入另有运行配置门禁。

部署保持公开域名 `https://zzzcaculator.top`、浏览器存储键和对象仓库不变。本地维护只写入作者目录，不自动提交或部署。

## 测试与构建

```bash
npm test
npm run test:webapp
npm run test:layout
npm run build:webapp
npm run build:server
npm run build:pages
```

只改一个角色、公式、维护或优化行为时，优先运行 `package.json` 中的聚焦脚本。`npm run test:layout`会构建应用，并用 Chromium 检查桌面、缩放桌面和移动端容器。

## 生产发布

`main` CI负责验证并生成同一完整 SHA 的不可变产物。生产只由仓库所有者显式运行 **Promote deploy**，使用 `force=false` 晋级；普通推送 `main` 永远不会直接部署。请使用[生产发布手册](docs/production-deployment-runbook.md)、[部署控制面说明](deploy/production/README.md)和[恢复手册](deploy/production/RECOVERY.md)。GitHub Pages 是手动备用，通过 `npm run build:pages` 和 `.github/workflows/pages.yml` 发布。

## 扫描器集成

当前正式线为 ZZZ Scanner Next `1.0.49`、Helper `1.3.1`、协议 v4，使用 schema-v3 manifest。网页数据保持本地；Helper负责 `zzz-scanner://` 桥接和包生命周期。当前支持、哈希和兼容范围以 `config/scanner-manifest.json`、`config/helper-manifest.json` 以及 [ZZZ-Scanner.Next 仓库](https://github.com/ZztIsolation/ZZZ-Scanner.Next)为准。[1.0.43验收证据](docs/archive/scanner-integration-1.0.43.md)只用于历史追溯。

## 第三方服务与致谢

“展柜数据导入”使用 [Enka.Network](https://enka.network/) 提供的绝区零公开角色展柜 API。感谢其[绝区零 API 文档](https://github.com/EnkaNetwork/API-docs/blob/master/docs/zzz/api.md)及[上游仓库](https://github.com/EnkaNetwork/API-docs)；生成后的本地映射在 `data/enka_zzz_mapping.json` 记录来源修订。

ZZZ 计算器是独立项目，与 Enka.Network 及 HoYoverse 没有官方隶属、合作或背书关系。使用上游映射前仍需确认再分发边界。

## 文档

- [文档索引](docs/README.md)
- [角色制作与维护指南](docs/character-authoring-guide.md)
- [建模说明](docs/modeling.md)
- [长期回归契约](docs/regression-contract.md)
- [前端布局契约](docs/frontend-layout-contract.md)
- [佩洛伊斯建模](docs/pyrois-modeling.md)
- [风化/异常建模](docs/wind-anomaly-modeling.md)
- [流明评分建模](docs/luminescence-modeling.md)
- [生产部署手册](docs/production-deployment-runbook.md)
- [当前变更日志](docs/changelog.md)
- [历史归档](docs/archive/)

计算器模型、公开数据、前后端代码、示例、测试和发布脚本均在本仓库维护。Coding assistant 的项目入口见 [AGENTS.md](AGENTS.md)。
