# ZZZ Calculator 生产部署全链路手册

本文档是 `zzz_calculator` 网站、Helper、Scanner、公开 manifest 和腾讯云 CDN 的唯一生产发布检查清单。每次发布必须复制“发布证据模板”到独立发布记录中逐项填写，不得只凭口头确认、旧 CI 绿灯或本机缓存判断成功。

## 当前 deploy 晋级架构

当前发布链保留 `deploy` 作为可审计的发布指针，但不再允许普通
`GITHUB_TOKEN` 直接写入受保护分支。`Deploy eligibility` 只读检查
`main -> deploy` 晋级 PR 的有效审批、最新 SHA、成功的 main CI 和同 SHA
artifact；`Promote deploy` 在 eligibility 成功后使用短期 GitHub App
installation token，以 `force=false` 快进 `deploy`，然后复用现有的生产
候选验证、SSH manager、健康检查和自动回滚。

一次性仓库配置必须完成以下项目后，工作流才允许真实晋级：

- 创建仅安装到本仓库的 `Deploy Promoter` GitHub App，授予 Metadata 读取、
  Contents 读写、Pull requests 读取和 Actions 读取权限。
- 在 Actions secrets 保存 `DEPLOY_PROMOTER_APP_ID` 与
  `DEPLOY_PROMOTER_PRIVATE_KEY`。私钥不得进入仓库、日志或发布证据。
- 用 active repository ruleset 仅匹配 `deploy`：禁止 force push/删除，保留
  `eligibility` required check，并只把该 App 加入 `always` bypass；确认规则内容
  后停用旧的 classic `deploy` protection，避免两套规则互相阻断。若仓库套餐不提供
  `Evaluate` 状态，则保持 ruleset active，并在首次发布前用只读 preflight 验证配置。
- `production` Environment 继续保存 SSH secrets 和 protected-branch policy，
  但不再配置 required reviewer；晋级 PR 的一次有效审批是唯一人工门禁。切换前
  保存原 reviewer 配置，失败时按发布记录恢复。

工作流在缺少 App secrets、候选 SHA、artifact 或 ruleset 保护时必须 fail
closed；不得回退到 PAT、管理员直推或 force push。每次发布证据必须记录
App token 只在 Promote job 使用、晋级前后 `deploy` SHA、approval review ID、
main CI run/artifact、ruleset 快照和生产回滚结果。

## 1. 基本原则

- [ ] 生产域名保持 `https://zzzcaculator.top`，避免改变浏览器 origin 和用户 IndexedDB/localStorage 所属域。
- [ ] 网站版本使用 `/opt/zzz_calculator/releases/<date>-<short-sha>` 不可变目录。
- [ ] `/opt/zzz_calculator/current` 只通过原子软链接切换，不直接覆盖正在运行的目录。
- [ ] Helper/Scanner 版本化对象放在 `/srv/zzz-download-origin/downloads/zzz-scanner/`，发布后不覆盖、不删除。
- [ ] HTML、`app-config` 和 manifest 不依赖长期缓存；带哈希的 JS/CSS 使用 immutable 缓存。
- [ ] 网站、Helper、Scanner 是三个可独立回档的生命周期；联合发布也必须分阶段切换。
- [ ] 浏览器用户数据只存储在用户本机。部署不得修改 IndexedDB 名称、版本、对象仓库、记录键、localStorage key 或生产域名。
- [ ] Calculator 全量热更新只做一次生产代码切换；数据补全随最终代码幂等执行，不设置迁移 feature flag，也不先部署兼容基础版本。
- [ ] 任何健康、哈希、Range、浏览器流程或数据保留门禁失败，立即停止扩大变更范围。
- [ ] 不得把密码、Token、Cookie、私钥、Basic Auth 内容写入本文档、仓库、命令脚本、CI 日志或发布记录。
- [ ] 生产现场 Nginx/systemd 配置不得被仓库模板直接覆盖。先保存现场副本，再做逐行 diff，只应用本次获批项。
- [ ] `main` 只负责集成、验证和生成不可变 artifact；推送 `main` 不得直接启动生产 CD。
- [ ] `deploy` 是唯一自动生产候选分支。正常发布必须经过获批的 `main` -> `deploy` 提升 PR，且只允许非强制快进到已经在 `main` 上验证的同一 SHA。
- [ ] `prepare-deploy.yml` 创建或刷新审批 PR；`promote-deploy.yml` 完成资格复核、以 `force=false` 更新 `deploy` 并调用生产 CD。CD 复用对应 `main` CI run 的 artifact，不重新构建。
- [ ] `deploy` 快进后，GitHub 可将审批 PR 立即标记为 indirect merge；若部署成功后仍为 open，收尾 job 使用受限的 `GITHUB_TOKEN` 关闭它。App token 保持 Pull requests 只读。PR 不产生 merge commit，closed/merged 记录继续接收 CD 成功/失败评论；失败时由 `resume-deploy.yml` 从冻结 `deploy` 复核同一 SHA/CI/artifact/审批后重试。
- [ ] `deploy` 禁止删除和 force-push，并要求 GitHub Actions app 的 `eligibility` status check。个人仓库无法在保留原始已验证 SHA 和 `updateRef(force:false)` 的同时强制 Actions-only writer、PR merge 与 required linear history；正常路径依靠 required eligibility、工作流门禁以及 `production` Environment 的 secrets/branch policy。人工/管理员直推也必须关联同 SHA 的获批 PR，否则只会 fail closed。

## 2. 发布类型与允许改动

### 2.1 纯网站更新

允许修改：

- Calculator 源码和构建产物。
- 新网站 release 目录、兼容回滚目录、`current` 软链接。
- 现有 Calculator systemd 配置的只读核验；本次不新增迁移开关或 drop-in。

禁止修改：

- Helper EXE、Scanner ZIP、GitHub 二进制 Release。
- `helper-manifest.json`、`manifest.json`。
- `/srv/zzz-download-origin` 中任何版本化对象。
- 腾讯 CDN 刷新、预热、域名、CNAME、回源 Host、HTTPS 或缓存规则。

### 2.2 纯 Helper/Scanner 更新

允许修改：

- GitHub Helper/Scanner Release。
- 源站新的不可变版本目录和文件。
- 对应 manifest 的候选副本与原子切换。
- 精确版本 URL 的 CDN 刷新和预热；manifest URL 只刷新。

禁止修改：

- Calculator `current` 和网站进程，除非兼容矩阵证明必须联合发布并重新分类。
- 旧版本二进制和旧 manifest 快照。
- CDN 全目录、全域名刷新。

### 2.3 网站与二进制联合更新

允许修改以上两类对象，但公开切换固定按下列顺序：

1. 上传并验证不可变二进制对象。
2. 精确刷新并预热版本化 CDN URL。
3. 切 Helper manifest。
4. 切网站。
5. 切 Scanner manifest。
6. 精确刷新两个 manifest URL，manifest 不预热。

顺序不得调整。旧网页、旧 Helper、新网页、新 Helper 和 Scanner 的兼容矩阵必须在发布冻结前通过。

## 3. 发布角色和变量

每次开始前填写，不要在命令中硬编码密码：

