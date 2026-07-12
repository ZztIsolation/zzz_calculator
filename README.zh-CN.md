# ZZZ 计算器

ZZZ 计算器是一个基于 Vue 3 的绝区零计算工具，覆盖角色面板、伤害建模、驱动盘仓库、本地优化、账号管理和扫描器导入。跨平台游戏逻辑集中在共享核心中，由浏览器与 Node.js 服务复用。

英文说明见 [README.md](README.md)。

## 架构

```text
core/                    共享计算、校验、仓库规则和优化搜索引擎
webapp/                  Vue 3 + Pinia + Vite 应用
  src/runtime/           浏览器 catalog、存储、扫描器和优化器适配器
  public/assets/         应用图片与其他公开资源
backend/                 Node.js API、文件适配器和构建产物服务
data/                    游戏资料与公开配置
examples/                稳定计算 fixture
scripts/                 Pages 与发布构建脚本
tests/                   Node 及跨运行时回归测试
benchmarks/              按需运行的性能基准
docs/                    建模说明、回归契约和详细变更日志
```

账号、驱动盘、导入记录和套装预设继续由浏览器通过既有 IndexedDB/localStorage schema 保存。公开站点的重优化在浏览器 Worker 中运行；Node 适配器为本地和自托管环境保留 worker thread 并行能力。

## 环境与安装

- Node.js 20
- npm

按锁文件安装 Vue 工作区依赖：

```bash
npm run install:webapp
```

根项目本身不引入第三方运行时依赖。

## 本地运行

构建 Vue 应用并启动 Node 服务：

```bash
npm start
```

默认地址是 `http://127.0.0.1:8787`。已有 Vue 构建产物时，可以跳过重新构建：

```bash
npm run serve
```

只开发前端并启用热更新时运行：

```bash
npm run dev:webapp
```

可通过 `PORT` 修改 Node 端口。服务默认只监听 `127.0.0.1`；容器或局域网公开监听必须显式设置 `HOST`（例如 `0.0.0.0`）。生产环境默认关闭维护功能，只有显式设置 `MAINTENANCE_ENABLED=true` 才会开放。维护写入默认只接受回环地址的浏览器 Origin；非回环来源必须逐项加入逗号分隔的 `MAINTENANCE_ALLOWED_ORIGINS`。

## 路由

| 路由 | 用途 |
| --- | --- |
| `/` | 工作台：角色配置、伤害配置、Buff、驱动盘方案与优化器 |
| `/discs` | 驱动盘仓库、套装预设、导入预览、扫描流程与词条分析 |
| `/accounts` | 本地账号新增、切换、改名和删除 |
| `/maintenance` | Vue 资料维护页，仅在维护功能开启时可用 |

`/calculate.html`、`/drive-discs.html` 和 `/accounts.html` 保留为兼容跳转。维护开启时，`/maintenance.html` 跳转到 `/maintenance`；维护关闭时两个维护页面路由返回 404，维护 API 返回 403。

## 本地数据

用户数据只保存在浏览器中，并按当前账号隔离。已有安装继续使用相同 IndexedDB 和 localStorage 键，不需要破坏性迁移。

本地 `data/user_drive_discs.json`、`imports/` 或 `data/imports/` 下的扫描器导出、构建产物、日志、下载文件和 Playwright 产物均被 Git 忽略。公开 catalog、示例、源资源和测试继续纳入版本控制。

## 测试与构建

安装 webapp 依赖后运行完整回归：

```bash
npm test
```

常用聚焦命令：

```bash
npm run test:webapp
npm --prefix webapp run build
npm run build:pages
npm run benchmark:optimizer
```

`npm test` 覆盖 Node 计算模型、优化器 fixture/进度/API/fuzz、存储兼容、扫描器桥接、生产服务行为和 Vue 测试。CI 使用 Node 20，在每个分支和 Pull Request 上按 `webapp/package-lock.json` 安装依赖、运行完整测试并构建 Vue 应用。

## GitHub Pages

生成静态部署产物：

```bash
npm run build:pages
```

产物写入 `dist/pages`，不会提交到 Git。内容包括 SPA、静态 catalog/config、`CNAME`、扫描器 manifest，以及可用时经过校验的当前扫描器包。`.github/workflows/pages.yml` 只在 `main` 更新时部署；默认 Pages 产物不包含维护页面。

## 扫描器集成

驱动盘扫描流程依赖一个注册 `zzz-scanner://` 协议的本地小助手。小助手在 `127.0.0.1:22355` 与网页通信，读取 `/downloads/zzz-scanner/manifest.json` 并准备 ZZZ Scanner Next。

当前支持的 OCR 运行时为 ZZZ Scanner Next `1.0.36`。manifest 固定包大小和 SHA-256，优先使用 Pages 同站包，并保留 GitHub Release 资产作为兜底；本地绝区零与云绝区零目标均受支持。扫描器包和扫描结果属于 Release 资产或本地缓存，不作为普通源码提交。

## 文档

- [建模说明](docs/modeling.md)
- [长期回归契约](docs/regression-contract.md)
- [详细变更日志](docs/changelog.md)

计算器模型、公开数据、前端、后端、示例、测试和发布脚本统一在本仓库维护。
