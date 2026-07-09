所有修改记录应当极致详细，越详细越好。

# Changelog

This changelog is the long-form maintenance log for `zzz_calculator`. Every
future change to the Zenless Zone Zero calculator should be appended here with
the reason, the files touched, the model impact, and the verification performed.

## 2026-07-09 - Published Scanner 1.0.36

### Request Context

The web-launched OCR scanner needed to move from the deployed `1.0.35` runtime
to the latest local ZZZ Scanner Next `1.0.36` package while keeping the stable
local/cloud scanner client selection added in 1.0.35.

### Package Changes

Repacked `E:\yan1\zzz\ZZZ-Scanner.Next\publish 1.0.36` into
`downloads/zzz-scanner/1.0.36/ZZZ-Scanner.Next-win-x64.zip`. The package
excludes generated `Scans`, includes the bundled
`Data/ocr_fast_templates.json`, and contains `ZZZ-Scanner.Next.exe` with file
version `1.0.36.0`.

The new OCR package metadata is:

- SHA-256: `d885c0aef6da61cfcbf994ad2b4e712a31efe8bd87631260fe4f87ea8711c63d`
- size: `47231570`
- entry: `ZZZ-Scanner.Next.exe`
- bundled template SHA-256: `814e28114378756e7c541c0efe6cfa2469e1e723d0498ba8e73edea58266a076`

Updated `scripts/build-pages.js`, the local scanner manifest,
`tests/scanner-bridge.test.js`, legacy `frontend/drive-discs.html`, and README
files to use GitHub Release tag `scanner-1.0.36`.

### Runtime Verification

Ran `dotnet build ZZZ-Scanner.Next.csproj -c Release` successfully before
packaging.

The local 120-item smoke benchmark
`publish 1.0.36\Scans\2026-07-09-16-07-11-507-p2784-e284` reported
`Completed=120`, `Failed=0`, duplicate exports 0, `IncompleteRoi=0`,
`slot_safety=pass`, `profile_route=exact:7`, and
`acceptance.no_incomplete_roi/no_error_files/export_consistency/no_export_duplicates/slot_safety/backlog_not_saturated/overlap_rows_complete/overlap_no_hard_stop` all pass.

## 2026-07-02 - Published Scanner 1.0.35 With Cloud Client Selection

### Request Context

The Drive Disc scanner page needed a visible "本地绝区零 / 云绝区零" selector
because the 1.0.34 runtime already contained cloud Fast OCR templates, but the
web request still targeted the default local `ZenlessZoneZero` process. Users
who opened Cloud Zenless Zone Zero therefore failed before OCR started with
`未找到游戏窗口进程：ZenlessZoneZero`.

### UI And Payload Changes

Added a segmented client selector to `frontend/drive-discs.html`. It defaults
to "本地绝区零" and disables while a scan is running. `frontend/drive-discs.js`
maps the selected client to the exact process/profile pair:

- local: `processName="ZenlessZoneZero"`, `visualProfileClient="local"`
- cloud: `processName="Zenless Zone Zero Cloud"`, `visualProfileClient="cloud"`

`frontend/scanner-bridge.js` now includes `processName`,
`visualProfileClient`, and `visualProfileQuality="current"` in every
`scan_req`, while preserving the stable strict DXGI route:
`fastMode=true`, `captureMode=dxgi`, `profileRouting=strict`,
`overlapConflictMode=recover`, `panelAcceptMode=adaptive-early-full-roi`,
`scrollAcceptMode=early-one-row`, `postScrollPanelAcceptMode=safe`, and
`panelMinAcceptFloorMs=120`.

### Scanner Runtime Package

Updated ZZZ Scanner Next WebSocket handling so `scan_req.processName` overrides
the default `ScanOptions.ProcessName`. Without this runtime change, the page
could send the cloud process name but an already cached 1.0.34 scanner would
still look for `ZenlessZoneZero`.

Repacked `E:\yan1\zzz\ZZZ-Scanner.Next\publish 1.0.35` into
`downloads/zzz-scanner/1.0.35/ZZZ-Scanner.Next-win-x64.zip`. The package
excludes `Scans`, includes `Data/ocr_fast_templates.json`, and contains
`ZZZ-Scanner.Next.exe` with file version `1.0.35.0`.

The new OCR package metadata is:

- SHA-256: `2a10aa3dc92e50c7ea930d75eda82fef741eff16e8c39f2839240b6fc36b0255`
- size: `47228425`
- entry: `ZZZ-Scanner.Next.exe`

Updated `scripts/build-pages.js`, the local ignored scanner manifest, scanner
helper download links, README files, and `tests/scanner-bridge.test.js` to use
the GitHub Release tag `scanner-1.0.35`.

### Verification

Ran:

- `npm run test:scanner-bridge`
- `dotnet build ZZZ-Scanner.Next.csproj -c Release`
- `dotnet publish ZZZ-Scanner.Next.csproj -c Release -r win-x64 --self-contained false -p:DebugType=none -p:DebugSymbols=false -o "publish 1.0.35"`
- `npm run build:pages`

## 2026-07-02 - Published Scanner 1.0.34

### Request Context

The web-launched scanner needed to move from the current `1.0.33` package to
the new local `publish 1.0.34` runtime and be uploaded to GitHub Releases plus
deployed through GitHub Pages.

### Package Changes

Repacked `E:\yan1\zzz\ZZZ-Scanner.Next\publish 1.0.34` into
`downloads/zzz-scanner/1.0.34/ZZZ-Scanner.Next-win-x64.zip`. The package
excludes `Scans`, includes `Data/ocr_fast_templates.json`, and contains
`ZZZ-Scanner.Next.exe` with file version `1.0.34.0`.

The new OCR package metadata is:

- SHA-256: `d87a993e15a0f9103942b0284d8d5fc552bed348147180682ef42f7b0fc51c30`
- size: `47228531`
- entry: `ZZZ-Scanner.Next.exe`

Updated `scripts/build-pages.js`, the local ignored scanner manifest, the
scanner helper download links, and `tests/scanner-bridge.test.js` to use the
GitHub Release tag `scanner-1.0.34`. Helper `1.0.2` is now required for the
download link so users get the fixed progress/resume behavior.

### Runtime Behavior

The web `scan_req` payload remains on the stable 1.0.33/1.0.34 route:
`fastMode=true`, `captureMode=dxgi`, `profileRouting=strict`,
`overlapConflictMode=recover`, `panelAcceptMode=adaptive-early-full-roi`,
`scrollAcceptMode=early-one-row`, `postScrollPanelAcceptMode=safe`, and
`panelMinAcceptFloorMs=120`. The page still does not send `ocrFastIndex` or
`includeNon15`.

### Helper Resume Fix

Helper `1.0.1` could report `45.04 MB / 45.04 MB, 100.0%` and then retry with a
Range request starting at the file end. GitHub correctly answered `416 Range
Not Satisfiable`, which surfaced as a failed scanner preparation even though
the bytes were already present. Helper `1.0.2` treats an exact-size `.download`
file as complete and moves it into the package cache so the normal size/SHA-256
verification can decide whether it is valid.

### Verification

Ran:

- `npm run build:pages`
- `npm run test:scanner-bridge`
- `node --check frontend\drive-discs.js`
- `node --check frontend\scanner-bridge.js`

## 2026-07-02 - Published Scanner 1.0.33 and Batched Modal Updates

### Request Context

The public Drive Disc scanner needed to move from the prior 1.0.28 web package
to the locally fixed ZZZ Scanner Next 1.0.33 runtime. The web page also needed
to stop carrying older aggressive OCR tuning knobs and instead send the stable
1.0.33 scan request shape. At the same time, the current working tree already
contained pending optimizer, analysis, maintenance, and modal UX changes, so
this release commits them together and documents them in the README.

### Scanner Package And Payload Changes

Repacked the OCR runtime from `E:\yan1\zzz\ZZZ-Scanner.Next\publish 1.0.33`
into `downloads/zzz-scanner/1.0.33/ZZZ-Scanner.Next-win-x64.zip`, excluding the
generated `Scans` directory. The package contains the built-in
`Data/ocr_fast_templates.json`, so the browser no longer needs to pass any
`ocrFastIndex` override. The new package checksum is
`4abae2da99e3afbbd76a1ab59a3666e9cec1f09f96ca414e795a69d4cea6fe73`, and the
package size is `46947741` bytes.

Updated both the local ignored scanner manifest and the generated Pages
manifest source to publish scanner version `1.0.33` under the GitHub Release tag
`scanner-1.0.33`. The Drive Disc scanner helper download links now point to the
same release tag.

The browser `scan_req` payload now uses:

- `fastMode: true`
- `captureMode: "dxgi"`
- `profileRouting: "strict"`
- `overlapConflictMode: "recover"`
- `panelAcceptMode: "adaptive-early-full-roi"`
- `scrollAcceptMode: "early-one-row"`
- `postScrollPanelAcceptMode: "safe"`
- `panelMinAcceptFloorMs: 120`
- `stopAtNonLevel15: true` by default from the checked UI option

The page does not send `includeNon15`, `ocrFastIndex`,
`sameRowPanelMinAcceptFloorMs`, or `postScrollPanelMinAcceptFloorMs`, leaving
1.0.33 to use its bundled strict profile routing and fast-template data.

