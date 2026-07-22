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
- [ ] 任何健康、哈希、Range、浏览器流程或数据保留门禁失败，立即停止扩大变更范围。
- [ ] 不得把密码、Token、Cookie、私钥、Basic Auth 内容写入本文档、仓库、命令脚本、CI 日志或发布记录。
- [ ] 生产现场 Nginx/systemd 配置不得被仓库模板直接覆盖。先保存现场副本，再做逐行 diff，只应用本次获批项。

## 2. 发布类型与允许改动

### 2.1 纯网站更新

允许修改：

- Calculator 源码和构建产物。
- 新网站 release 目录、兼容回滚目录、`current` 软链接。
- 经批准的 Calculator systemd feature-flag drop-in。

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
- [ ] 无功能开关时，生产界面与当前版本对照一致。
- [ ] 开启功能开关时，候选功能完整且没有先显示后隐藏。
- [ ] 无专属数据时优化器 Top 10 的 ID、顺序和分数与基线逐项一致。
- [ ] 有专属数据时，只排除其他角色专属盘；自己的专属盘仍可选。

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
- [ ] 刷新、浏览器重启、账号切换后数据仍在。
- [ ] 30 件扫描、partial 导入和完整扫描保留本地增量字段。
- [ ] partial 导入保持 `removeMissing=false`，不会删除未返回记录。
- [ ] 原生导出再回导保留已支持的可选字段。
- [ ] 空账号、多账号同 ID、未知角色 ID 均通过。

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
- [ ] 回滚目标目录真实存在且可读。

## 7. 安全上传和不可变解压

上传到临时目录，不直接写最终 release：

```bash
install -d -m 0750 /opt/zzz_calculator/staging
```

- [ ] 本机上传到 `/opt/zzz_calculator/staging/<artifact>.part`。
- [ ] 服务器运行 `sha256sum`，结果必须与本机一致。
- [ ] 最终目录不存在；若已存在，停止并调查，不覆盖。
- [ ] 解压到同文件系统的临时目录 `<release>.staging`。
- [ ] 核对 `.deployed-commit`、文件数和 Pages 树哈希。
- [ ] 设置正确 owner/group 和只读权限。
- [ ] 原子重命名为 `/opt/zzz_calculator/releases/<release>`。

示例：

```bash
test ! -e "$candidate_dir"
staging_dir="${candidate_dir}.staging"
rm -rf -- "$staging_dir"
install -d -o zzzcalc -g zzzcalc -m 0750 "$staging_dir"
tar -xzf "/opt/zzz_calculator/staging/<artifact>.part" -C "$staging_dir"
test "$(cat "$staging_dir/.deployed-commit")" = '<40-char-sha>'
chown -R zzzcalc:zzzcalc "$staging_dir"
mv "$staging_dir" "$candidate_dir"
```

不得把 `rm -rf` 用于计算后未核验的路径；删除前必须打印并确认绝对路径位于 `/opt/zzz_calculator/releases/` 或 staging 内。

## 8. 新旧静态 chunk 双向兼容

部署前已打开的旧标签页可能在切换后继续请求旧哈希 chunk；回档后已加载新 HTML 的标签页也可能请求新 chunk。因此：

- [ ] 将当前生产 `dist/pages/static/app` 中旧哈希文件补入新 release。
- [ ] 建立“旧代码 + 新哈希 chunk”的独立兼容回滚目录。
- [ ] 只补充不存在的哈希文件，不覆盖同名文件。
- [ ] 新 release 和兼容回滚目录分别记录 chunk 文件数与树哈希。
- [ ] 保留两套目录至少 7 天。

示例：

```bash
cp -an "$previous_dir/dist/pages/static/app/." "$candidate_dir/dist/pages/static/app/"
rollback_dir="/opt/zzz_calculator/releases/<rollback-name>"
cp -a "$previous_dir" "$rollback_dir"
cp -an "$candidate_dir/dist/pages/static/app/." "$rollback_dir/dist/pages/static/app/"
```