```text
RELEASE_TYPE=web|binary|combined
SOURCE_BRANCH=main
RELEASE_BRANCH=deploy
PROMOTION_PR=<number-or-empty>
CI_RUN_ID=<successful-main-ci-run-id>
CALCULATOR_COMMIT=<40-char-candidate-sha>
CALCULATOR_SHORT=<12-char-sha>
SCANNER_VERSION=<version-or-unchanged>
HELPER_VERSION=<version-or-unchanged>
RELEASE_NAME=<YYYYMMDD>-<short-sha>
PREVIOUS_RELEASE=<resolved-current-target>
CANDIDATE_PORT=8788
PRODUCTION_PORT=8787
```

本机 PowerShell 示例：

```powershell
$Commit = git rev-parse HEAD
$ShortCommit = $Commit.Substring(0, 12)
$ReleaseName = "$(Get-Date -Format yyyyMMdd)-$($ShortCommit.Substring(0, 7))"
```

服务器 shell 示例：

```bash
release_name='<YYYYMMDD>-<short-sha>'
candidate_dir="/opt/zzz_calculator/releases/$release_name"
previous_dir="$(readlink -f /opt/zzz_calculator/current)"
```

## 4. 发布前冻结

### 4.1 Git 与 CI

- [ ] `SOURCE_BRANCH=main` 与 `RELEASE_BRANCH=deploy` 已明确记录；候选提交为精确 40 位 SHA。
- [ ] `git status --porcelain --untracked-files=all` 输出为空。
- [ ] `main` 上的目标提交已经通过 `CI / verify`；对应 artifact/evidence 来自同一成功 push 或手动 `main` CI run。`main` -> `deploy` PR 只运行提升 eligibility，不重复运行完整 CI，也不生成第二份生产 artifact。
- [ ] 已从当前 `main` 运行 `prepare-deploy.yml`；它确认精确成功 CI/artifact 和快进关系后，创建或刷新来源为 `main`、目标为 `deploy` 的审批 PR。不得在 GitHub UI 合并该 PR。
- [ ] PR 已由当前 head 对应的有效人工 review 批准，且未被 `main` 或 `deploy` 前进 invalidated。
- [ ] 提升资格复核确认当前 `main` SHA、成功 CI SHA、artifact `.deployed-commit` 和 PR head 相同，并确认 `deploy` 可非强制快进到该 SHA。
- [ ] 提升工作流以 `force=false` 更新 `deploy` 后，再记录 `origin/deploy` 的完整 SHA；该 SHA 必须与 `main` CI SHA 完全一致。
- [ ] 记录提升 PR、CI run URL、artifact 名称、提交 SHA、有效 reviewer 快照、开始时间和结束时间；PR 在 `deploy` 快进后由 GitHub 标记 indirect merge，或由工作流关闭。CD 失败时仍在该 closed/merged 记录中写入恢复参数。
- [ ] 若需恢复，`resume-deploy.yml` 从冻结的当前 `deploy` 接收 `candidate_sha`、`ci_run_id` 和 `promotion_pr_number`；它必须确认 workflow SHA/`deploy` 未移动、PR 对候选 SHA 仍有有效审批且 artifact 未过期，才允许重新调用 CD。`main` 后续前进不使该候选陈旧。
- [ ] 检查 diff 未混入 `downloads/`、`dist/`、凭据、测试 sentinel 或不相关功能。

### 4.2 Calculator 门禁

- [ ] `npm test` 完整通过。
- [ ] `npm run build:webapp` 通过。
- [ ] `npm run build:pages` 通过；静态 `app-config` 使用预期的安全默认值。
- [ ] `npm run test:layout` 覆盖桌面、125% 缩放和移动端。
- [ ] Chrome 和 Edge 的关键 E2E 通过。
- [ ] 8788 候选以最终生产行为一次性通过全部功能和数据迁移验证，不依赖上线后再开启 feature flag。
- [ ] 候选首次渲染即为最终行为，没有先显示后隐藏或反向闪烁。
- [ ] 无专属数据时优化器 Top 10 的 ID、顺序和分数与基线逐项一致。
- [ ] 有专属数据时，只排除其他角色专属盘；自己的专属盘仍可选。
- [ ] 有主动排除数据时，优化器结果与从库存手工删除相同盘的 Top 10 ID、顺序和分数完全一致。
- [ ] 专属与主动排除重叠时只计入专属排除一次，纯专属、纯排除和混合耗尽原因准确。

### 4.3 浏览器旧数据兼容

固定保留一份上一生产版本格式的浏览器数据样本，至少包含：

- 多账号及当前账号。
- 驱动盘、扫描导入历史、套装预设。
- 首页/工作台选择、优化器配置、维护草稿。
- IndexedDB `zzz-calculator-user-store` v1、对象仓库 `state`、键 `userDriveDiscStore`。
- localStorage `zzz-calculator.userStore.v1` 回退数据。

逐项验证：

- [ ] 首次加载不丢字段、不改驱动盘 ID、不改内容/身份指纹。
- [ ] 当前账号不变，套装槽位不清空，优化器配置不覆盖。
- [ ] 缺失的可选新字段只归一化为安全默认值。
- [ ] `excludedForAgentIds` 缺失、非法、重复和未知角色 ID 的归一化符合预期；不改变库存 `version: 1`。
- [ ] 刷新、浏览器重启、账号切换后数据仍在。
- [ ] 30 件扫描、partial 导入和完整扫描保留本地增量字段。
- [ ] partial 导入保持 `removeMissing=false`，不会删除未返回记录。
- [ ] 原生导出再回导保留已支持的可选字段。
- [ ] 空账号、多账号同 ID、未知角色 ID 均通过。
- [ ] 套装精确名称补全只允许修改目标记录的 `setId`、`canonicalSetName`；`谶羽之誓` 补为 `zzz_wiki_2116`，`棘刺玫瑰` 补为 `zzz_wiki_2121`，未知或自定义非 Scanner ID 原样保留。
- [ ] `zzz_maintenance_vue_draft_v*` 不因版本升级被自动删除；不兼容的 v3 草稿可以忽略恢复，但 localStorage 中原始字节必须保持不变。

### 4.4 Helper/Scanner 门禁（仅二进制或联合发布）

- [ ] Scanner 与 Helper 版本、协议和最小版本契约一致。
- [ ] 两次相同参数的 Actions 构建均成功。
- [ ] 两次 ZIP、Helper EXE、manifest 和逐文件 SHA 可复现。
- [ ] FDD/自包含 OCR smoke 均成功。
- [ ] VC Runtime 来源、最低版本、PE 依赖和模型 SHA 通过。
- [ ] 实机 30/120/有效全量结果和已知风险已记录。
- [ ] Helper 老版本升级、事务确认、失败恢复和单实例状态通过。

## 5. 生成 Calculator 发布产物

> 适用范围：第 5-8 节保留的是 2026-08-05 全量热更新的历史手工双产物流程；固定提交 `4a8c9529b699285ce60df966da65c8a206b1bf54` 的兼容回滚包仅属于该流程。第 20 节的自动 CI/CD manager 不执行这些手工 staging 命令，也不接收或使用该固定 rollback artifact；它消费 `main` 成功 CI 生成、并由 `main` -> `deploy` 提升冻结的精确 artifact，从审计后密封的当前 release 构建严格不可变 rollback，并在生产切换前完成浏览器存储往返与服务器四阶段验证，任一失败即停止。