### Modal Workflow Changes

The Combat Buff modal on both the homepage and calculation page now edits a
draft list and applies it only when the user clicks "应用选择". Candidate clicks,
checkbox changes, teammate group add/remove actions, and custom Buff creation
update the pending draft instead of immediately recalculating and closing the
modal. The footer shows the current selected count plus pending add/remove
counts.

The optimizer two-piece and four-piece restriction modals also edit drafts and
apply them explicitly. The calculation config modal keeps a snapshot so closing
or cancelling restores the prior event/objective state. Combat Buff,
two-piece/four-piece, calculation config, Drive Disc edit, and loadout edit
modals now share sticky footer styling with clear cancel/apply or cancel/save
actions, and Escape closes the active modal without applying pending changes.

### Shared Stack Controls

Stacked W-Engine effects can now declare `stackGroup` and `stackLabel`. Runtime
UI reads these groups through shared combat helpers and renders one stack input
that writes the same selected stack count to every rule in the group. The
maintenance form can edit the group id and display label, and validation ensures
rules in the same group have matching `maxStacks` and `defaultStacks`.

The Qingming Cage W-Engine uses this for its two Qingming Companion stacked
effects, so Ether DMG and Ether Sheer DMG share the same layer count in previews
and in-combat calculations.

### Files Touched

- `downloads/zzz-scanner/manifest.json`
- `downloads/zzz-scanner/1.0.33/ZZZ-Scanner.Next-win-x64.zip`
- `scripts/build-pages.js`
- `frontend/scanner-bridge.js`
- `frontend/drive-discs.html`
- `frontend/drive-discs.js`
- `frontend/app.js`
- `frontend/calculate.js`
- `frontend/index.html`
- `frontend/styles.css`
- `frontend/shared-combat.js`
- `frontend/maintenance.js`
- `frontend/maintenanceValidation.js`
- `backend/server.js`
- `backend/driveDiscAnalysis.js`
- `frontend/driveDiscAnalysis-core.js`
- `frontend/drive-disc-analysis.js`
- `data/w_engines.json`
- `data/drive_disc_sets.json`
- `README.md`
- `README.zh-CN.md`
- scanner, optimizer, maintenance, shared combat, analysis, production, import,
  and account regression tests under `tests/`

### Verification

Generated the static Pages artifact:

- `npm run build:pages`

Ran scanner and directly related feature tests:

- `npm run test:scanner-bridge`
- `npm run test:drive-disc-analysis`
- `npm run test:browser-local-compute`
- `npm run test:optimizer-ui`
- `npm run test:server-production`
- `npm run test:maintenance-validation`
- `npm run test:shared-combat`
- `npm run test:w-engine-modification`

Ran the remaining npm regression scripts:

- `npm run test:atk-basis`
- `npm run test:percent-sanity`
- `npm run test:formula`
- `npm run test:damage-whitebox`
- `npm run test:anomaly-damage`
- `npm run test:maintenance-stats`
- `npm run test:compiled-score`
- `npm run test:compiled-panel-score`
- `npm run test:optimizer`
- `npm run test:optimizer-progress`
- `npm run test:optimizer-api`
- `npm run test:optimizer-fuzz`
- `npm run test:drive-disc-import`
- `npm run test:accounts`

## 2026-07-02 - Added Helper Download Progress Reporting

### Request Context

The Drive Disc scan modal could sit on "正在下载 OCR 扫描器" for a long time
without telling the user whether bytes were still moving. This made slow or
blocked GitHub Release downloads indistinguishable from a frozen page.

### Helper Changes

Updated `Launcher/Program.cs` in ZZZ Scanner Next so Helper `1.0.1` downloads
the OCR package in explicit chunks instead of using a single `CopyToAsync`.
During the download it emits `launcher_progress` messages containing:

- `bytesDownloaded`
- `totalBytes`
- `percent`
- `bytesPerSecond`
- `attempt`
- `maxAttempts`
- `url`

The helper now keeps a temporary `.download` file during a package attempt and
reports connection interruptions before retrying. If the download still fails
after the configured retries, the thrown error names the retry exhaustion
instead of leaving the browser with a generic preparation timeout.

### Web Changes

The Drive Disc page formats Helper progress as downloaded size, total size,
percentage, speed, and retry count. The Helper download link includes a
`v=1.0.1` cache buster, and the scan modal warns when a connected Helper is
older than `1.0.1` because older Helpers do not send byte-level download
progress.

### Diagnosis

The `scanner-1.0.33` GitHub Release assets were reachable by HEAD and reported
the expected sizes, but full zip download probes from this machine failed with
connection reset/empty reply/connection timeout errors. The ECS mirror at
`121.199.21.10` still serves the old `1.0.26` manifest and returns 404 for the
`1.0.33` zip. That means the observed "stuck" state is very likely a flaky or
blocked GitHub download path, not merely the browser failing to repaint.

### Verification

Ran:

- `dotnet build Launcher\ZZZ-Scanner.Helper.csproj -c Release`
- `dotnet publish Launcher\ZZZ-Scanner.Helper.csproj -c Release -r win-x64 --self-contained true -o dist\publish-helper`
- `node --check frontend\drive-discs.js`
- `node --check frontend\scanner-bridge.js`
- `npm run test:scanner-bridge`

## 2026-07-01 - Added Role-Aware Drive Disc Stat Difference Analysis

### Request Context

The Drive Disc analysis modal already showed the current substat distribution
and stat gain curves, but it did not answer the more direct optimizer question:
"if I replace one meaningful stat on this exact six-disc build, how much does
the current damage target move?" The requested behavior was modeled after the
bottom tables in external character cards, while avoiding a blind full-pool
enumeration. Main-stat candidates needed to reuse the same role preference data
that the optimizer already consumes, especially `agent.preferredDriveDiscs.
mainStatLimits`, so the analysis would not suggest irrelevant slot-4/5/6
main-stat swaps for a character.

### Model Changes

Added `analyzeDriveDiscStatDiffs` to both `backend/driveDiscAnalysis.js` and
`frontend/driveDiscAnalysis-core.js`. The function returns a unified difference
result with `baseline`, `substatDiffs`, `substatReplacements`, and
`mainStatDiffsBySlot`.

The baseline is the current six equipped Drive Discs, current set counts, the
current agent, W-Engine, runtime Buff settings, and selected damage objective.
Each candidate is evaluated by rebuilding the Drive Disc stat totals and running
the same in-combat panel calculator used by the existing damage analysis, rather
than using a static weight table.

Substat differences add one current S-rank substat step at a time and discard
zero-impact entries, so the table follows the real marginal value for the
current damage event. Main-stat differences are limited to slots 4, 5, and 6.
For each slot, the candidate list first reads the agent's
`preferredDriveDiscs.mainStatLimits`; if the agent has no role preference for
that slot, the function falls back to `statRules.driveDisc.mainStatPools`. The
current main stat is filtered out before scoring, which prevents fake reverse
rows such as a physical-damage disc showing a meaningless `-30 physicalDmg`
entry.

The backend and browser implementations were kept isomorphic so static Pages
local computation and the Node API produce the same difference table.

### API Changes

Added `POST /api/analysis/drive-disc-stat-diffs` beside the existing Drive Disc
analysis endpoints. It uses the same production guard as the other heavy
compute endpoints because all `/api/analysis/` routes are disabled on the public
production server.

### UI Changes

The existing homepage "词条分析" button now opens a combined "驱动盘分析" modal
instead of adding another entry point. The modal has three sibling views:

- "差异计算" for role-aware substat and slot-4/5/6 main-stat replacement tables.
- "当前副词条" for the previous substat distribution view.
- "收益曲线" for the previous stat gain curve view.

The difference tables show the current value or current main stat, replacement
candidate, absolute damage delta, and relative damage delta. Main-stat sections
also label whether candidates came from the agent's preferred Drive Disc config
or the generic slot pool fallback.

### Files Touched

- `backend/driveDiscAnalysis.js`
- `frontend/driveDiscAnalysis-core.js`
- `frontend/drive-disc-analysis.js`
- `frontend/styles.css`
- `backend/server.js`
- `tests/drive-disc-analysis.test.js`
- `tests/browser-local-compute.test.js`
- `tests/server-production.test.js`

### Verification

Ran `node --check` for the changed backend/frontend JavaScript entry points:

- `frontend/drive-disc-analysis.js`
- `frontend/driveDiscAnalysis-core.js`
- `backend/driveDiscAnalysis.js`
- `backend/server.js`

Ran targeted regression tests:

- `npm run test:drive-disc-analysis`
- `npm run test:browser-local-compute`
- `npm run test:optimizer-ui`
- `npm run test:server-production`

The new regression coverage checks that slot-5 physical-damage discs do not
generate a fake negative physical-damage row, that main-stat candidates come
only from the role's preferred Drive Disc config when present, that a scored
main-stat replacement matches a full damage recomputation, and that browser and
backend difference-analysis results stay identical.

## 2026-05-28 - Removed Homepage Effect Record Card

### Request Context

The homepage "效果记录" card mixed out-of-combat effect records with in-combat
Buff diagnostics. After W-Engine and Drive Disc 4-piece Buffs moved into the
in-combat layer, that card showed normal in-combat-only rules as "已忽略",
which was misleading for users.

