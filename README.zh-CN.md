# ZZZ 计算器

ZZZ 计算器是一个基于 Vue 3 和共享核心的绝区零工具，覆盖角色面板、伤害快照、驱动盘优化、本地仓库和扫描器导入。计算与优化在浏览器本地运行；Node 服务负责目录、静态资源、本地维护和受限集成。

语言： [English](README.md)

## 上传更新摘要

- **2026-11-19 — 危局强袭战 3.3 第三期场地 Buff 与敌情**：新增掠霜、奔霆、极魄三条场地 Buff 与熔狱行赭、库萨里库、焚昼余火·法厄同、异构·基塔布鲁四条敌情；异构·基塔布鲁因弱点数据变化新建版本条目，场地页默认期变为危局强袭战 3.3 第三期。
- **2026-11-18 — 文档体系重组**：AGENTS.md 增加项目概览与按任务路由表；角色专属文档收拢到 `docs/characters/`；回归契约精简为跨角色不变量；新增周期目录维护手册；移出已提交的临时调查产物。不改变计算、目录、部署流程或用户数据。
- **2026-11-06 — 危局强袭战 3.3 第二期 Boss 与场地 Buff**：新增第二期场地 Buff、四条敌情和三张本地 Boss 头像；未建模机制仍只保留在说明中，维护页调整按保存结果保留。
- **2026-11-03 — 暂时隐藏猫又与浅羽悠真**：两人的模型、技能、Buff、头像、Enka 映射和维护入口保留，但核对完成前不出现在工作台、优化器和 Enka 可选目录；伊芙琳保持可见。
- **2026-11-01 — 补全伊芙琳技能倍率表**：补齐普通攻击、闪避、支援和普通特殊技倍率，并覆盖完整技能表的当前模型约定。

更早的发布和实现过程见[归档摘要](docs/archive)与[当前变更日志](docs/changelog.md)。

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

当前正式线为 ZZZ Scanner Next `1.0.51`、Helper `1.3.1`、协议 v4，使用 schema-v3 manifest。网页数据保持本地；Helper负责 `zzz-scanner://` 桥接和包生命周期。当前支持、哈希和兼容范围以 `config/scanner-manifest.json`、`config/helper-manifest.json` 以及 [ZZZ-Scanner.Next 仓库](https://github.com/ZztIsolation/ZZZ-Scanner.Next)为准。[1.0.43验收证据](docs/archive/scanner-integration-1.0.43.md)只用于历史追溯。

## 第三方服务与致谢

“展柜数据导入”使用 [Enka.Network](https://enka.network/) 提供的绝区零公开角色展柜 API。感谢其[绝区零 API 文档](https://github.com/EnkaNetwork/API-docs/blob/master/docs/zzz/api.md)及[上游仓库](https://github.com/EnkaNetwork/API-docs)；生成后的本地映射在 `data/enka_zzz_mapping.json` 记录来源修订。

ZZZ 计算器是独立项目，与 Enka.Network 及 HoYoverse 没有官方隶属、合作或背书关系。使用上游映射前仍需确认再分发边界。

## 文档

- [文档索引](docs/README.md)：按任务列出全部现行规范、角色专题、部署手册和历史档案。

计算器模型、公开数据、前后端代码、示例、测试和发布脚本均在本仓库维护。Coding assistant 的项目入口见 [AGENTS.md](AGENTS.md)。