仅允许从干净提交打包：

```powershell
npm test
npm run build:server
```

本次 Calculator 全量单次热更新必须在两个互相独立的干净 worktree 中分别重复以上命令（历史手工流程）：

- 候选包来自成功 `main` CI run 绑定的精确 SHA；提升完成后 `origin/deploy` 必须指向同一 SHA。
- 兼容回滚包来自精确提交 `4a8c9529b699285ce60df966da65c8a206b1bf54`，不得用当前生产目录或普通旧版本代替。
- 两套包各自保留独立 artifact、evidence 和构建日志；任一包的提交、测试或哈希无法确认都停止发布。

自动 CD 路径不得在 `deploy` checkout 中重新执行构建，也不得以当前最新
`main` 替换已经提升的候选；它只下载 `CI_RUN_ID` 指定的
`server-release-<CALCULATOR_COMMIT>` artifact。

`scripts/package-server-release.js` 必须：

- 拒绝已修改文件和未忽略的未跟踪文件。
- 允许被 `.gitignore` 排除的本地 `downloads/` 候选文件存在。
- 仅复制 tracked 源码和本次生成的 `dist/pages`。
- 写入精确 `.deployed-commit`。
- 输出服务器包字节数、SHA-256、文件数、release 树哈希和 Pages 树哈希。
- 生成 `output/zzz-calculator-server-<sha>.evidence.json`。

记录以下证据：

```text
artifact_path=
artifact_size=
artifact_sha256=
release_file_count=
release_tree_sha256=
pages_file_count=
pages_total_bytes=
pages_tree_sha256=
deployed_commit=
```

候选包的 `.deployed-commit` 必须是成功 `main` CI 验证并已提升到
`deploy` 的完整候选 SHA；它同时是 `main` CI SHA 和 `deploy` SHA。兼容回滚包
必须是完整 `4a8c9529b699285ce60df966da65c8a206b1bf54`。该文件表示可执行代码
来源；后续只补入兼容静态资源时不得改写它，补齐后目录的实际字节状态由新的树
哈希单独记录。

## 6. 服务器只读基线

任何上传或切换之前，在服务器记录：

```bash
date -Is
readlink -f /opt/zzz_calculator/current
cat /opt/zzz_calculator/current/.deployed-commit
systemctl is-active zzz-calculator.service
systemctl show zzz-calculator.service -p MainPID -p NRestarts -p ActiveEnterTimestamp
systemctl cat zzz-calculator.service
nginx -t
df -h /opt /srv
free -h
curl -fsS http://127.0.0.1:8787/api/health
curl -fsS http://127.0.0.1:8787/api/app-config
sha256sum /srv/zzz-download-origin/downloads/zzz-scanner/helper-manifest.json
sha256sum /srv/zzz-download-origin/downloads/zzz-scanner/manifest.json
find /opt/zzz_calculator/releases -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort
```

基线检查：

- [ ] `current`、`.deployed-commit` 和计划中的前一版本一致。
- [ ] Node 单实例，服务 active，`NRestarts` 无异常增长。
- [ ] Nginx 配置检查通过。
- [ ] 磁盘足以同时保存新目录、兼容回滚目录和上传包。
- [ ] app-config 的维护、遥测和产品功能开关符合预期。
- [ ] 两个 manifest 哈希已保存。
- [ ] 精确 `4a8c9529b699285ce60df966da65c8a206b1bf54` 兼容回滚包及 evidence 已准备且可读，计划中的最终回滚目录尚不存在。

## 7. 安全上传和暂存解压

上传到临时目录，不直接写最终 release：

```bash
install -d -m 0750 /opt/zzz_calculator/staging
```

- [ ] 候选包和 `4a8c952` 兼容回滚包分别上传到 `/opt/zzz_calculator/staging/<artifact>.part`。
- [ ] 服务器分别运行 `sha256sum`，结果必须与各自本机 evidence 一致。
- [ ] 两个最终目录和两个 `.staging` 目录都不存在；任一已存在即停止并调查，不覆盖、不递归清理。
- [ ] 解压前分别核对 artifact SHA/字节数，并检查归档清单不存在绝对路径、`..`、符号链接或设备节点。
- [ ] 两套包分别解压到 `/opt/zzz_calculator/releases/<release>.staging`，确保与最终 release 位于同一文件系统。
- [ ] 在未补入任何静态资源的原始暂存树上，分别核对 `.deployed-commit`、release 文件数/树哈希和 Pages 文件数/字节数/树哈希。
- [ ] 原始 evidence 全部匹配前，不得执行资源补齐、权限调整或最终目录改名。
- [ ] 资源补齐、复核和权限收紧完成后，才按第 8 节原子重命名两个目录。

示例：

```bash
candidate_commit='<merged-main-40-char-sha>'
compat_commit='4a8c9529b699285ce60df966da65c8a206b1bf54'
candidate_dir='/opt/zzz_calculator/releases/<candidate-release>'
rollback_dir='/opt/zzz_calculator/releases/<compat-rollback-release>'
candidate_staging_dir="${candidate_dir}.staging"
rollback_staging_dir="${rollback_dir}.staging"

for target in "$candidate_dir" "$rollback_dir" "$candidate_staging_dir" "$rollback_staging_dir"; do
  test ! -e "$target"
done

install -d -m 0750 "$candidate_staging_dir" "$rollback_staging_dir"
tar --no-same-owner --no-same-permissions \
  -xzf "/opt/zzz_calculator/staging/<candidate-artifact>.part" \
  -C "$candidate_staging_dir"
tar --no-same-owner --no-same-permissions \
  -xzf "/opt/zzz_calculator/staging/<compat-artifact>.part" \
  -C "$rollback_staging_dir"

test "$(cat "$candidate_staging_dir/.deployed-commit")" = "$candidate_commit"
test "$(cat "$rollback_staging_dir/.deployed-commit")" = "$compat_commit"
# 此处按两个 evidence 分别复算并核对未经补齐的 releaseTree 和 pagesTree。
```

兼容回滚目录必须来自上述独立干净包。不得用 `cp -a "$previous_dir" "$rollback_dir"` 把当前生产代码伪装成兼容回滚代码，也不得把候选的 `.deployed-commit` 写入回滚目录。

## 8. 新旧静态资源双向兼容

部署前已打开的旧标签页可能在切换后继续请求旧哈希 chunk 或旧资源；回档后已加载新 HTML 的标签页也可能请求新 chunk、图片等非哈希资源。因此 `dist/pages/static/app` 与 `dist/pages/assets` 必须一起双向保留：

- [ ] 当前生产目录、候选暂存目录和 `4a8c952` 兼容回滚暂存目录的 `dist/pages/static/app`、`dist/pages/assets` 都真实存在。
- [ ] 在复制前逐对比较三方同相对路径文件；任一同路径内容不同都立即停止，不能依赖 `cp -an` 静默跳过冲突。
- [ ] 将当前生产的两棵资源树补入候选和兼容回滚，再将候选与兼容回滚双向补齐，使两个暂存目录都包含三方资源并保持原有同名文件不变。
- [ ] 所有资源补齐都使用 `cp -an`，只创建缺失文件，绝不覆盖候选或回滚暂存目录中的同名文件。
- [ ] 旧版独有 URL 在候选中返回 200；新版独有 URL，包括新增的非哈希图片或 JSON，在回滚目录中也返回 200。
- [ ] 同一路径在新旧版本中内容不同但未使用版本化文件名时停止发布；`cp -an` 无法同时保存一个 URL 的两份内容，必须先改成兼容内容或版本化 URL。
- [ ] 候选和兼容回滚目录分别记录两棵目录的文件数、字节数与树哈希。
- [ ] 新 release、上一生产 release 和兼容回滚目录至少保留 7 天。

