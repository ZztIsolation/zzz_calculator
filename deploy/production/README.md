# 生产部署管理器（deploy manager）

本文描述已安装的部署控制面，**不是**常规发布检查清单：候选冻结、CI/产物核对和由所有者发起的晋级见[仓库发布手册](../../docs/production-deployment-runbook.md)，有界恢复见[RECOVERY.md](RECOVERY.md)。状态：现行说明。核对日期：2026-11-18；基准提交：`9d51640c23697a849bdd3674b7f645a30c9f76b0`（部署控制面源码）。

## 控制面职责

管理器独立于 Calculator 服务、Nginx、下载源和 `current` 符号链接。它负责加锁的部署事务、候选校验、沙箱执行、证据记录和有界的自动回滚；不得暴露 shell、执行任意候选命令，也不得在应用日志里接收凭据。

专用账号 `zzzdeploy` 使用 root 拥有的强制命令 SSH 网关。网关只接受文档化的管理器动作，以及白名单 incoming 目录下有界的上传；候选应用的校验由另一个被锁定的 `zzzvalidate` 账号运行。安装脚本和 sudoers 策略属于同一份经过评审的控制面包。

## 一次性初始化与升级

只有在安装或升级控制面时，才在生产主机上以 root 运行 bootstrap。公钥不得进入仓库，命令执行后必须 unset：

```sh
export ZZZDEPLOY_PUBLIC_KEY='ssh-ed25519 AAAA...'
./bootstrap-zzz-calculator-deploy.sh
unset ZZZDEPLOY_PUBLIC_KEY
```

bootstrap 在修改前会校验账号/组身份、密码锁定状态、shell、属主、权限、SSH 网关、管理器、校验 worker、sudoers、必需命令和主机兼容性；它以事务方式安装文件，失败时恢复原有 inode 和元数据。应从生成该控制面包的、已固定且评审过的 `main` 提交重新运行，然后比对已安装文件的哈希。

它只能更新专用部署账号、网关、管理器、校验 worker、sudoers 及其托管目录，必须保持 Calculator 的 `current`、发布内容、Nginx、systemd 服务和下载 manifest 不变。控制面升级不是应用发布，也不意味着重启服务。

## 管理器命令约定

已安装的管理器通过强制网关或受保护的生产工作流调用：

```text
zzz-calculator-deploy audit
zzz-calculator-deploy dry-run [--artifact <incoming-part>] [--evidence <incoming-part>] [--expected-sha <sha256>] [--expected-commit <40-char-sha>]
zzz-calculator-deploy deploy  [--artifact <incoming-part>] [--evidence <incoming-part>] --expected-sha <sha256> --expected-commit <40-char-sha>
zzz-calculator-deploy rollback --previous
```

产物只能解析自 `/var/lib/zzz-calculator-deploy/incoming` 之下，且必须与预期 SHA 一致。`deploy` 需要同时提供产物和证据、完整的 40 位候选提交、调用方对冻结 `deploy` 引用的检查，以及受保护的生产环境。`audit` 只读；`dry-run` 校验并隔离候选，不改变公开的当前发布；`deploy` 执行唯一经批准的原子切换；`rollback --previous` 使用服务器记录的上一个发布。

管理器施加有界的服务端期限：audit 90 秒加 30 秒清理，dry-run 600 加 120，deploy 600 加 180，rollback 180 加 120。超时即失败，**绝不证明**之前的状态未变。监督进程拥有进程组，并在处理证据之前终止子进程。

## 不变量与证据

每个操作都在 `/run/lock/zzz-calculator-deploy.lock` 上串行。工作前先快照状态文件、发布目录树、服务身份、Nginx、manifest 和迁移标记；在隔离单元中校验候选/当前/回滚；并原子写入经过 schema 校验的证据记录。证据记录动作、候选/产物哈希、已部署提交、发布路径、切换状态、校验顺序、服务与 manifest 结果和回滚状态，不得包含凭据、进程环境、任意候选输出或完整用户数据。

成功的 deploy 证据必须显示校验顺序 `current,candidate,rollback,candidate`、已提交的切换、与候选一致的 `.deployed-commit`、健康的服务，以及生成的 `rollback-<short-sha>` 发布。成功的 audit 没有 deploy 切换；成功的 dry-run 使用校验用回滚，并保持公开的 current 不变。切换后的事务如果在最终不变量或公开健康检查上失败，**必须**自动回滚。

管理器必须保持浏览器来源和本地数据约定：生产保持 `https://zzzcaculator.top`，不引入服务端库存导入，部署绝不改变 IndexedDB/localStorage 的名称、store 或记录键。

## 主机与安全边界

管理器在解析客户端和 PID1 两个版本后，只接受受支持的 systemd 版本；它选择固定的 v239/v242/v248 沙箱配置，不会在较旧主机上对未知属性重试。候选代码在校验沙箱中运行：部署根目录只读、tmpfs 有界、无法访问生产密钥。强制网关禁用 PTY、agent/X11/端口转发和任意 shell 执行。

生产服务、Nginx、下载源和发布目录由管理器检查，但不是可以盲目覆盖的模板：保留现场副本，只应用明确评审过的控制面改动。私钥、密码、cookie 或 Basic Auth 值绝不能写进本文档、命令、证据或日志。

## 工作流归属

各工作流的触发分支、`PRODUCTION_CD_ENABLED` 要求和输入参数见发布手册的[工作流门禁表](../../docs/production-deployment-runbook.md#工作流门禁表)。用 `node scripts/validate-deployment-config.js` 校验工作流与控制面约定；它只做静态检查，不会连接生产，也不会部署。
