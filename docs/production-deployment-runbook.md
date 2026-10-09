# ZZZ Calculator 生产发布手册

状态：当前生产操作入口。核对日期：2026-10-08；基准提交：`6355fbd310cc5836aff0e78bc3fb46e68a5356f8`。

本文只描述当前 `main` → `deploy` → production 流程。旧手动切换、历史迁移和事故时序保存在 [归档发布手册](archive/production-deployment-runbook-before-2026-10-08.md)；恢复操作见 [恢复手册](../deploy/production/RECOVERY.md)，部署控制面安装见 [管理器说明](../deploy/production/README.md)。文档本身不授权发布，也不包含密钥。

## 当前发布边界

- `main` 负责合并、CI验证和生成不可变 `server-release-<完整SHA>` artifact；推送 `main` 不部署生产。
- 生产晋级只接受仓库所有者从 `main` 显式 dispatch `Promote deploy`，传入完整 `candidate_sha` 和 `confirm_production=true`。
- eligibility 冻结候选，核对 `main` 历史、同SHA成功CI、未过期artifact、`deploy`严格快进关系和 owner 身份；写入使用 Deploy Promoter App 的 `force=false`。
- CD复用同一CI artifact，不在部署任务重新构建；`.deployed-commit`、健康、静态资源、浏览器存储和回滚证据必须指向同一候选。
- 生产失败使用 `Resume deploy` 重试冻结候选，或由 owner 显式运行 `Rollback production`；不得直接push `deploy`、force-push、PAT回退或手工修改线上目录。
- `Audit deploy baseline` 和生产工作流的 `dry-run` 只读/隔离运行，不改变公开版本；它们不是生产发布成功证据。

## 发布前冻结

1. 确认目标是网站、Helper/Scanner，还是联合发布。三者可独立回档；联合发布按“二进制对象 → CDN版本URL → Helper manifest → 网站 → Scanner manifest → 精确刷新manifest”顺序。
2. 检查分支、工作区和 `data/*.json`。将维护页新增、修改和删除按角色/资源逐项与候选比较；特别检查克拉蕾影画删除、默认循环和手工描述，不得让旧导入器或发布拆分恢复它们。
3. 角色/规则变更读取[角色制作指南](character-authoring-guide.md)和[回归契约](regression-contract.md)，运行受影响聚焦测试。共享核心变更补足普通、白盒、compiled/dense、固定评分、Worker和优化器路径。
4. UI变更运行 `npm run build:webapp`；布局和维护交互运行 `npm run test:layout` 及对应 Playwright 场景。检查保存、刷新、重新打开和浏览器本地数据，不把截图单独当成保存成功证据。
5. 在干净提交上运行 `npm test`、`npm run build:server`、需要时 `npm run build:pages`；记录完整SHA、CI run、artifact名称和构建状态。`build:server`拒绝脏工作区。
6. 保持生产域名 `https://zzzcaculator.top`、IndexedDB/localStorage名称、对象仓库、记录键和现有 manifest兼容；不增加临时迁移开关来绕过失败。

## 晋级步骤

```text
main commit + CI success + exact artifact
        │
        ▼
Promote deploy(candidate_sha, confirm_production=true)
        │
        ├─ eligibility：owner / ancestry / CI / artifact / ruleset
        ├─ Deploy Promoter App：deploy fast-forward, force=false
        └─ Deploy production：下载同一artifact → candidate验证 → 受保护环境 → 服务切换 → 公网验收
```

- 从 `main` dispatch 后，候选SHA即冻结；后续main提交不混入该发布。
- 记录 promotion run/attempt、actor、candidate/deploy前后SHA、CI/artifact、ruleset、生产 evidence、`.deployed-commit`、服务健康与回滚目录。
- 生产服务的实际切换仍由受保护的 manager 执行，并保留健康、Nginx、静态资源、同源存储、Helper/Scanner manifest和自动回滚门禁。manager 命令契约不要在本文件复制，按[控制面说明](../deploy/production/README.md#control-plane-responsibilities)和脚本核对。

## 计算器候选验收

- 浏览器当前页面、`/`、`/discs`、`/settings`、`/import`、`/api/health`、`/api/catalog`、`/api/app-config`均按本次功能范围检查。
- 生产计算、分析、优化API预期返回403；退役账号和库存API预期返回410。计算在浏览器执行，公开服务不接收用户库存做共享计算。
- 维护功能只在显式配置开启时出现；保存使用版本条件，失败保留草稿并允许重试。线上目录必须包含候选中核对过的人工数据。
- 发布后用目标页面做一次短冒烟，核对当前SHA/route/health/catalog和浏览器本地资料；不要把长时间探索性浏览器检查混入发布门禁。

## Helper / Scanner 边界

纯网站更新不得修改已发布Helper/Scanner二进制、manifest、下载源站对象或CDN规则。纯二进制更新不得改变Calculator `current`，除非兼容矩阵明确要求联合发布。
当前正式线、包哈希和Windows支持范围以仓库 `config/*-manifest.json`、README扫描器章节和 Scanner.Next 仓库为准；[Scanner 1.0.43证据](archive/scanner-integration-1.0.43.md)只用于历史追溯。

## 失败、恢复与回档

- 候选尚未切换：保留 `deploy` 冻结，先按 [RECOVERY.md](../deploy/production/RECOVERY.md) 做 bounded audit；超时不能当作生产未变化的证明。
- CD验证失败或服务不健康：依赖 manager 的自动回滚 evidence；停止扩大变更，核对当前/回滚SHA和健康。
- 生产切换后需要重试：只使用 `Resume deploy`，再次验证原 promotion run、同一SHA/CI/artifact和 `deploy`未移动。
- 必须回档：owner dispatch `Rollback production`，使用服务器记录的 previous release；不得删除新旧目录或浏览器数据来迁就旧版本。
- Helper严重故障：按联合发布兼容矩阵止损，不能把已升级客户端当作可通过旧manifest降级。

## 证据模板

```text
范围：Calculator / Helper / Scanner / 联合
candidate_sha：
main CI run / artifact：
promotion run / attempt：
requested_by / triggering_actor：
deploy before / after：
工作区和维护数据核对：
聚焦测试 / build / layout：
候选 route / health / catalog / app-config：
浏览器存储刷新/重启/切账号：
生产 current / .deployed-commit / service / NRestarts：
manifest / tree / rollback evidence：
未通过项与授权边界：
```

具体门禁由[回归契约](regression-contract.md#发布前验收)、`.github/workflows/`和`node scripts/validate-deployment-config.js`共同定义。静态校验不触发部署。