### UI Changes

Removed the homepage "效果记录" card and removed the related "效果" sidebar
links from the homepage, maintenance page, and Drive Disc inventory page. The
in-combat panel still shows "已启用 Buff", and the raw debug JSON still exposes
`appliedEffects` and `ignoredEffects`.

### Model Changes

Stopped adding Drive Disc 4-piece rules and W-Engine self Buffs to
`outOfCombat.ignoredEffects`. Those rules belong to the in-combat Buff layer;
the backend keeps `ignoredEffects` for real diagnostics such as missing sets,
not-equipped 4-piece Buffs, specialty mismatches, and missing ATK% basis.

## 2026-05-28 - Added Formula Buff Rule

### Request Context

The existing `derived` Buff rule only supported proportional conversion:
`sourceValue * ratio / 100`, optionally capped. That cannot accurately model
rules such as "base 10% damage bonus, then every 400 HP above 15000 adds 1%,
up to 40% total." A dedicated threshold-step template was too narrow for future
Buffs, so the model now uses a safe single-variable function rule instead.

### Model Changes

Added a new structured Buff rule type:

```json
{
  "type": "formula",
  "stat": "dmgBonus",
  "mode": "flat",
  "source": {
    "variable": "x",
    "label": { "zhCN": "照的初始最大生命值" },
    "defaultValue": 27000,
    "min": 15000,
    "max": 27000
  },
  "formula": {
    "expression": "clamp(floor((x - 15000) / 400) + 10, 10, 40)",
    "valueUnit": "storedPercent"
  }
}
```

The backend evaluates formula rules with a whitelist parser, not `eval` or
`new Function`. Only the variable `x`, numbers, arithmetic operators,
parentheses, and `floor/ceil/round/min/max/clamp` are allowed. The computed
value then goes through the same stored-percent conversion as all other Buff
stats, so `dmgBonus: 40` becomes `0.4` in the in-combat panel.

### UI Changes

Updated the homepage Buff runtime controls so `formula` reuses the existing
source-value input and shows the expression used. Updated the maintenance page
rule editor with a new "受限函数换算" type and fields for source label, default
source value, source min/max, and expression.

### Data Changes

Updated `data/combat_buffs.json` so 照's teammate Buff includes the actual
formula-based damage bonus from the supplied screenshot.

### Verification

Added `tests/formula.test.js` for source values 15000, 15399, 15400, 27000, and
31000, plus a regression check that 千夏's existing `derived` rule is unchanged.
Updated maintenance validation tests to accept valid `formula` rules and reject
unsafe expressions such as `window.x`.

## 2026-05-27 - Fixed Stored Percent Display in Core Skill Summary

### Request Context

After the stricter percent modeling work, the homepage character card displayed
Ye Shunguang's Core Skill as `暴击率 +1440%`. The underlying data was correct:
the Core Skill grants `4.8%` CRIT Rate at each of A, C, and E, for `14.4%`
total. The bug was a display-layer mismatch between stored percent values and
calculated panel fractions.

### Frontend Changes

Updated:

```text
frontend/app.js
```

`coreSkillSummary()` now formats Core Skill stat totals with the stored-percent
formatter. Core Skill JSON uses human percent numbers, such as `4.8` for
`4.8%`, while panel output uses calculated fractions, such as `0.048`. The
summary previously sent the stored number into the panel formatter, which
multiplied it by 100 again.

### Test Changes

Added:

```text
tests/percent-sanity.test.js
```

The new test scans stored percent data for implausible outliers and verifies
example calculated panels keep percent-like values in calculated-fraction
space. This does not replace source verification, but it catches common
conversion mistakes such as `14.4` being treated as `1440%` in the calculation
layer.

Updated `package.json` with:

```text
npm run test:percent-sanity
```

### Verification

Ran:

```text
node --check frontend/app.js
node --check backend/calculator.js
npm run test:percent-sanity
npm run test:atk-basis
```

All checks passed.

## 2026-05-27 - Hardened ATK Basis Modeling and Added Attack Breakdown UI

### Request Context

The calculator needed a clearer and safer separation between three attack
concepts: Base ATK from agent, W-Engine, and Core Skill; out-of-combat panel ATK
from equipment percentages and flats; and in-combat ATK from teammate, field,
enemy, W-Engine, Drive Disc, or manual Buffs.

### Backend Changes

Updated `backend/calculator.js` so in-combat ATK% effects no longer silently
fall back to the wrong basis. Teammate, boss/enemy, field, and manual Buffs now
default missing in-combat `atkPct` basis to `outOfCombatAtk`. Self, W-Engine,
and Drive Disc 4-piece in-combat `atkPct` effects must explicitly declare
`basis`; otherwise the effect is ignored with `missingAtkPctBasis`.

The calculation response now includes attack breakdowns:

- `outOfCombat.breakdown.baseAtk`
- `outOfCombat.breakdown.atkPanel`
- `inCombat.breakdown.atkPanel`

These make the Base ATK, out-of-combat ATK, and in-combat ATK stages inspectable
without reverse-engineering the formula from totals.

### Data Changes

Updated existing in-combat Drive Disc 4-piece ATK% entries in
`data/drive_disc_sets.json` to declare `basis: "baseAtk"` explicitly.

### Frontend Changes

Added a homepage "攻击力计算明细" card with a collapsed details control. It
shows Base ATK composition, out-of-combat ATK calculation, and in-combat ATK
calculation. Buff records and ignored-effect records now surface the basis or
the missing-basis reason.

### Model Guardrail

Documented the ATK basis rules in `docs/modeling.md`. Future data additions
should never add an in-combat `atkPct` without either an explicit `basis` or a
source type that intentionally defaults to `outOfCombatAtk`.

Added catalog-load validation in `backend/calculator.js` for the strict source
types. Self Buffs, W-Engine effects, and Drive Disc 4-piece effects now fail
data loading if they contain in-combat `atkPct` without `basis`, so the mistake
is caught while editing data instead of only after a user clicks the checkbox.

Added `tests/atk-basis.test.js` and the `npm run test:atk-basis` script. The
test locks the important attack stages:

- Base ATK includes agent Base ATK, W-Engine Base ATK, and Core Skill Base ATK.
- Out-of-combat ATK% including a simulated W-Engine advanced ATK% stat scales
  from Base ATK.
- `basis: "baseAtk"` and `basis: "outOfCombatAtk"` produce different
  in-combat flat attack contributions.
- Teammate ATK% without basis defaults to `outOfCombatAtk`.
- Self ATK% without basis is ignored with `missingAtkPctBasis`.
- Equipped 4-piece ATK% uses its explicit `baseAtk` basis.

## 2026-05-27 - Simplified Out-of-Combat Panel Display and Added Ye Shunguang Highlights

### Request Context

The homepage out-of-combat panel still showed the old simple-score block and
top stat summary. The requested display should remove that block, remove the
generic damage bonus row from the out-of-combat module, and visually emphasize
Ye Shunguang's priority panel stats.

### Frontend Changes

Updated:

```text
frontend/index.html
frontend/app.js
frontend/styles.css
```

Removed the out-of-combat panel's top `panel-band` block, including the visible
simple-score card and compact summary tiles. The raw calculation still keeps
`simpleTargetScore`, but it is no longer displayed inside the out-of-combat
panel card.

Split the out-of-combat panel display order from the shared panel order. The
out-of-combat panel now omits `dmgBonus`, while the in-combat panel continues
to show `dmgBonus` because it is needed for Buff inspection.

Removed `dmgBonus` from the out-of-combat "加成汇总" display as well, so the
entire out-of-combat module no longer shows the generic damage bonus row.

Added a first character-specific highlight map:

```text
ye_shunguang: atk, critRate, critDmg, physicalDmg
```

These rows now get a stronger dark font weight and a yellow-accent highlighted
row style when Ye Shunguang is selected. The data model is intentionally shaped
so later characters can receive their own highlight sets without changing the
table renderer again.

## 2026-05-27 - Split W-Engine Effect Text From In-Combat Buff Data

### Request Context

The homepage W-Engine card showed Base ATK and advanced stat but did not show
the W-Engine's weapon effect text. The required model shape is now explicitly
split into two layers:

1. Human-readable W-Engine effect text for the UI.
2. Structured Buff data used by the in-combat panel.

### Data Changes

Updated:

```text
data/w_engines.json
```

Each current W-Engine now uses:

```json
{
  "effect": {
    "name": {},
    "requirement": {},
    "description": {},
    "buff": {}
  }
}
```

`effect.description` is display-only. `effect.buff` is the structured
calculation payload that can be enabled from the homepage's in-combat settings.
This prevents future W-Engine descriptions from being conflated with formulas.

### Backend Changes

Updated:

```text
backend/calculator.js
```

The calculator now reads W-Engine in-combat effects from `effect.buff`. A small
compatibility helper still understands old `passive` records if they ever appear
in imported or transitional data, but the canonical static model is `effect`.

`GET /api/meta` now exposes the full `effect` object for each W-Engine and keeps
a derived `passive` field only as a compatibility alias for existing frontend
logic.

### Frontend Changes

Updated:

```text
frontend/index.html
frontend/app.js
frontend/styles.css
```

The homepage W-Engine settings card now renders an "音擎效果" block containing:

- The effect name.
- The specialty requirement text.
- The display description.
- A compact "局内 Buff" line generated from the structured Buff stats.

The in-combat Buff selector continues to use the same W-Engine effect, but now
it pulls from `effect.buff` instead of relying on a top-level `passive`.

## 2026-05-27 - Added In-Combat Panel Stage

### Request Context

The homepage needed a second panel stage after the existing out-of-combat
panel. The target was not final damage calculation. The target was an
inspectable in-combat panel that starts from the already-correct
out-of-combat panel and then adds selected Buff effects from self, teammate,
Drive Disc 4-piece sets, boss/enemy effects, field effects, and manual
corrections.

### Data Model

Added:

```text
data/combat_buffs.json
```

The new catalog is the generic place for verified self, teammate, boss, field,
and manual-style Buff entries. For this pass, only hidden validation Buffs were
seeded because unverified values from the reference HTML should not become
default truth. Verified W-Engine passives remain in `data/w_engines.json`, and
verified Drive Disc 4-piece effects remain in `data/drive_disc_sets.json`.

The Buff model now supports a `basis` field for percentage HP/ATK/DEF effects.
This matters because an attack percentage can mean either:

```text
baseAtk basis:          flat attack = base.atk * value
outOfCombatAtk basis:   flat attack = outOfCombat.panel.atk * value
```

The first visible user-facing source for unverified or situational values is
the homepage's manual correction area.

### Backend

Updated:

```text
backend/calculator.js
backend/server.js
```

Added `POST /api/calculate/in-combat`. The endpoint preserves the old
`POST /api/calculate/out-of-combat` behavior and returns:

```json
{
  "outOfCombat": {},
  "inCombat": {
    "panel": {},
    "buffTotals": {},
    "activeEffects": [],
    "ignoredEffects": [],
    "breakdown": {}
  }
}
```

The in-combat calculation now runs in two phases:

1. Compute the existing out-of-combat panel exactly as before.
2. Apply only selected in-combat Buff candidates on top of that panel.

Added runtime candidates for:

- Current W-Engine passive, gated by specialty match.
- Current character's equipped Drive Disc 4-piece effects, available only when
  the current equipment has at least four pieces from that set.
- Teammate Drive Disc 4-piece effects selected manually.
- Manual corrections posted by the frontend.
- Generic static Buffs from `data/combat_buffs.json`.

The in-combat panel keeps `dmgBonus` and elemental damage bonuses separate for
display. Later damage calculation can merge them into the same multiplier
bucket when that model exists.

### Frontend

Updated:

```text
frontend/index.html
frontend/app.js
frontend/styles.css
```

Added a homepage "局内设置" card with groups for:

- 自身 Buff
- 队友 Buff
- 驱动盘 4 件套
- Boss / 敌方效果
- 场地 Buff
- 手动修正

Added a homepage "局内面板" result card that shows:

- In-combat panel values using the same stat order as the out-of-combat panel.
- In-combat Buff totals.
- Enabled Buff records.

The homepage now calls `/api/calculate/in-combat` so switching character,
W-Engine, Core Skill, or Drive Discs recalculates both panel stages together.
Checking or unchecking a Buff recalculates only the in-combat layer while the
out-of-combat layer remains the visible baseline.

### Model Impact

The existing out-of-combat model remains the source of truth for bag-style
comparison and should not include in-combat passives or conditional effects.
The new in-combat model is additive on top of `outOfCombat.panel`.

Percentage HP/ATK/DEF in-combat Buffs are split into separate internal totals:

```text
hpPctBase / hpPctOutOfCombat
atkPctBase / atkPctOutOfCombat
defPctBase / defPctOutOfCombat
```

This prevents "10% base attack" from being accidentally treated the same as
"10% current out-of-combat panel attack".

### Verification Notes

The intended verification for this change is:

- `node --check backend/calculator.js`
- `node --check backend/server.js`
- `node --check frontend/app.js`
- API calculation where no Buff is enabled and `inCombat.panel` equals
  `outOfCombat.panel`.
- API calculation where Cloudcleave Radiance passive adds CRIT DMG, damage
  bonus, and physical resistance ignore only to the in-combat panel.
- API calculation showing hidden validation Buffs for `10% baseAtk` and
  `10% outOfCombatAtk` produce different attack contributions.
- API calculation showing an equipped in-combat Drive Disc 4-piece effect only
  enters the in-combat panel after its checkbox ID is active.

## 2026-05-26 - Created Independent ZZZ Calculator Maintenance Area

### Request Context

The work started from a requirement to study the existing `genshin_artifact`
project, especially its modeling style, and then create an independent Zenless
Zone Zero Drive Disc calculator without modifying the existing Genshin Impact
modules such as `mona_*`, `src`, or `src-tauri`.

### Directory Boundary

Created the independent directory:

```text
E:\yan1\genshin_artifact\zzz_calculator
```

The directory became the explicit maintenance boundary for all ZZZ calculator
work. The rule is: unless a later integration step explicitly asks to connect
this work into the main frontend or WASM packages, all ZZZ data models,
examples, backend code, frontend code, and documentation should stay under
`zzz_calculator`.

### Initial Files

Created the initial maintenance layout:

```text
zzz_calculator/
  README.md
  docs/
    modeling.md
  data/
    agents.json
    w_engines.json
    drive_disc_sets.json
    stat_rules.json
  examples/
    out_of_combat_panel.example.json
```

### Initial Modeling Scope

Documented the first model as a deliberately narrow out-of-combat panel model.
The v1 calculation target was:

1. Agent base stats are fixed at level 60.
2. Agent Base ATK plus W-Engine Base ATK produces total Base ATK.
3. Agent base HP and DEF do not receive W-Engine base values.
4. W-Engine advanced stats, Drive Disc main stats, Drive Disc sub-stats, and
   unconditional out-of-combat 2-piece set effects contribute to the panel.
5. In-combat effects, teammate buffs, field buffs, enemy data, stun windows,
   anomaly, disorder, rotations, and real damage formula details are deferred.

### Static Data Seeded

Seeded `data/agents.json` with an initial level 60 agent record for Anby Demara.
The record included id, localized names, rarity, attribute, specialty, faction,
attack type, level 60 HP/ATK/DEF, and deterministic default panel stats.

Seeded `data/w_engines.json` with Demara Battery Mark II. The model included
level 60 Base ATK, advanced stat, passive metadata, source links, and a flag
that prevents the passive from entering the v1 out-of-combat panel.

Seeded `data/drive_disc_sets.json` with a small set of Drive Disc sets needed
for formula calibration: Woodpecker Electro, Swing Jazz, and Hormone Punk. Their
2-piece effects were modeled as out-of-combat where appropriate and their
4-piece effects were stored but excluded from the v1 panel.

Seeded `data/stat_rules.json` with stat display rules, Drive Disc partition
main stat pools, S-rank max main stat values, sub-stat pools, sub-stat step
values, and the base attack rule.

Created `examples/out_of_combat_panel.example.json` as the first deterministic
snapshot for validating the Anby + Demara Battery Mark II + six sample Drive
Disc calculation.

## 2026-05-26 - Added Frontend/Backend Split

### Backend

Added:

```text
backend/
  calculator.js
  server.js
```

`backend/calculator.js` became responsible for loading static JSON data,
building lookup maps, applying out-of-combat equipment bonuses, applying only
eligible effects, and returning a rounded calculation payload.

`backend/server.js` became a dependency-free Node.js HTTP server. It serves the
frontend files and exposes calculator API endpoints.

### API Endpoints Added

Added:

- `GET /api/health`
- `GET /api/meta`
- `GET /api/example/out-of-combat`
- `POST /api/calculate/out-of-combat`

### Calculation Behavior

Implemented the attack special case:

```text
base.atk = agent.level60.atkBase + wEngine.level60.atkBase
```

Implemented HP and DEF as pure agent base values:

```text
base.hp = agent.level60.hpBase
base.def = agent.level60.defBase
```

Implemented out-of-combat panel formulas:

```text
hpPanel  = base.hp  * (1 + hpPct)  + hpFlat
atkPanel = base.atk * (1 + atkPct) + atkFlat
defPanel = base.def * (1 + defPct) + defFlat
```

Implemented additive handling for CRIT Rate, CRIT DMG, Impact, Anomaly
Proficiency, Anomaly Mastery, Energy Regen, PEN, PEN Ratio, elemental damage
bonuses, and generic damage bonuses as the first-pass model.

Implemented a simple target score:

```text
score = atkPanel * (1 + min(critRate, 1) * critDmg) * (1 + selectedDmgBonus)
```

### Frontend

Added:

```text
frontend/
  index.html
  app.js
  styles.css
  zzz-mark.svg
```

The first frontend could load metadata, load the example, submit calculation
requests, render base stats, bonus totals, panel stats, applied effects,
ignored effects, simple score, and raw JSON results.

### Package

Added `package.json` with a local start script for the Node backend.

## 2026-05-26 - Redesigned Frontend Into ZZZ-Style Calculator Workspace

### Motivation

The first frontend was functionally useful but visually rough. The target was
to make it resemble the workbench style of the referenced Mona/Genshin
calculator while not copying Genshin visuals directly. The new direction was a
Chinese, Zenless Zone Zero flavored tool surface.