示例：

```bash
assert_no_resource_conflicts() {
  local left="$1"
  local right="$2"
  local relative_path
  local failed=0
  while IFS= read -r -d '' relative_path; do
    relative_path="${relative_path#./}"
    if [ -f "$right/$relative_path" ] && \
       ! cmp -s -- "$left/$relative_path" "$right/$relative_path"; then
      printf 'static resource conflict: %s\n' "$relative_path" >&2
      failed=1
    fi
  done < <(cd "$left" && find . -type f -print0)
  test "$failed" -eq 0
}

for resource_tree in dist/pages/static/app dist/pages/assets; do
  for root in "$previous_dir" "$candidate_staging_dir" "$rollback_staging_dir"; do
    test -d "$root/$resource_tree"
  done

  assert_no_resource_conflicts "$previous_dir/$resource_tree" "$candidate_staging_dir/$resource_tree"
  assert_no_resource_conflicts "$previous_dir/$resource_tree" "$rollback_staging_dir/$resource_tree"
  assert_no_resource_conflicts "$candidate_staging_dir/$resource_tree" "$rollback_staging_dir/$resource_tree"

  cp -an -- "$previous_dir/$resource_tree/." "$candidate_staging_dir/$resource_tree/"
  cp -an -- "$previous_dir/$resource_tree/." "$rollback_staging_dir/$resource_tree/"
  cp -an -- "$candidate_staging_dir/$resource_tree/." "$rollback_staging_dir/$resource_tree/"
  cp -an -- "$rollback_staging_dir/$resource_tree/." "$candidate_staging_dir/$resource_tree/"

  diff -u \
    <(cd "$candidate_staging_dir/$resource_tree" && find . -type f -printf '%P\n' | LC_ALL=C sort) \
    <(cd "$rollback_staging_dir/$resource_tree" && find . -type f -printf '%P\n' | LC_ALL=C sort)
done

test "$(cat "$candidate_staging_dir/.deployed-commit")" = "$candidate_commit"
test "$(cat "$rollback_staging_dir/.deployed-commit")" = "$compat_commit"

# 记录补齐后的新树哈希；它们不再等于原始包 evidence 中的树哈希。
chown -R zzzcalc:zzzcalc "$candidate_staging_dir" "$rollback_staging_dir"
find "$candidate_staging_dir" "$rollback_staging_dir" -type d -exec chmod 0755 {} +
find "$candidate_staging_dir" "$rollback_staging_dir" -type f -exec chmod 0644 {} +

test ! -e "$candidate_dir"
test ! -e "$rollback_dir"
mv -T -- "$rollback_staging_dir" "$rollback_dir"
mv -T -- "$candidate_staging_dir" "$candidate_dir"
```

补齐后先做静态资源与回滚验证：

- [ ] 分别从候选和回滚目录生成 `static/app`、`assets` 的相对路径清单与 SHA-256 清单；两个目录的资源清单一致，且补齐操作没有改变三方原有同名文件。
- [ ] 用候选目录启动 8788，逐项请求旧版与新版清单中的 URL，状态均为 200，缓存头符合 HTML/no-store 与哈希资源/immutable 约定。
- [ ] 停止候选后用兼容回滚目录启动同一 8788，再请求同一份旧/新 URL 清单；新增非哈希资源也必须为 200。
- [ ] 回滚目录的 `.deployed-commit` 仍指向真实回滚代码提交；额外静态文件不得被误记为代码升级。
- [ ] 任一路径缺失、被覆盖或哈希异常，停止切换并重建候选与回滚目录。

## 9. 8788 候选预检

CI/CD 管理器不得用裸 `sudo -u zzzcalc` 命令启动候选，也不得只针对
`WorkingDirectory` 参数做临时降级。它先读取 `systemd-run` client 和 PID 1
manager 版本并取较低者作为 effective version；任一版本无法解析或 effective
version 低于 v239 时，在任何候选代码运行前停止。v239 是固定的最低沙箱
基线；v242、v248 画像分别额外启用 `RestrictSUIDSGID=yes`、
`PrivateIPC=yes` 作为纵深防护。管理器必须一次性按已解析版本选择
画像，禁止先提交新属性、失败后删除属性重试。

v239 基线必须包含：`PrivateNetwork` 与独立 mount namespace、
`ProtectSystem=strict`、只读候选 bind mount、受限且带
`nosuid,nodev,noexec` 的私有 tmpfs、空 capability、
`NoNewPrivileges`、AF_UNIX 禁止、transient service 的 `RemoveIPC=yes`，
以及对 `ipc`、`msgctl`、`msgget`、`msgrcv`、`msgsnd`、`semctl`、`semget`、
`semop`、`semtimedop`、`shmat`、`shmctl`、`shmdt`、`shmget`、
`mq_getsetattr`、`mq_notify`、`mq_open`、`mq_timedreceive`、`mq_timedsend`、
`mq_unlink` 的显式窄 syscall deny 和隐藏 `/proc/sysvipc`、
`/dev/mqueue`。不得使用 systemd
更宽的 `@ipc` syscall group，因为它还会阻断普通 pipe 和 worker 自身的
运行调用。`SystemCallArchitectures=native` 禁止 compat ABI 绕过，并由 inert
probe 在服务器实际 native 架构上证明 deny 生效。per-unit
`RemoveIPC` 只负责该瞬态单元停止后的兜底清理，不得为兼容而修改主机全局
logind 同名配置。worker 必须在自身启动 Node 前核验 seccomp、
`NoNewPrivs`、全部 capability mask、tmpfs mount flags、生产目录不可达、
网络仅有 `lo` 和两个 IPC 路径不可访问；`ipcmk -Q/-S/-M` 必须以 `EPERM`
失败，固定 `setarch` 探针也必须证明 `personality` syscall 以 `EPERM`
失败。若意外创建 IPC 对象，先用 `ipcrm` 清理，再令整次操作失败。

隔离服务的 `LimitFSIZE` 固定为 4 MiB，用于容纳当前约 2.3 MiB 的聚合
`/api/catalog` 响应，但不改变每个输入 catalog 文件 1 MiB 的门禁。health、
catalog 和 app-config 响应只能写入私有 validation tmpfs；curl 同时接收 4 MiB
上限，写入成功后 worker 还必须核验响应为 `zzzvalidate` 自有、`0600`、
单硬链接、非空且不超过 4 MiB 的普通文件，再交给 `jq`。Rocky/systemd 239
CI 必须用一个无 `Content-Length` 且大于 1 MiB、小于 4 MiB 的 catalog 完整
运行 release-mode worker，并用一个大于 4 MiB 的响应证明上限仍会拒绝且无
transient unit/probe 目录残留；不能只运行 capability probe。

