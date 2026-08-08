# ZZZ Calculator 生产部署全链路手册

本文档是 `zzz_calculator` 网站、Helper、Scanner、公开 manifest 和腾讯云 CDN 的唯一生产发布检查清单。每次发布必须复制“发布证据模板”到独立发布记录中逐项填写，不得只凭口头确认、旧 CI 绿灯或本机缓存判断成功。

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
CALCULATOR_COMMIT=<40-char-sha>
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

- [ ] 当前分支是获批发布分支，目标提交为精确 40 位 SHA。
- [ ] `git status --porcelain --untracked-files=all` 输出为空。
- [ ] `git rev-parse HEAD` 与 `git rev-parse origin/main` 符合本次合入策略。
- [ ] PR 已获批；要求保留提交历史的发布不得 squash。
- [ ] `main` 合入后产生的新 CI 已全绿，不能复用分支或旧提交的绿灯。
- [ ] 记录 CI run URL、提交 SHA、开始时间和结束时间。
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

仅允许从干净提交打包：

```powershell
npm test
npm run build:server
```

本次 Calculator 全量单次热更新必须在两个互相独立的干净 worktree 中分别重复以上命令：

- 候选包来自 PR 合入后的精确 `origin/main` merge SHA。
- 兼容回滚包来自精确提交 `4a8c9529b699285ce60df966da65c8a206b1bf54`，不得用当前生产目录或普通旧版本代替。
- 两套包各自保留独立 artifact、evidence 和构建日志；任一包的提交、测试或哈希无法确认都停止发布。

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

候选包的 `.deployed-commit` 必须是合入后的完整 main SHA，兼容回滚包必须是完整 `4a8c9529b699285ce60df966da65c8a206b1bf54`。该文件表示可执行代码来源；后续只补入兼容静态资源时不得改写它，补齐后目录的实际字节状态由新的树哈希单独记录。

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

以 `zzzcalc` 用户、生产工作目录和明确环境变量启动候选：

```bash
sudo -u zzzcalc env \
  NODE_ENV=production \
  PORT=8788 \
  SCAN_TELEMETRY_ENABLED=false \
  /usr/bin/node "$candidate_dir/backend/server.js"
```

如使用 `systemd-run`，先查询服务器版本支持的参数。旧版本可能不支持较新的 `--working-directory`；改用兼容的 `-p WorkingDirectory=<dir>`，并在失败后确认候选进程实际未启动。

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

- 旧 `systemd-run` 可能不支持新参数。先查询版本，使用 `-p WorkingDirectory=` 兼容写法。
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
- Calculator commit：
- Scanner commit（如适用）：
- PR：
- merge method：merge commit / rebase（禁止 squash 的发布必须保留提交）
- main CI：
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
`.github/workflows/deploy-production.yml` 和
`.github/workflows/rollback-production.yml`。CI 的 required check 固定为
`CI / verify`，只在 `main` 的成功 CI run 上上传绑定完整 SHA 的服务器产物和
evidence；CD 只能下载触发它的同一次 run 的产物，禁止在部署任务中重新构建。

- [ ] GitHub `main` 已启用 PR、`CI / verify`、分支最新、conversation resolution、禁止 force push/删除；管理员应急绕过保留审计记录。
- [ ] `production` Environment 只允许 protected `main`，审批人和 `PROD_HOST`、`PROD_USER`、`PROD_SSH_PRIVATE_KEY`、`PROD_KNOWN_HOSTS` 已配置；`PRODUCTION_CD_ENABLED` 未明确设置为 `true` 时所有 CD 任务跳过。
- [ ] 服务器已运行 `deploy/production/bootstrap-zzz-calculator-deploy.sh`，`zzzdeploy` 仅使用锁定密码的专用 key，sudo 只允许 root-owned 部署程序；初始化不得触碰 `current`、systemd、Nginx 或下载源。
- [ ] 审批后仍复核 `main` SHA、产物 SHA-256、`.deployed-commit`、安全 tar 路径和静态资源冲突；`.part` 上传只在服务器复算通过后转为最终文件。
- [ ] `audit` 只读；`dry-run` 只写 `validation`；`deploy` 使用不可变 `git-<short-sha>` release、兼容回滚目录、原子 current 切换、15 秒健康门禁；失败自动切回并重启一次。
- [ ] 首次启用前使用隔离浏览器完成当前版 -> 候选版 -> 回滚版 -> 候选版的本地存储哨兵演练；真实生产切换必须另获明确批准。