### Layout Changes

Reworked `frontend/index.html` into:

- A dark left sidebar.
- A brand area.
- Chinese navigation items.
- A top title/action area.
- A current-character hero strip.
- A left configuration column.
- A right result/panel column.

The main page sections became:

- 角色设置
- 音擎设置
- 驱动盘
- 输入数据
- 局外面板
- 原始结果

### Visual Style

Rewrote `frontend/styles.css` to use:

- Dark sidebar.
- Yellow ZZZ accent.
- Blue action accent.
- Light calculation workspace.
- Card radius capped at 8px.
- Compact stat chips.
- Stable Drive Disc slot cards.
- Responsive one-column layout for smaller screens.

### Chinese Labels

Updated `frontend/app.js` so stat labels prefer local Chinese labels instead of
English labels from `stat_rules.json`.

Added Chinese enum display for:

- Attributes, including physical, fire, ice, electric, ether, and later honed
  edge.
- Specialties such as 强攻, 击破, 异常, 支援, 防护, 命破.
- Factions such as 狡兔屋 and later 云岿山.

Added Chinese display for set effects so records can show text such as
`啄木鸟电音 2件套` instead of raw ids.

### Verification

Verified:

- `node --check frontend/app.js`
- Static page returned HTTP 200.
- CSS returned HTTP 200.
- JS returned HTTP 200.
- The out-of-combat calculation API still returned the expected Anby score.
- A headless Edge screenshot was used to visually inspect the first viewport.

## 2026-05-26 - Added Media Asset Support

### Data Changes

Extended agent and W-Engine data records with optional `images` fields. These
fields are not calculation inputs; they are frontend display metadata.

Agent images now support:

```json
{
  "portrait": "/assets/agents/...",
  "source": "..."
}
```

W-Engine images now support:

```json
{
  "icon": "/assets/w-engines/...",
  "source": "..."
}
```

### Frontend Changes

Updated the frontend so the hero strip, agent card, and W-Engine card can show
the configured media assets. The fallback remains `zzz-mark.svg`.

### Asset Files Present

The current frontend asset tree includes:

```text
frontend/assets/agents/anby_demara.webp
frontend/assets/agents/ye_shunguang.png
frontend/assets/w-engines/cloudcleave_radiance.webp
frontend/assets/w-engines/demara_battery_mark_ii.webp
```

## 2026-05-26 - Added Ye Shunguang And Cloudcleave Radiance

### Source Pages

Used Biligame Wiki pages as the data source:

- `https://wiki.biligame.com/zzz/%E5%8F%B6%E7%9E%AC%E5%85%89`
- `https://wiki.biligame.com/zzz/%E4%BA%91%E9%9C%93%E5%AD%A4%E5%85%89`

### Agent Added

Added `ye_shunguang` to `data/agents.json`.

Modeled fields:

- Chinese name: 叶瞬光
- English id/name field: Ye Shunguang
- Rarity: S
- Attribute: `honed_edge`
- Damage element: `physical`
- Specialty: `attack`
- Faction: `yunkui_summit`
- Level 60 HP: 7673
- Level 60 ATK: 863
- Level 60 DEF: 606
- CRIT Rate default: 5%
- CRIT DMG default: 50%
- Impact: 83
- Anomaly Proficiency: 93
- Anomaly Mastery: 94
- Energy Regen: 1.2
- PEN Ratio: 0

### Special Attribute Modeling Decision

叶瞬光 uses a special displayed attribute, modeled as `honed_edge`. Because the
weapon text references physical resistance ignore, the model also adds
`damageElement: "physical"`. This allows the current score helper and future
damage formula to use physical damage bonus and physical resistance rules while
still preserving the displayed special attribute.

### W-Engine Added

Added `cloudcleave_radiance` to `data/w_engines.json`.

Modeled fields:

- Chinese name: 云霓孤光
- Rarity: S
- Specialty: attack
- Related agent: ye_shunguang
- Level 60 Base ATK: 743
- Advanced stat: CRIT DMG +48%

### W-Engine Passive Modeling

Modeled phase 1 passive values only:

- `physicalResIgnore +20%`
- `dmgBonus +25%`
- `critDmg +25%`

The passive is stored as `scope: "inCombat"` and
`appliesToOutOfCombatPanel: false`, so it is intentionally ignored by the
current out-of-combat panel calculation.

### New Stat Added

Added `physicalResIgnore` to `data/stat_rules.json` and backend stat handling.
This stat is not a normal out-of-combat panel stat like ATK or CRIT. It is a
future enemy resistance/damage-calculation input.

### Example Added

Added `examples/ye_shunguang_panel.example.json`.

With Ye Shunguang and a level 60 Cloudcleave Radiance but no Drive Discs, the
expected out-of-combat output is:

```text
base.hp = 7673
base.atk = 863 + 743 = 1606
base.def = 606
panel.critRate = 0.05
panel.critDmg = 0.50 + 0.48 = 0.98
simpleTargetScore = 1684.694
ignoredEffects = []
```

### API Added

Added:

- `GET /api/example/ye-shunguang`

### Frontend Added

Added a `叶瞬光模板` button that loads the Ye Shunguang example into the current
calculator form.

### Verification

Verified:

- JSON parsing for agents, W-Engines, stat rules, and the Ye Shunguang example.
- `node --check backend/calculator.js`
- `node --check backend/server.js`
- `node --check frontend/app.js`
- Local calculation for Ye Shunguang returned HP 7673, ATK 1606, CRIT DMG 0.98,
  simple score 1684.694, and ignored the Cloudcleave Radiance passive.
- The backend service was restarted on port 8787 and `/api/meta` showed both
  `ye_shunguang` and `cloudcleave_radiance`.

## 2026-05-26 - Added User Drive Disc Inventory Model And ZZZ Scanner Import

### Request Context

The user provided a ZZZ Scanner export file:

```text
E:\yan1\ZZZ-Scanner-master\ZZZ-Scanner.Next\publish-dpi-fix\Scans\2026-05-26-19-12-09\export.json
```

The requirement was to adapt the data model so the project can read this export
and record one user's full Drive Disc inventory. A future page should display
all user Drive Discs and support import, create, read, update, and delete.

### Export Shape Observed

The export is a top-level JSON array with 200 items.

Each item has these fields:

- `序号`
- `名称`
- `槽位`
- `品质`
- `等级`
- `最大等级`
- `主属性`
- `副属性`

The observed set names were:

- 流光咏叹
- 沧浪行歌
- 月光骑士颂
- 山大王
- 云岿如我
- 法厄同之歌
- 如影相随
- 折枝剑歌

The observed main stat labels were:

- 生命值
- 攻击力
- 防御力
- 暴击率
- 暴击伤害
- 异常精通
- 异常掌控
- 冲击力
- 能量自动回复
- 穿透率
- 物理伤害加成
- 火属性伤害加成
- 冰属性伤害加成
- 电属性伤害加成
- 以太伤害加成

The observed sub-stat labels were:

- 生命值
- 攻击力
- 防御力
- 暴击率
- 暴击伤害
- 异常精通
- 穿透值

### Model Added

Added `DriveDiscInventoryItem` and `DriveDiscInventoryStore` to
`docs/modeling.md`.

The user inventory is separate from canonical static game data. Static data
describes the game. The inventory describes one user's scanned or manually
edited Drive Discs.

### Data File Added

Generated:

```text
data/user_drive_discs.json
```

This file currently stores:

- `version`
- `updatedAt`
- `owners`
- `imports`
- `driveDiscs`

The current import record is:

- id: `zzz-scanner-20260526-191209`
- type: `zzz-scanner`
- ownerId: `default`
- sourcePath: the provided scanner export path
- importedAt: `2026-05-26T19:12:09+08:00`
- itemCount: 200
- warnings: none

### Import Normalization Rules

Added `backend/driveDiscInventory.js`.

The importer converts scanner fields into normalized inventory fields:

- `序号` -> `source.sequence`
- `名称` -> `setName`
- `槽位` -> `partition`
- `品质` -> `rarity`
- `等级` -> `level`
- `最大等级` -> `maxLevel`
- `主属性` -> `mainStat`
- `副属性` -> `subStats`

The generated inventory id is stable for the same owner, sequence, set name,
partition, rarity, level, main stat, and sub stats.

The generated set id is currently based on the Chinese set name hash:

```text
scanner-set-${sha1(setName).slice(0, 12)}
```

This is intentionally temporary. Once `data/drive_disc_sets.json` contains
canonical records for all these sets, imported set names should be resolved to
canonical set ids.

### Stat Normalization Rules

The importer normalizes Chinese labels and percentage strings:

- `"攻击力": "6%"` -> `atkPct: 0.06`
- `"攻击力": 38` -> `atkFlat: 38`
- `"生命值": "3%"` -> `hpPct: 0.03`
- `"生命值": 2200` -> `hpFlat: 2200`
- `"防御力": "4.8%"` -> `defPct: 0.048`
- `"防御力": 184` -> `defFlat: 184`
- `"暴击率": "4.8%"` -> `critRate: 0.048`
- `"暴击伤害": "14.4%"` -> `critDmg: 0.144`
- `"异常精通": 18` -> `anomalyProficiency: 18`
- `"异常掌控": "30%"` -> `anomalyMastery: 0.3`
- `"冲击力": "18%"` -> `impact: 0.18`
- `"能量自动回复": "60%"` -> `energyRegen: 0.6`
- `"穿透值": 9` -> `penFlat: 9`
- `"穿透率": "24%"` -> `penRatio: 0.24`
- `"物理伤害加成": "30%"` -> `physicalDmg: 0.3`
- `"火属性伤害加成": "30%"` -> `fireDmg: 0.3`
- `"冰属性伤害加成": "30%"` -> `iceDmg: 0.3`
- `"电属性伤害加成": "30%"` -> `electricDmg: 0.3`
- `"以太伤害加成": "30%"` -> `etherDmg: 0.3`