在 claim incoming artifact 和 current、candidate、rollback、candidate
四阶段之前，manager 先以同一套完整参数运行一次固定、root-owned 的 inert
capability probe。探针只验证
沙箱能力和固定、manager-owned 的 bind-source 哨兵，不读取 release 的 backend/data、不启动 Node，也不执行任何候选
字节。探针任一属性、mount、seccomp 或隔离断言失败时只失败一次，清理
transient unit、完整 cgroup 和临时可写目录后停止；不得自动重试或降低沙箱
强度。探针成功后才允许进入四阶段应用验证。

最终候选预检：

生产 Helper/Scanner manifest 的权威文件分别是 Nginx download origin 上的 `/srv/zzz-download-origin/downloads/zzz-scanner/helper-manifest.json` 和 `/srv/zzz-download-origin/downloads/zzz-scanner/manifest.json`。`build:server` 的 8788 Node 候选不一定包含 Helper manifest，因此其 404 不能作为 manifest 改变或发布失败的证据；即使包内存在 Scanner manifest，也必须核对 `/srv` 文件 SHA，并通过当前生产 Nginx/公网 manifest URL 验证。纯网站发布不得向 `/srv/zzz-download-origin` 复制任何文件。

- [ ] `/api/health` 200。
- [ ] `/`、`/discs`、`/settings` 200。
- [ ] SPA 直接刷新正常。
- [ ] catalog 和 `/api/app-config` 正常。
- [ ] app-config 与计划中的最终生产值一致；候选验证后不再通过迁移 feature flag 改变代码路径。
- [ ] 旧数据哨兵完整，数据补全只修改获准的 `setId`、`canonicalSetName`。
- [ ] `/srv/zzz-download-origin` 中 Helper/Scanner manifest 哈希与基线一致；8788 只用于候选应用行为，不替代 Nginx download origin 验证。
- [ ] 页面首次渲染直接出现功能，不发生先显示后隐藏或反向闪烁。
- [ ] 逐盘锁定、解除、跨角色确认、未知角色筛选通过。
- [ ] 六槽预览、缺失引用、统一选择器、取消草稿不落库通过。
- [ ] 优化器排除其他角色专属盘，自己的专属盘仍可选。
- [ ] 普通新增/取消排除即时保存；锁定转排除、排除转锁定分别出现准确确认；其他角色锁定盘的排除按钮为橙色禁用态。
- [ ] “已排除 + 角色”筛选同时返回主动排除该角色的盘及锁给其他角色的盘，并标明原因。
- [ ] 手动选择和已有套装仍显示排除盘；使用限制变化后旧 Top 10 仍可查看计算并明确提示重新优化。
- [ ] `settlementType: "luminescence"`、`teammateAttack`、`luminescenceDamageSharePct` 在保存、降级读取和再次升级后仍完整。

同源降级演练使用隔离浏览器资料，并始终保持 `http://127.0.0.1:8788` origin：

1. [ ] 当前生产代码种入旧版多账号、库存、优化器与维护草稿哨兵。
2. [ ] 候选代码加载并完成套装身份补全，再写入新的流明配置。
3. [ ] 兼容回滚代码读取同一浏览器资料；除获准补全字段外，全部哨兵和新字段保持。
4. [ ] 再次启动候选代码并读取同一资料；补全幂等，驱动盘能正确显示图标/效果并参与套装优化。
5. [ ] v3 维护草稿可以不恢复到编辑器，但 localStorage 原始值必须逐字节不变。

每次更换 8788 代码目录前停止前一个候选进程并确认端口已释放。降级演练任一步失败都禁止生产切换；不得用上线后再开迁移 flag 代替这项验证。

## 10. 纯网站单次生产切换

切换前再次确认两个 manifest 哈希不变、候选与兼容回滚演练均已通过。以下代码切换只执行一次：

```bash
ln -sfn "$candidate_dir" /opt/zzz_calculator/current.next
mv -Tf /opt/zzz_calculator/current.next /opt/zzz_calculator/current
systemctl restart zzz-calculator.service
```

控制端执行 15 秒健康门禁：

- 每秒请求 `http://127.0.0.1:8787/api/health`。
- 15 秒内未恢复，立即把 `current` 切到兼容回滚目录并重启。
- 健康恢复后继续检查 `.deployed-commit`、路由、app-config、单实例和日志。

注意：`journalctl --since` 在旧系统上可能不接受带时区的 ISO 字符串。优先使用 `--since '5 minutes ago'` 或服务器实际支持的本地时间格式。日志查询失败不能被误写成应用启动失败，也不能掩盖真实健康失败。

纯网站切换完成后再次核对：

- [ ] Helper manifest SHA 与基线相同。
- [ ] Scanner manifest SHA 与基线相同。
- [ ] `/srv/zzz-download-origin` 无新修改。
- [ ] 未执行 CDN 刷新或预热。

## 11. Helper/Scanner 二进制发布

### 11.1 GitHub Release

- [ ] 从精确 Actions artifact 创建草稿 Release。
- [ ] 上传完成后从 GitHub 重新下载，不用本地原文件替代验证。
- [ ] 大文件上传若客户端超时，先查询服务器已接收资产，只补缺失项。
- [ ] 核对名称、大小、SHA-256 和版本号。
- [ ] 先发布 Helper，再发布 Scanner；仅在计划明确时调整 Latest。

### 11.2 源站对象

上传 `.part` 到临时目录，服务器复算 SHA 后原子移动到新的版本目录：

```text
/srv/zzz-download-origin/downloads/zzz-scanner/helper/<version>/ZZZ-Scanner-Helper.exe
/srv/zzz-download-origin/downloads/zzz-scanner/<version>/ZZZ-Scanner.Next-win-x64-fdd.zip
/srv/zzz-download-origin/downloads/zzz-scanner/<version>/ZZZ-Scanner.Next-win-x64-self-contained.zip
```

验证：

- [ ] 源站 HTTPS 返回 200。
- [ ] `Accept-Ranges: bytes`。
- [ ] Range 请求返回 206 和正确总长度。
- [ ] 完整下载 SHA 与 Actions、GitHub 相同。

### 11.3 腾讯 CDN

只在腾讯云“刷新预热”中提交精确版本 URL：

1. URL 刷新。
2. 相同 URL 的 URL 预热。
3. 等待任务完成。
4. 验证 Range 206、长度、完整 SHA 和 Cache Hit。

新版本 URL 如果曾返回 404，可能存在 CDN 负缓存；精确刷新是硬门禁。不得因为源站已经 200 就跳过。

manifest URL 只执行 URL 刷新，不执行预热：

```text
https://download.zzzcaculator.top/downloads/zzz-scanner/helper-manifest.json
https://download.zzzcaculator.top/downloads/zzz-scanner/manifest.json
```

不得修改 CDN 域名、CNAME、回源 Host、HTTPS 或缓存规则；不得刷新整个目录或域名。

## 12. 联合发布 manifest 顺序

每次 manifest 替换都使用临时文件、服务器端解析/哈希校验和同目录原子移动，并保留带时间戳快照。

1. [ ] 新二进制三源验证通过。
2. [ ] 原子切 Helper manifest。
3. [ ] 主站和 CDN 读取到新 Helper manifest。
4. [ ] 切网站，15 秒健康门禁通过。
5. [ ] 网站功能与 Helper 升级路径通过。
6. [ ] 原子切 Scanner manifest。
7. [ ] 刷新两个 manifest CDN URL，不预热。
8. [ ] 主站/CDN 的 manifest 字节哈希一致。