## 9. 8788 候选预检

以 `zzzcalc` 用户、生产工作目录和明确环境变量启动候选：

```bash
sudo -u zzzcalc env \
  NODE_ENV=production \
  PORT=8788 \
  SCAN_TELEMETRY_ENABLED=false \
  DRIVE_DISC_RESERVATIONS_UI_ENABLED=false \
  /usr/bin/node "$candidate_dir/backend/server.js"
```

如使用 `systemd-run`，先查询服务器版本支持的参数。旧版本可能不支持较新的 `--working-directory`；改用兼容的 `-p WorkingDirectory=<dir>`，并在失败后确认候选进程实际未启动。

关闭开关预检：

- [ ] `/api/health` 200。
- [ ] `/`、`/discs`、`/settings` 200。
- [ ] SPA 直接刷新正常。
- [ ] catalog 和 `/api/app-config` 正常。
- [ ] `driveDiscReservationsUiEnabled=false`。
- [ ] 旧数据哨兵完整，现有 UI 未出现预约控件。
- [ ] Helper/Scanner manifest 哈希与基线一致。

开启开关预检：

- [ ] 使用相同 release、相同旧数据哨兵，仅把开关设为 `true`。
- [ ] 页面首次渲染直接出现功能，不发生先显示后隐藏或反向闪烁。
- [ ] 逐盘锁定、解除、跨角色确认、未知角色筛选通过。
- [ ] 六槽预览、缺失引用、统一选择器、取消草稿不落库通过。
- [ ] 优化器排除其他角色专属盘，自己的专属盘仍可选。
- [ ] 切回关闭状态后数据仍在，UI 隐藏但约束仍生效。

预检结束后停止候选并确认 8788 已释放。

## 10. 纯网站生产切换

切换前再次确认两个 manifest 哈希不变。然后：

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

## 13. Feature Flag 两阶段启用

可选 UI 必须先部署代码、后启用：

1. [ ] 最终代码以 `DRIVE_DISC_RESERVATIONS_UI_ENABLED=false` 上线。
2. [ ] 健康、路由、旧数据哨兵、扫描和 manifest 哈希通过。
3. [ ] 创建 systemd drop-in，而不是覆盖完整 unit：

```ini
# /etc/systemd/system/zzz-calculator.service.d/20-drive-disc-reservations.conf
[Service]
Environment=DRIVE_DISC_RESERVATIONS_UI_ENABLED=true
```

4. [ ] `systemctl daemon-reload`。
5. [ ] `systemctl restart zzz-calculator.service`。
6. [ ] 15 秒健康门禁通过。
7. [ ] `/api/app-config` 明确为 true。
8. [ ] 不强制刷新正在扫描、优化或编辑的旧标签页。

关闭 UI 的首选回档：把 drop-in 中值改为 false（或移除该单一 drop-in），daemon-reload 后重启。数据和优化器语义仍由兼容基础代码保留。

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
- [ ] 功能开关显示值与页面实际一致。
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

### 16.1 UI 级故障

1. 把 UI feature flag 设为 false。
2. daemon-reload 并重启。
3. 执行 15 秒健康门禁。
4. 保留最终代码和兼容数据语义，修复前进。

### 16.2 最终代码故障

1. 切回同一功能的兼容基础 release。
2. 重启并验证健康。
3. 保留用户已写入的可选字段和优化器排除语义。
4. 不回到不理解新语义的旧版本作为常规回档。

### 16.3 兼容基础启动失败

只有 UI 从未开放、用户尚未产生新语义数据时，才允许暂时退回更旧生产版本。否则关闭 UI 并 fix-forward。

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
- 8788 flag off：
- 8788 flag on：
- routes：
- browser：
- old-data sentinel：

## 生产切换
- new current：
- health recovery ms：
- PID / NRestarts：
- app-config：
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