### Raw Data Preservation

Every imported item preserves the original scanner item in `raw`. This matters
because future UI will need to compare normalized data against scanner output,
and because scanner/OCR issues should be inspectable without re-reading the
original export file.

### Backend API Added

Added endpoints:

- `GET /api/user-drive-discs`
- `POST /api/user-drive-discs/import/zzz-scanner`
- `POST /api/user-drive-discs`
- `PUT /api/user-drive-discs/:id`
- `DELETE /api/user-drive-discs/:id`

The future inventory page can use these endpoints for import and CRUD.

### Documentation Added And Updated

Created this file:

```text
docs/changelog.md
```

The first line records the maintenance rule that every modification should be
logged in extreme detail.

Created:

```text
docs/goal.md
```

This file now tracks future goals with explicit statuses such as `Done`,
`Iterating`, `Planned`, and `Blocked`.

Updated:

```text
docs/modeling.md
README.md
```

`docs/modeling.md` now describes the user Drive Disc inventory model, the ZZZ
Scanner export shape, the Chinese stat normalization rules, and the new user
Drive Disc API surface.

`README.md` now lists the new backend inventory module, the new documentation
files, the generated user inventory data file, the Ye Shunguang example file,
and the user Drive Disc API endpoints.

### Verification

Verified that the provided export imports exactly 200 discs.

Verified that the first imported disc becomes:

```text
setName = 流光咏叹
partition = 1
mainStat = hpFlat 2200
subStats = atkPct 0.06, critRate 0.048, critDmg 0.144, atkFlat 38
```

Verified no warnings were produced by the scanner import for the provided file.

Verified syntax for:

- `backend/driveDiscInventory.js`
- `backend/server.js`
- `backend/calculator.js`
- `frontend/app.js`

Verified JSON parsing for the newly generated inventory file.

## 2026-05-26 - Added Dedicated Drive Disc Inventory Page

### Request Context

The user asked to start developing the `驱动盘` interface. The requirements were:

1. The interface should support create, delete, search/read, update, import,
   and viewing Drive Discs.
2. Clicking `驱动盘` from the homepage should no longer scroll within the
   homepage; it should navigate to the new page.
3. The new page should keep the same overall visual style and UI language as
   the existing homepage.

### Navigation Change

Updated:

```text
frontend/index.html
```

The sidebar `驱动盘` link changed from:

```html
href="#disc-section"
```

to:

```html
href="/drive-discs.html"
```

This makes the sidebar navigate to the dedicated inventory page instead of
moving to the Drive Disc JSON section inside the calculator homepage.

The homepage `首页` sidebar link was also changed to point to `/`, keeping it
consistent with the new multi-page navigation style.

### New Page Added

Created:

```text
frontend/drive-discs.html
frontend/drive-discs.js
```

The page follows the same shell as the homepage:

- dark left sidebar;
- yellow active navigation state;
- ZZZ brand block;
- light patterned work surface;
- top title/action area;
- hero summary strip;
- white cards with 8px radius;
- blue primary buttons and white secondary buttons.

### Page Structure

The new `驱动盘仓库` page contains:

- a header with `新增驱动盘` and `刷新仓库`;
- a hero summary showing current owner, total Drive Disc count, set count, and
  import count;
- an import card;
- a filterable/sortable Drive Disc table;
- a sticky detail/edit card on desktop;
- a raw scanner data preview.

### Import UI

The import card supports three workflows:

1. Use a local export path. The default path is the scanner file previously
   provided by the user:

   ```text
   E:\yan1\ZZZ-Scanner-master\ZZZ-Scanner.Next\publish-dpi-fix\Scans\2026-05-26-19-12-09\export.json
   ```

2. Choose a JSON file in the browser. The frontend reads it and submits its JSON
   content to the backend.
3. Paste the JSON export directly into a textarea.

All import modes call:

```text
POST /api/user-drive-discs/import/zzz-scanner
```

### Backend Import Improvement

Updated:

```text
backend/server.js
```

The scanner import endpoint now supports a payload with only `sourcePath`. When
the request includes a path but no embedded items, the backend reads the local
file and parses it as JSON.

This was needed because browser file inputs cannot safely expose a full local
path, but this project is a local tool and the backend can read the path when
the user explicitly provides it.

### Search And View UI

The table supports:

- keyword search across id, set name, slot, main stat, raw stat labels, and
  sub-stat labels;
- slot filtering;
- set filtering;
- main-stat filtering;
- sorting by import sequence, slot, set name, or level.

Each row displays:

- source sequence;
- set name;
- slot;
- rarity and level;
- main stat;
- sub stats;
- a `查看` action.

Selecting a row fills the detail/editor panel.

### Create UI

The `新增驱动盘` button creates a local manual draft in the frontend state with:

- generated id beginning with `manual-`;
- owner `default`;
- set name `未命名套装`;
- slot 1;
- S rarity;
- level 15;
- default HP main stat.

Saving the form persists the manual item through the backend upsert endpoint.

### Update UI

The detail form supports editing:

- id display;
- set name;
- partition;
- rarity;
- level;
- max level;
- equipped character;
- lock state;
- main stat type;
- main stat value;
- four sub-stat rows.

Percentage stats are edited as visible percentages. For example, `6` in the UI
is saved as `0.06` internally when the selected stat is a percentage stat.

### Delete UI

The detail form has a `删除` button. It asks for browser confirmation and then
calls:

```text
DELETE /api/user-drive-discs/:id
```

### CSS Added

Updated:

```text
frontend/styles.css
```

Added styles for:

- `danger-btn`;
- compact table buttons;
- inventory layout;
- import grid;
- filter toolbar;
- scrollable Drive Disc table;
- selected table rows;
- detail editor form;
- checkbox rows;
- main/sub stat editors;
- responsive inventory layout.

The mobile sidebar navigation was adjusted from three columns to two columns at
small width because the three-column layout was visually cramped at 390px.

### CRUD Verification

Used a temporary test Drive Disc id beginning with `codex-crud-test-`.

Verification flow:

1. Read initial count from `GET /api/user-drive-discs`: 201.
2. Created a temporary disc through `POST /api/user-drive-discs`.
3. Count increased to 202.
4. Updated the temporary disc level to 15 through `PUT /api/user-drive-discs/:id`.
5. Confirmed the returned record had level 15.
6. Deleted the temporary disc through `DELETE /api/user-drive-discs/:id`.
7. Count returned to 201.

The final store count was therefore restored after the test.

### Current Inventory Note

At the time of this change, the inventory contained 201 records:

- 199 records with source type `zzz-scanner`;
- 2 records with source type `screenshot`.

No cleanup was performed, because the extra screenshot records appear to be
intentional user data or prior generated data. The implementation preserves
existing user inventory records.

### Page Verification

Verified:

- `node --check frontend/drive-discs.js`
- `node --check backend/server.js`
- `GET /drive-discs.html` returns 200 and contains the inventory page markup.
- `GET /drive-discs.js` returns 200 and contains the user Drive Disc API logic.
- `GET /` returns 200 and no longer contains `href="#disc-section"`.
- `GET /` does contain `/drive-discs.html`.
- `GET /api/user-drive-discs` returns the inventory store.
- The server was restarted so backend source-path import support is active.

### Visual Verification

The in-app browser bridge was attempted but was unavailable in this environment.
The fallback was a headless Edge screenshot of:

```text
http://localhost:8787/drive-discs.html
```

The desktop screenshot confirmed:

- sidebar navigation matches the homepage style;
- `驱动盘` nav item is active;
- import card is visible;
- Drive Disc table is visible;
- detail/editor card is visible;
- hero summary shows 201 Drive Discs, 8 sets, and 1 import record.

A 390px-wide mobile screenshot was also taken. It confirmed the page stacks into
a single-column flow and led to the mobile sidebar adjustment from three columns
to two columns.

## 2026-05-27 - Added Core Skill Level Modeling To Out-Of-Combat Panel

### Request Context

The user reported that Ye Shunguang's Base ATK and displayed CRIT Rate were
wrong. The previous model used only the agent's level 60 base panel and did not
account for Core Skill enhancements. In Zenless Zone Zero, each agent has Core
Skill enhancement levels A-F, and those levels can increase stable
out-of-combat stats such as Base ATK and CRIT Rate.

The user provided a screenshot for Ye Shunguang's Core Skill enhancement table.
The table shows:

- Core Skill A: CRIT Rate +4.8%, Core Passive skill level +1.
- Core Skill B: Base ATK +25, Core Passive skill level +1.
- Core Skill C: CRIT Rate +4.8%, Core Passive skill level +1.
- Core Skill D: Base ATK +25, Core Passive skill level +1.
- Core Skill E: CRIT Rate +4.8%, Core Passive skill level +1.
- Core Skill F: Base ATK +25, Core Passive skill level +1.