Helper 成功确认更新后通常不支持自动降级。Helper 严重故障时先回退网站和 Scanner manifest 止损，再发布更高版本 fix-forward；不能把恢复旧 Helper manifest 当作已升级客户端的降级方案。

## 13. 单次切换约束

本次全量 Calculator 热更新不采用“兼容基础代码 + feature flag”两阶段启用：

1. [ ] 数据补全、最终 UI、计算输入和回滚兼容均已在 8788 候选/回滚/再升级演练中通过。
2. [ ] 不创建迁移专用环境变量、systemd drop-in 或第二阶段重启步骤。
3. [ ] 生产只执行第 10 节的一次 `current` 原子切换与一次服务重启。
4. [ ] 15 秒健康门禁失败时直接切到已演练的兼容回滚目录，不尝试临时改变数据或开关。
5. [ ] 不强制刷新正在扫描、优化或编辑的旧标签页；新旧静态资源由第 8 节的双向保留承接。

## 14. 公网验收

- [ ] 首页 200 且 `Cache-Control: no-store`。
- [ ] 带哈希 JS/CSS 返回 immutable。
- [ ] 没有意外 Service Worker。
- [ ] `/`、`/discs`、`/settings` 和 SPA 刷新正常。
- [ ] Chrome 和 Edge 通过。
- [ ] 独立浏览器资料中的 IndexedDB/localStorage 哨兵刷新后不变。
- [ ] Helper 未安装首屏立即显示下载和重连入口。
- [ ] 已安装 Helper 能连接，版本/协议/Scanner 状态正确。
- [ ] 若本次涉及扫描，至少完成一次受控 30 件扫描或记录无法完成的外部条件。
- [ ] `/api/app-config` 与切换前记录的最终期望一致，生产验收期间未发生第二次配置启用或代码切换。
- [ ] 浏览器控制脚本遇到后台轮询重渲染时重新定位按钮，不复用失效 DOM 引用。

## 15. 监控时间点

在切换后 5、15、60 分钟分别记录：

```bash
date -Is
systemctl is-active zzz-calculator.service
systemctl show zzz-calculator.service -p MainPID -p NRestarts
curl -fsS http://127.0.0.1:8787/api/health
curl -fsS http://127.0.0.1:8787/api/app-config
journalctl -u zzz-calculator.service --since '10 minutes ago' --no-pager
```

并检查：

- [ ] Node 只有一个生产实例。
- [ ] `NRestarts` 无增长。
- [ ] Nginx/应用无新 5xx。
- [ ] 内存、磁盘无异常。
- [ ] 旧数据哨兵仍在。
- [ ] 锁定、解除、筛选和优化器排除正常（涉及本功能时）。
- [ ] Helper/Scanner manifest 哈希未被纯网站发布改变。

## 16. 回档决策

### 16.1 UI 或数据兼容故障

1. 停止扩大变更，不写入或清理任何浏览器存储。
2. 将 `current` 原子切回已演练的兼容回滚目录并重启，不新增临时 feature flag。
3. 执行 15 秒健康门禁，并用同源隔离资料复核旧数据、新字段、v3 维护草稿和静态资源 URL。
4. 保留候选及回滚目录，基于证据修复前进。

### 16.2 最终代码故障

1. 切回已通过“候选写入 -> 回滚读取”演练的兼容回滚 release；不能退到无法保留新增字段或新驱动盘身份的版本。
2. 重启并验证健康。
3. 保留用户已写入的可选字段、优化器语义和全部非目标字段。
4. 不回到不理解新语义的旧版本作为常规回档。

### 16.3 兼容回滚失败

兼容回滚目录启动、静态 URL 或同源降级读取任一验证失败时，生产切换门禁不成立，禁止上线。若生产切换后才发现该问题，优先保持服务健康和用户数据原样，停止新的写入路径并 fix-forward；不得删除浏览器字段或维护草稿来迁就旧代码。

### 16.4 Scanner 故障

只恢复 Scanner 旧 manifest 并刷新该 manifest URL；保留网站和 Helper，除非兼容矩阵要求联合回退。

### 16.5 Helper 严重故障

恢复旧网站和 Scanner manifest，停止新升级；已确认升级客户端通过更高版本 Helper 修复前进。

### 16.6 CDN 故障

恢复源站 manifest 快照并刷新两个 manifest URL。保留版本化对象和 GitHub Release，保证正在下载的事务仍有后备源。

回档时不删除新旧网站目录、GitHub Release、源站版本化对象或 CDN 对象，至少保留 7 天。

## 17. 已知操作陷阱

- 旧 `systemd-run` 的风险不只有 `--working-directory`。必须先通过 v239 最低版本门禁，按 v239/v242/v248 固定画像构造完整瞬态单元，并在候选代码前运行 inert capability probe；未知属性或隔离失效后禁止删参数重试。
- `RemoveIPC=` 同时存在 per-unit 与 logind 全局语义。本流程只设置 transient service 的 `RemoveIPC=yes` 作为停止时兜底，绝不修改 logind；IPC 的首要门禁仍是显式窄 syscall deny、路径隐藏和 worker 的 `ipcmk`/`ipcrm` 自证。
- `journalctl --since` 可能不接受带时区 ISO 时间。用相对时间并把日志命令状态与应用健康分开判断。
- Playwright 的 `reuseExistingServer` 可能复用旧构建。发布测试前确认端口 PID、`.deployed-commit` 和 bundle 哈希。
- 非哈希 public 文本资源必须固定行尾并使用内容版本化 URL；Windows CRLF 与 Linux LF 会被静态资源同路径冲突门禁正确拦截。
- GitHub 大文件上传超时不代表服务端未接收。先列资产，只补缺失项。
- CDN 会缓存版本 URL 的 404。新对象发布后必须精确刷新再预热。
- 动态按钮会因轮询重渲染而失效。浏览器自动化点击前重新定位元素。
- Windows 组合命令可能被本机策略拦截。拆成可核验的上传、校验、切换步骤，不把“未执行”误判为失败回档。
- 构建脚本解析再格式化 manifest 会改变字节哈希。需要跨仓库一致时原字节复制。
- NativeAOT 二进制可能嵌入仓库提交 SHA。冻结二进制版本时固定 SourceRevisionId 并核对原始哈希。
- 不要把本地测试下载源、loopback manifest 或临时 HTTP 服务留给正常 Helper 进程。

## 18. 发布证据模板

```markdown
# 发布记录：<release-name>

## 范围
- 发布类型：
- 负责人：
- 开始时间：
- 结束时间：
- 用户可见变更：
- 明确不包含：

## Git / CI
- source branch：`main`
- release branch：`deploy`
- promotion PR：
- Calculator commit / frozen candidate SHA：
- Scanner commit（如适用）：
- PR：
- promotion method：non-forced fast-forward（`force=false`）；生产成功且 PR head 未变化后由工作流关闭 PR
- main CI run / URL：
- deploy update SHA：
- promotion evidence：
- Scanner Actions run 1 / run 2（如适用）：

## Calculator 产物
- artifact：
- size：
- SHA-256：
- release file count / tree SHA：
- Pages file count / bytes / tree SHA：
- .deployed-commit：

## 二进制产物（如适用）
- Helper version / size / SHA：
- Scanner FDD size / SHA：
- Scanner self-contained size / SHA：
- Helper manifest SHA：
- Scanner manifest SHA：
- GitHub / origin / CDN 三源 SHA：
- Range 206：

## 旧数据证据
- 样本版本：
- IndexedDB 哨兵：
- localStorage 哨兵：
- 当前账号：
- 驱动盘 ID/指纹：
- 套装槽位：
- 优化器设置：
- 刷新/重启/切账号：
- 扫描/partial/完整导入：
- 原生导出回导：

## 服务器基线
- previous current：
- previous commit：
- PID / NRestarts：
- disk / memory：
- app-config：
- Helper manifest SHA：
- Scanner manifest SHA：
- rollback directory：

## 候选预检
- 8788 最终候选：
- current -> candidate -> rollback -> candidate：
- routes：
- static/app old/new URL：
- assets old/new/non-hashed URL：
- browser：
- old-data sentinel：

## 生产切换
- new current：
- health recovery ms：
- PID / NRestarts：
- app-config：
- production code switches（应为 1）：
- manifest hash unchanged：
- CDN action（纯网站应为 none）：

## 监控
- +5 min：
- +15 min：
- +60 min：
- 5xx：
- browser/user test：

## 回档
- rollback target：
- rollback command reviewed：
- rollback rehearsal/result：

## 已知风险与批准
- 风险：
- 证据：
- 批准人/时间：
```

## 19. 发布后安全收尾

- [ ] 删除服务器 staging 中已核验且不再需要的 `.part` 文件，不删除 release。
- [ ] 关闭 8788 候选进程和本地临时 HTTP 服务。
- [ ] 确认生产 Helper/Scanner/Node 无测试环境变量。
- [ ] 保留新旧 release、兼容回滚目录和版本化下载对象至少 7 天。
- [ ] 轮换发布过程中暴露过的密码，改用 SSH key 和最小权限账号。
- [ ] 把证据记录提交到批准的位置，但不包含任何凭据。
- [ ] 对证书到期、遥测基础设施、密码轮换等非本次范围事项单独建任务，不在上线窗口临时混入。

## 20. Calculator CI/CD 门禁

Calculator 的自动化入口是 `.github/workflows/ci.yml`、
`.github/workflows/audit-deploy-baseline.yml`、
`.github/workflows/prepare-deploy.yml`、
`.github/workflows/promote-deploy.yml`、
`.github/workflows/deploy-production.yml`、
`.github/workflows/resume-deploy.yml` 和
`.github/workflows/rollback-production.yml`。CI 的 required check 固定为
`CI / verify`；只有 `main` 的成功 CI run 才上传绑定完整 SHA 的服务器产物和
evidence。`promote-deploy.yml` 是 `main` -> `deploy` 的唯一正常提升入口，CD
只能下载该成功 CI run 的精确产物，禁止在部署任务中重新构建。

### 20.1 分支迁移顺序

首次切换或在仓库尚未有 `deploy` 时，严格按以下顺序执行，不要把当前最新
`main` 自动当作首个生产候选：

1. 将仓库变量 `PRODUCTION_CD_ENABLED` 临时设为 `false`，确认没有仍在运行的
   旧 `main` `workflow_run` 部署；等待或取消旧运行并保留其审计记录。
2. 在只读服务器基线中读取线上 `.deployed-commit`，确认该提交是 `main` 的祖先；
   以该提交创建 `deploy`，而不是直接把 `deploy` 指向最新 `main`。若不是祖先，
   停止迁移并人工处理基线差异。
3. 先为 `deploy` 配置禁止删除和 force-push；保留 `main` 现有保护规则和
   `production` Environment 审批人/受保护分支策略。当前个人仓库无法同时实现
   Actions-only writer、required PR merge、required linear history 和“保留原始
   `main` merge SHA 的 `updateRef(force:false)`”，因此不得配置会阻止受控快进或
   改写 SHA 的规则。
4. 合并本次工作流并确认新 `main` 的 `CI / verify` 成功后，仍让 `deploy` 停在第
   2 步的线上 SHA。从当前 `main` 运行 `audit-deploy-baseline.yml`，先选 `audit`，
   再选 `dry-run`。它只在 `PRODUCTION_CD_ENABLED=false` 时调用新 reusable 控制面，
   复用该线上 SHA 的成功 `main` CI artifact，且不推进 `deploy`、不切换生产
   `current`。若该 14 天 artifact 已过期，停止迁移并重新设计基线，不得绕过。
5. 确认 audit/dry-run 前后线上 release、服务、PID、`NRestarts`、manifest、state
   pair 和 marker 全部零影响。启用仓库的“Allow GitHub Actions to create and
   approve pull requests”设置，供 `prepare-deploy.yml` 建立 bot-authored 审批记录；
   该工作流不提交 approval，仍由人类审阅者批准当前 head。当前仓库只有 owner 一名
   collaborator 且该设置初始为 false，因此本次迁移必须启用它，不能改由 owner
   自建并自批同一 PR。
6. 保持 gate=false，运行 prepare 并完成人工 approval，使 GitHub Actions 的
   `eligibility` check 首次在候选 SHA 上成功出现。随后为 `deploy` 增加 strict
   required status check `eligibility`，限定 GitHub Actions app（当前 app id
   `15368`），并启用 enforce admins；继续禁止 force-push/删除，但不启用 required
   PR merge、required linear history 或 writer restriction。promotion dispatch
   自身会再次真实运行 eligibility，不能用 skipped job 满足该状态。
7. 全部零影响复核通过后，才将 `PRODUCTION_CD_ENABLED` 恢复为 `true`。变量变更
   本身不触发部署；后续从 `main` 运行 prepare，人工审批后再运行 promote。
   promote 复核 PR、审批、当前 `main`、成功 CI、artifact 和远端 `deploy`，以
   `force=false` 快进并显式 `workflow_call` 生产 CD。审批 PR 会在 head 可从 base
   到达时被 GitHub 标记为 indirect merge，或由工作流关闭；失败仍保留该记录和
   冻结候选，可从 `deploy` 运行 `resume-deploy.yml` 复核后重试。