### Data Model Added

Updated:

```text
data/agents.json
```

Added `coreSkill` to Ye Shunguang.

The structure records:

- localized Core Skill name;
- default level;
- max level;
- an ordered list of A-F enhancement records;
- each enhancement's stat changes;
- each enhancement's Core Passive skill level increment;
- source/verification metadata.

The current Ye Shunguang Core Skill model is:

```text
A: critRate +0.048, target panel
B: atkBase +25, target base
C: critRate +0.048, target panel
D: atkBase +25, target base
E: critRate +0.048, target panel
F: atkBase +25, target base
```

The Core Passive skill level increments are stored but not used by the current
panel calculator because skill multipliers and Core Passive damage scaling are
still deferred.

### Calculation Model Changed

Updated:

```text
backend/calculator.js
```

Before this change, total Base ATK was:

```text
base.atk = agent.level60.atkBase + wEngine.level60.atkBase
```

After this change, total Base ATK is:

```text
base.atk = agent.level60.atkBase + wEngine.level60.atkBase + coreSkill.atkBase
```

For Ye Shunguang at Core Skill F:

```text
base.atk = 863 + 743 + 75 = 1681
```

Core Skill Base HP and Base DEF are also supported in the model, even though Ye
Shunguang's current Core Skill data only adds Base ATK.

### Core Skill Selection

The calculation input now supports:

```json
{
  "coreSkillLevel": "F"
}
```

If `coreSkillLevel` is omitted, the backend uses the agent's modeled default
Core Skill level. For Ye Shunguang this is `F`.

If a character has no modeled Core Skill data yet, the backend uses `none` and
applies no Core Skill bonuses. This preserves the current Anby snapshot until
her Core Skill table is added.

### Core Skill Application Rules

Core Skill levels are cumulative. Selecting `F` applies A, B, C, D, E, and F.
Selecting `C` applies A, B, and C.

Stats with `target: "base"` are added to the `base` object before percentage
bonuses are applied. This matters for Base ATK because Drive Disc ATK% should
scale the Core Skill Base ATK addition.

Stats with `target: "panel"` are added through the existing `bonusTotals`
accumulator. For Ye Shunguang, Core Skill A/C/E add a total of:

```text
critRate = 0.048 + 0.048 + 0.048 = 0.144
```

### Calculation Output Added

The calculator response now includes:

```text
baseBreakdown
coreSkill
```

`baseBreakdown` records:

- agent base HP/ATK/DEF;
- W-Engine base contribution;
- Core Skill base contribution;
- total base values.

`coreSkill` records:

- selected level;
- applied levels;
- base additions;
- panel bonuses;
- Core Skill applied effect records.

### Applied Effects Added

Core Skill enhancement records are emitted into `appliedEffects` with keys such
as:

```text
ye_shunguang.coreSkill.A
ye_shunguang.coreSkill.B
ye_shunguang.coreSkill.C
ye_shunguang.coreSkill.D
ye_shunguang.coreSkill.E
ye_shunguang.coreSkill.F
```

The frontend renders these as Ye Shunguang Core Skill effects.

### Frontend Changes

Updated:

```text
frontend/index.html
frontend/app.js
```

Added a `核心技` select control to the role settings card.

Frontend behavior:

- If the selected agent has Core Skill data, the selector shows `未强化` plus
  each modeled enhancement level.
- The default selected level is the agent's modeled default level.
- Ye Shunguang defaults to `强化F`.
- If the selected agent has no Core Skill data, the selector shows `未建模` and
  is disabled.
- Changing the Core Skill level recalculates the panel.
- Loading an example applies that example's `coreSkillLevel` when present.
- The agent metadata strip now includes a Core Skill summary chip.

### Ye Shunguang Example Updated

Updated:

```text
examples/ye_shunguang_panel.example.json
```

The Ye Shunguang example now includes:

```json
"coreSkillLevel": "F"
```

The expected base attack changed from:

```text
1606 = 863 + 743
```

to:

```text
1681 = 863 + 743 + 75
```

The expected panel CRIT Rate changed from:

```text
36.2%
```

to:

```text
50.6%
```

The expected panel ATK changed from:

```text
3453.58
```

to:

```text
3598.33
```

The expected simple score changed from:

```text
6818.911360976
```

to:

```text
8356.378729688
```

### Documentation Updated

Updated:

```text
docs/modeling.md
docs/goal.md
```

`docs/modeling.md` now states that total Base ATK includes agent Base ATK,
W-Engine Base ATK, and Core Skill Base ATK. It also documents the Core Skill
data shape and explains that Core Skill panel bonuses are stable
out-of-combat progression.

`docs/goal.md` now marks Core Skill level modeling for out-of-combat panel
stats as done, while tracking Core Skill data for every agent as an iterative
future goal.

### Verification

Verified:

- `node --check backend/calculator.js`
- `node --check frontend/app.js`
- The Ye Shunguang example with `coreSkillLevel: "F"` returns Base ATK 1681,
  Core Skill Base ATK contribution 75, bonus CRIT Rate 45.6%, final CRIT Rate
  50.6%, final ATK 3598.33, and simple score 8356.378729688.
- The Anby example remains unchanged because Anby does not yet have modeled
  Core Skill data.

## 2026-05-27 - Fixed Core Skill Default On Agent Switching

### Request Context

The user observed that after refreshing the calculator page and selecting Ye
Shunguang again, the Core Skill level was not defaulting to the highest modeled
level. Since Ye Shunguang's Core Skill A-F contributes both Base ATK and CRIT
Rate, an accidental `none` selection makes the visible panel look wrong:

- Base ATK misses the Core Skill +75 contribution from B/D/F.
- CRIT Rate misses the Core Skill +14.4% contribution from A/C/E.
- The resulting out-of-combat panel no longer matches the intended full-Core
  default.

### Root Cause

The frontend reused the current `<select id="coreSkillSelect">` value when
rendering a newly selected agent. This is correct while the user is editing the
same agent, but wrong during an agent switch.

The problematic flow was:

1. The page loads or is currently showing a character without modeled Core Skill
   data, such as Anby.
2. That character's Core Skill select contains `none`.
3. The user changes the agent select to Ye Shunguang.
4. `renderCurrentSelection()` calls `populateCoreSkillSelect(agent,
   els.coreSkillSelect.value)`.
5. Because `none` is technically a valid option for Ye Shunguang, the function
   preserves `none` instead of using Ye Shunguang's `defaultLevel: "F"`.

This meant `none` was incorrectly treated as an explicit Ye Shunguang choice,
even though it was only inherited from the previously selected agent.

### Frontend Change

Updated:

```text
frontend/app.js
```

Added a dedicated helper:

```text
resetCoreSkillSelectToAgentDefault(agentId)
```

The helper resolves the newly selected agent and calls
`populateCoreSkillSelect()` with `coreSkillDefaultLevel(agent)`, ensuring the
select is repopulated with that agent's own default Core Skill level.

The agent change listener now performs this reset before loading the selected
agent's equipped Drive Discs and before recalculating:

```text
resetCoreSkillSelectToAgentDefault(els.agentSelect.value)
loadEquippedDriveDiscsForSelectedAgent()
await calculate()
```

### Behavior After Change

When the user switches from Anby or any no-Core-Skill-modeled agent to Ye
Shunguang:

- The Core Skill select now defaults to `强化F`.
- The next calculation sends `coreSkillLevel: "F"`.
- Ye Shunguang's Base ATK includes the Core Skill +75 contribution.
- Ye Shunguang's out-of-combat CRIT Rate includes the Core Skill +14.4%
  contribution.

The existing manual Core Skill select behavior remains intact while the user is
editing the current agent. If the user explicitly changes Ye Shunguang's Core
Skill level after selecting her, subsequent calculations use that selected
level.

### Verification

Verified:

- `node --check frontend/app.js`
- The change is scoped to the agent-switch entry point and does not alter the
  backend calculation formula.
- The full Ye Shunguang example still calculates through the same
  `coreSkillLevel: "F"` path used by the previous Core Skill modeling update.

## 2026-05-27 - Added Grouped Teammate Buff Model And Qianxia Buffs

### Request Context

The user asked for the homepage's teammate Buff model to be made explicit before
more teammate support is added. The requested shape is teammate-centered:

```text
teammate name
  -> Buff source
  -> literal Buff description
  -> structured calculation effect
```

The important modeling requirement is that one teammate name must be able to own
multiple Buff entries. The Buff entries must preserve their literal in-game text
for inspection, while also storing normalized stat effects for actual in-combat
panel calculation.

The first teammate requested was 千夏, with two Buffs:

1. Source: `核心被动`
2. Source: `强化特殊技`

Both Buffs are treated as in-combat Buffs. Duration and trigger logic are not
modeled yet; the homepage exposes them as user-selected checkboxes.

### Data Model Change

Updated:

```text
data/combat_buffs.json
```

Added a new top-level `teammates` array. It is separate from the existing flat
`buffs` array so teammate data can stay naturally grouped for maintenance and
frontend display.

The shape is:

```json
{
  "teammates": [
    {
      "id": "qianxia",
      "name": {
        "zhCN": "千夏",
        "en": "Qianxia"
      },
      "buffs": [
        {
          "id": "qianxia.core_passive.angelic_chord_atk_flat_1050",
          "source": {
            "zhCN": "核心被动",
            "en": "Core Passive"
          },
          "description": {
            "zhCN": "literal display text"
          },
          "scope": "inCombat",
          "stats": [
            {
              "stat": "atkFlat",
              "value": 1050,
              "mode": "flat"
            }
          ]
        }
      ]
    }
  ]
}
```

This gives each teammate a stable id, localized name, and a list of Buff
entries. Each Buff entry has:

- `id`: stable calculation id used in `activeBuffIds`;
- `source`: where the Buff comes from, such as `核心被动`, `影画1`,
  `额外能力`, or `强化特殊技`;
- `description`: literal text for UI inspection;
- `scope`: currently `inCombat`;
- `stats`: normalized calculation payload.

### Qianxia Data Added

Added teammate:

```text
千夏 / qianxia
```

Added Buff 1:

```text
id: qianxia.core_passive.angelic_chord_atk_flat_1050
source: 核心被动
description:
  处于「天使协律」状态下的角色的攻击力提升，提升数值等同于千夏30%初始攻击力，最高不超过1050点；当千夏的初始攻击力达到3500点时，为全队角色提供的攻击力增益效果达到最大值
stats:
  atkFlat +1050
```

Added Buff 2:

```text
id: qianxia.ex_special.ethereal_curtain_reverie_atk_flat_50
source: 强化特殊技
description:
  「以太帷幕·妄想重奏」生效期间，全队角色攻击力额外提升50点，持续40秒，千夏重复开启「以太帷幕·妄想重奏」前，将关闭已有的「以太帷幕·妄想重奏」
stats:
  atkFlat +50
```

### Backend Change

Updated:

```text
backend/calculator.js
```

Added helper:

```text
flattenTeammateCombatBuffs(teammates)
```

The backend keeps the grouped teammate structure for `/api/meta`, but flattens
each teammate Buff into the existing combat Buff calculation path. This avoids
creating a second calculation mechanism while still preserving the grouped
maintenance model.

For calculation, each teammate Buff is normalized with:

- `sourceType: "teammate"`;
- `teammateId`;
- `teammateName`;
- `sourceLabel`;
- `description`;
- `conditionLabel`, derived from description unless an explicit condition label
  is provided;
- `name`, defaulting to `队友名｜Buff来源`.

The existing in-combat request can now activate 千夏 Buffs through:

```json
{
  "combatBuffs": {
    "activeBuffIds": [
      "qianxia.core_passive.angelic_chord_atk_flat_1050",
      "qianxia.ex_special.ethereal_curtain_reverie_atk_flat_50"
    ]
  }
}
```

When both are active, the in-combat panel receives:

```text
atkFlat +1100
```

### Frontend Change

Updated:

```text
frontend/app.js
frontend/styles.css
```

The homepage teammate Buff section now renders grouped teammate Buffs through:

```text
teammateCombatBuffGroups()
renderTeammateCombatBuffGroups(...)
```

The visible structure is:

```text
千夏
  [ ] 核心被动
      literal description
      实际效果：攻击力 +1050
  [ ] 强化特殊技
      literal description
      实际效果：攻击力 +50
```

The checkbox still uses the same `data-combat-buff-id` mechanism as other
combat Buffs, so selecting either row immediately feeds its id into
`activeBuffIds` and recalculates the in-combat panel.

Added styles for:

- `.combat-team-group`;
- `.teammate-buff-row`;
- `.combat-check-description`;
- `.combat-check-stats`.

The goal was to make teammate Buffs readable without turning them into raw JSON.

### Documentation Updated

Updated:

```text
docs/modeling.md
docs/goal.md
```

`docs/modeling.md` now documents the teammate Buff group shape and explains the
backend flattening step.

`docs/goal.md` now marks the grouped teammate Buff model and the first 千夏
Buff entries as done. The in-combat panel layer is now marked as iterating
instead of merely planned, because the calculator already has a working
selection and panel-composition path, while damage and timing semantics remain
future work.

### Verification

Verified:

- `node --check backend/calculator.js`
- `node --check frontend/app.js`
- `data/combat_buffs.json` parses successfully as JSON.

The next verification step after restarting the local server is to call
`POST /api/calculate/in-combat` with both 千夏 Buff ids enabled and confirm that
the returned `inCombat.buffTotals.atkFlat` increases by `1100`.

## 2026-05-27 - Polished Buff Selection Modal And Limited Custom Buffs To One Stat

### Request Context

The user reported that the Buff selection modal opened by the `+` button looked
too rough, with the custom Buff page being especially poor. The user also asked
that custom Buff creation should no longer allow adding multiple entries inside
one modal. One modal submission should create one custom Buff only.

### UI Problems Addressed

The previous modal inherited too much from the Drive Disc modal:

- It stretched very wide across the viewport.
- The header was a plain white form header.
- The search box, tabs, and content had little visual hierarchy.
- The custom Buff pane rendered as a raw row of select + input + delete button.
- The `添加属性` button encouraged bundling several unrelated stat effects into
  one custom Buff, making later inspection harder.

### HTML Changes

Updated:

```text
frontend/index.html
```

Changed the Buff modal search label to use:

```text
combat-buff-search-field
```

This gives the search row a modal-specific layout and avoids relying only on the
generic `.field` styling.

Added a custom Buff intro block:

```text
custom-buff-intro
```

The intro states that one modal submission adds one custom Buff and that the
saved Buff will appear in the homepage `其他 Buff` list.

Removed the old custom Buff button:

```text
addCustomBuffStatBtn
```

Removed visible text:

```text
添加属性
```

Renamed the save action text from:

```text
保存自定义 Buff
```

to:

```text
保存并添加
```

This better matches the action: the Buff is saved and immediately added to the
current in-combat panel configuration.

### Frontend Logic Changes

Updated:

```text
frontend/app.js
```

Removed `addCustomBuffStatBtn` from the element lookup table and removed its
event listener.

Removed the custom stat row delete handler. Since there is now only one custom
stat row, deleting rows is no longer part of the interaction.

Changed:

```text
renderCustomBuffStatRows(...)
```

The function now renders exactly one custom stat editor:

- one stat select;
- one numeric value input;
- no remove button;
- no dynamic row append.

The rendered row uses real `.field` labels for `属性` and `数值`, so the layout
looks consistent with the rest of the application.

Changed custom Buff sanitization:

```text
sanitizeAddedCombatBuffs(...)
```

When loading saved custom Buffs, the code now keeps only the first valid stat:

```text
stats: stats.slice(0, 1)
```

This ensures older multi-stat custom Buff records do not keep behaving like
multi-effect custom Buffs after the UI has moved to a one-stat model.

### Styling Changes

Updated:

```text
frontend/styles.css
```

The Buff modal is now styled through:

```text
.disc-modal.combat-buff-modal
```

The selector intentionally has higher specificity than the generic
`.disc-modal` rule, so the modal no longer expands to the Drive Disc modal's
wide layout.

Changed modal width to:

```text
min(920px, calc(100vw - 32px))
```

The modal now has:

- a dark ZZZ-like header;
- a yellow bottom accent line;
- a card-like white/soft-gray body;
- a segmented tab control;
- more deliberate candidate Buff cards;
- a polished custom Buff panel;
- a compact single-row custom stat editor.

Added or updated styles for:

```text
.combat-buff-search-field
.combat-buff-tabs
.combat-buff-candidate-list
.combat-candidate-row
.combat-custom-pane
.custom-buff-intro
.custom-buff-stat-row
```

### Behavior After Change

Opening the Buff modal with `+` now shows a narrower, more focused modal.

Switching to `自定义` now shows:

```text
自定义 Buff
名称
属性
数值
保存并添加
```

There is no `添加属性` button. There are no per-row delete buttons. Saving can
only create a custom Buff with one normalized stat effect.

### Documentation Updated

Updated:

```text
docs/modeling.md
docs/goal.md
docs/changelog.md
```

`docs/modeling.md` now documents that homepage custom Buffs are one-Buff,
one-stat manual corrections converted into `combatBuffs.manualStats`.

`docs/goal.md` now marks Buff modal polishing and single-stat custom Buff input
as done.

### Verification

Verified:

- `node --check frontend/app.js`
- Search confirmed that `addCustomBuffStatBtn`, `data-remove-custom-stat`, and
  visible `添加属性` are no longer present in the active frontend files.
- Loaded `http://localhost:8787/` in headless Edge, clicked the homepage `+`
  Buff button, switched to `自定义`, and inspected the live DOM.
- Saved a live custom Buff named `测试攻击 Buff` with `固定攻击力 = 123` and
  confirmed the homepage stored exactly one normalized stat object:
  `atkFlat +123`.

Live DOM verification returned:

```json
{
  "modalHidden": false,
  "modalWidth": 920,
  "addButtonExists": false,
  "customRowCount": 1,
  "customSelectCount": 1,
  "customValueCount": 1,
  "removeButtonCount": 0
}
```

A screenshot was inspected locally to confirm the custom Buff panel has no
obvious text overlap or raw row controls. The temporary screenshot file was
deleted after verification.