- [ ] GitHub `main` 已启用 PR、`CI / verify`、分支最新、conversation resolution、禁止 force push/删除；管理员应急绕过保留审计记录。
- [ ] `deploy` 已创建在当前线上 `.deployed-commit` 对应的基线（该提交必须是 `main` 的祖先），并启用 enforce admins、禁止 force-push/删除和 GitHub Actions app 的 strict required `eligibility`；未配置会阻断 `updateRef(force:false)` 或改写原始 SHA 的 required PR merge/linear-history 规则。人工直推也必须有同 SHA 获批 PR 和 eligibility，只作为有审计的应急绕过。
- [ ] `production` Environment 继续使用现有 protected-branch 审批策略；审批人和 `PROD_HOST`、`PROD_USER`、`PROD_SSH_PRIVATE_KEY`、`PROD_KNOWN_HOSTS` 已配置。reusable promotion 的 caller ref 是 `main`，resume 是 `deploy`；未来 custom policy 必须同时允许二者，除非另行重构触发方式。`PRODUCTION_CD_ENABLED=false` 时真实 deploy 跳过，但 `audit-deploy-baseline.yml` 和 deploy-ref 手动 audit/dry-run 仍可执行。
- [ ] `promote-deploy.yml` 已重新检查 PR 来源/目标、必要审批、最新 `main` SHA、成功的同 SHA CI、artifact/evidence 和非强制快进关系；随后以 `force=false` 把 `deploy` 更新到同一 SHA 并上传提升证据。PR 由 GitHub 标记 indirect merge 或由工作流关闭；失败时从冻结 `deploy` 使用原参数运行 `resume-deploy.yml`。
- [ ] 服务器已从 `main` CI 验证且 `deploy` 冻结的同一固定 SHA 运行 `deploy/production/bootstrap-zzz-calculator-deploy.sh`，已安装 manager/worker/gateway/sudoers 哈希与该 SHA 一致；`zzzdeploy` 仅使用锁定密码的专用 key，sudo 只允许 root-owned 部署程序。控制面有变化时必须先事务性重跑 bootstrap，且初始化不得触碰 `current`、生产 systemd 服务、Nginx 或下载源。
- [ ] `systemd-run` client 与 PID 1 manager 版本均可解析，取两者较低值后的 effective version 不低于 v239；使用固定 v239 baseline，只有 v242/v248 画像才分别增加 `RestrictSUIDSGID`/`PrivateIPC`。root-owned inert capability probe 已在 claim incoming artifact 和候选代码前以完整参数一次通过；没有发生未知属性重试、参数降级或候选字节提前执行。
- [ ] v239 baseline 以 `SystemCallArchitectures=native` 禁止 compat ABI 绕过；显式窄 IPC syscall deny 和 `personality` syscall deny、per-unit `RemoveIPC=yes`、IPC 路径隐藏、AF_UNIX 禁止、空 capabilities、`NoNewPrivileges`、私有 network/mount namespace 和只读生产视图均由 worker 在服务器实际 native 架构上自证。Rocky/RHEL v239 不接受 transient `LockPersonality=`，因此以同一 seccomp filter 直接拒绝该 syscall，并由固定 `setarch` 探针验证返回 `EPERM`；没有使用会误伤 pipe/worker 调用的 `@ipc` syscall group。CI-only parser 诊断必须在真实 v239 PID 1 上逐项提交完整 baseline、严格清理每个诊断 unit，并先证明两个假属性能在一次结果中同时汇总；完整 inert probe 仍是组合画像的最终门禁。`ipcmk -Q/-S/-M` 全部以 `EPERM` 失败，且没有修改 logind `RemoveIPC` 或其他生产全局配置。
- [ ] 第一次旧版迁移只允许审计确认的精确 tuple：`current=git-2e7f874bc034`、commit `2e7f874bc034871f03b5738f48d7d05685b36ea9`、`last-release=git-2e7f874bc034`、`previous-release=rollback-2e7f874bc034`、migration marker 不存在。current 必须匹配固定的完整内容/静态摘要、`zzzcalc:zzzcalc`、目录 `0755`、文件 `0644`，无链接、硬链接、特殊文件或嵌套挂载；不得现场 `chown/chmod`。旧 `previous-release` 仅保留为历史对象，首次 managed deploy 前禁止手动 rollback。
- [ ] 完整 current 只能密封到 `processing/job.*` 的 `root:root 0700` 区域，`zzzcalc` 与 `zzzvalidate` 均不可读取；`validation/job.*` 只能接收白名单目录和空示例库存生成的脱敏副本。真实库存、telemetry 和未知 data 文件不得进入验证账户范围。candidate、rollback staging、最终 release 和手动 rollback target 仍须同时对两个 runtime principal 可读且不可写。
- [ ] legacy current 的 full/portable/static/metadata 摘要、state tuple、服务 PID、`NRestarts`、Nginx 与两个 manifest 在 seal、四阶段验证、切换前和 evidence 前保持不变。evidence 必须记录 state pair 与 marker 的前后值：audit/dry-run 逐字一致，committed deploy/rollback 与最终 release 映射一致。第一次成功 deploy 写入新 rollback/candidate state 和 root-owned marker；首次切换后失败则 `previous=last=实际严格回滚副本`，后续 managed 失败保留原 previous。marker 写入后 legacy 例外永久失效。
- [ ] 当前服务端持久化基线继续为：`StateDirectory`、`ZZZ_CALCULATOR_DATA_DIR`、`SCAN_TELEMETRY_DIR` 为空，`data/user_drive_discs.json`、`data/scan-telemetry` 不存在，maintenance/scan telemetry 均关闭且 `/api/user-drive-discs` 返回 `410`。任一项变化均停止部署；未来启用服务端写入必须单独建设外部 StateDirectory 和迁移流程。
- [ ] 提升/部署前后复核 `main` CI SHA、`deploy` SHA、产物 SHA-256、`.deployed-commit`、安全 tar 路径和静态资源冲突；`.part` 上传只在服务器复算通过后转为最终文件。`main` 后续前进不得替换已冻结候选。
- [ ] `audit` 除持久化 history evidence 外不改变生产；`dry-run` 只临时写 root-only `processing`、脱敏 `validation`、消费本次 incoming 上传并持久化 history evidence，不切换 `current`、不重启生产服务。无论 inert probe 或四阶段验证成功还是失败，均复核 `current` target/commit、full/portable/static/metadata digest、state pair/marker、生产 PID、`NRestarts`、Nginx 和两个 manifest 前后不变，并确认无残留 transient unit/cgroup/可写验证目录。evidence 中的 `systemdRunVersion`、`systemdManagerVersion`、`systemdEffectiveVersion`、`validationSandboxProfile`、`validationSandboxProbe` 与 `validationCleanup` 必须分别绑定 client/PID 1/effective 版本、所选画像、inert probe 结果和最终清理结果；成功 dry-run/deploy 的探针必须为 `active/exited/success/0` 且清理必须为 `clean`。`deploy` 才会使用不可变 `git-<short-sha>` release、兼容回滚目录和原子 current 切换；切换后必须在 15 秒内首次恢复健康，再以同一 PID 连续稳定 15 秒，任一门禁失败即回滚。
- [ ] 首次启用前，隔离浏览器必须在同一 origin 完成“种入并只读核对旧数据 -> 候选迁移并写入新字段 -> 当前生产读取/往返写入 -> 候选再次升级”的存储门禁；服务器 manager 另行完成 current -> candidate -> rollback -> candidate 四阶段应用验证。真实生产切换必须另获明确批准。
- [ ] 自动回滚覆盖脚本错误及可捕获的 HUP/INT/TERM；SIGKILL 或宿主机断电无法运行 shell trap。下次 manager 调用必须对 `current`、state pair 与 marker 不一致 fail closed，并在人工只读审计后恢复，不得宣称不可捕获中断会自动回滚。
- [ ] 常规手动 `audit`/`dry-run` 必须从 `deploy` 运行，且只读/零影响；唯一例外是首次迁移时从 `main` 运行、且只允许 gate=false 的 `audit-deploy-baseline.yml` wrapper。`rollback --previous` 必须从 `deploy` 发起并先确认分支 SHA 与保护状态未变化。`PRODUCTION_CD_ENABLED` 在 audit 与 dry-run 都成功并完成零影响复核前保持 `false`；变量变更本身不得触发部署。
