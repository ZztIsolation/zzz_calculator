# ZZZ Calculator

Zenless Zone Zero Drive Disc, panel, damage, and optimizer workspace. The app is
a small dependency-free Node.js backend with static browser pages for account
management, inventory maintenance, out-of-combat and in-combat panel
calculation, damage inspection, and Drive Disc optimization.

Chinese documentation is available in [README.zh-CN.md](README.zh-CN.md).

## Upload Update Summaries

### 2026-07-09 Scanner 1.0.36 Release

This upload replaces the web-launched OCR runtime with ZZZ Scanner Next
`1.0.36`:

- Repacked the OCR runtime from local `publish 1.0.36`, excluding generated
  `Scans` output while keeping the bundled `Data/ocr_fast_templates.json`.
- Updated the Pages scanner manifest, local package manifest, and scanner
  helper download links to `scannerVersion=1.0.36`.
- Published the OCR zip under GitHub Release tag `scanner-1.0.36` with SHA-256
  `d885c0aef6da61cfcbf994ad2b4e712a31efe8bd87631260fe4f87ea8711c63d` and size
  `47231570` bytes.
- Verified the local `1.0.36` scanner with a 120-item benchmark:
  `Completed=120`, `Failed=0`, duplicate exports 0, `IncompleteRoi=0`,
  `slot_safety=pass`, and `profile_route=exact:7`.

### 2026-07-02 Scanner 1.0.35 Cloud Client Selection

This upload adds an explicit Drive Disc scanner client switch. The default
remains local Zenless Zone Zero, while Cloud Zenless Zone Zero sends
`processName="Zenless Zone Zero Cloud"` and `visualProfileClient="cloud"` so
the scanner can use the bundled cloud visual profiles.

- Repacked the OCR runtime from local `publish 1.0.35`, excluding generated
  `Scans` output while keeping the bundled `Data/ocr_fast_templates.json`.
- Updated the Pages scanner manifest and local package manifest to
  `scannerVersion=1.0.35`.
- Published the OCR zip under GitHub Release tag `scanner-1.0.35` with SHA-256
  `2a10aa3dc92e50c7ea930d75eda82fef741eff16e8c39f2839240b6fc36b0255` and size
  `47228425` bytes.
- The web scan payload still uses the stable strict DXGI route, now with an
  explicit local/cloud target so cloud scans no longer search for the local
  `ZenlessZoneZero` process.

### 2026-07-02 Scanner 1.0.34 Release

This upload replaces the web-launched OCR runtime with ZZZ Scanner Next
`1.0.34`:

- Repacked the OCR runtime from local `publish 1.0.34`, excluding generated
  `Scans` output while keeping the bundled `Data/ocr_fast_templates.json`.
- Updated the Pages scanner manifest and local package manifest to
  `scannerVersion=1.0.34`.
- Published the OCR zip under GitHub Release tag `scanner-1.0.34` with SHA-256
  `d87a993e15a0f9103942b0284d8d5fc552bed348147180682ef42f7b0fc51c30` and size
  `47228531` bytes.
- Kept the web scan payload on the stable strict DXGI route and refreshed
  Helper `1.0.2`, which accepts a fully downloaded temporary package before
  retrying Range requests and still shows bytes, percentage, speed, and retries.

### 2026-07-02 Scanner 1.0.33 and Modal Workflow Update

This upload publishes the web-launched scanner as ZZZ Scanner Next `1.0.33`
and commits the pending optimizer/inventory UI updates:

- Repacked the OCR runtime from the local `publish 1.0.33` output. The package
  includes the built-in `Data/ocr_fast_templates.json`, so the web page does not
  pass any `ocrFastIndex` override.
- The Drive Disc scan request now uses the stable `1.0.33` payload:
  `fastMode=true`, `captureMode=dxgi`, `profileRouting=strict`,
  `overlapConflictMode=recover`, `panelAcceptMode=adaptive-early-full-roi`,
  `scrollAcceptMode=early-one-row`, `postScrollPanelAcceptMode=safe`, and
  `panelMinAcceptFloorMs=120`.
- Non-level-15 full-inventory scanning remains disabled by default through
  `stopAtNonLevel15=true`.
- The Drive Disc analysis modal now starts from the role-aware difference view,
  while keeping the current substat and gain-curve views available.
- Combat Buff, two-piece/four-piece optimizer filters, calculation config,
  Drive Disc edit, and loadout edit modals now use explicit cancel/apply or
  cancel/save footers, so tentative edits do not immediately mutate the active
  build.
- Stacked W-Engine effects can share one runtime stack control through
  `stackGroup`; Qingming Cage now keeps its two "Qingming Companion" effects in
  sync.

### 2026-07-02 Scanner Helper Download Progress

This upload refreshes `ZZZ-Scanner-Helper.exe` for the existing
`scanner-1.0.33` release:

- Helper download now reports downloaded bytes, total bytes, percentage, speed,
  and retry attempt while preparing the OCR runtime.
- The Drive Disc page renders that progress instead of staying on a fixed
  "downloading" message.
- If the connected Helper is older than `1.0.1`, the page asks the user to
  download the refreshed Helper because older helpers cannot emit byte-level
  download progress.
- Local diagnostics showed the GitHub Release asset exists, but full downloads
  from the current network can reset or fail to connect, so the symptom is a
  flaky/blocked download path rather than a pure UI freeze.

### 2026-07-01 Role-Aware Drive Disc Stat Difference Analysis

This update reuses the existing "stat analysis" modal and adds a "difference
analysis" view:

- Substat differences use the current six equipped Drive Discs, Buff runtime
  state, and damage target as the baseline, then sort by real marginal damage.
- Slot 4/5/6 main-stat candidates read the agent's
  `preferredDriveDiscs.mainStatLimits`, falling back to the generic slot pool
  only when no role preference exists.
- The currently equipped main stat is filtered out, so a physical-damage disc no
  longer produces a meaningless `-30 physicalDmg` reverse row.
- Browser-local analysis, backend analysis, and regression tests are kept in
  parity.

### 2026-07-01 Slim Scanner Packages

This upload reduces the web-launched scanner download footprint without changing
the browser workflow:

- Rebuilt `ZZZ-Scanner-Helper.exe` as a NativeAOT helper, reducing the local
  helper download from about 67.6MB to 7.4MB.
- Repacked the `1.0.28` OCR scanner zip without unused video/diagnostic
  payloads, reducing the package from about 129.9MB to 115.2MB.
- Updated the scanner manifest hash/size and kept the same helper protocol,
  scanner version, entry point, and OCR model.
- The public Pages manifest now serves the verified GitHub Release package
  first so the stale ECS mirror cannot return the old larger scanner package.

### 2026-07-01 02:55 +08:00

This upload fixes first-run OCR scanner preparation on the public Pages site:

- Uploaded the `1.0.28` OCR zip to the ECS mirror and made the generated
  scanner manifest try that mirror before GitHub Releases.
- Extended the browser-side scanner preparation timeout to cover the current
  130MB package download time on the low-bandwidth mirror.
- If the helper probe already reports the scanner as installed, the Drive Disc
  page now enables scanning without waiting for another launcher progress cycle.

### 2026-06-30 22:20 +08:00

This upload moves the public site toward the no-ICP GitHub Pages + GitHub
Releases deployment path:

- Added `npm run build:pages` to generate a `dist/pages` static site with
  `static/catalog.json`, `static/app-config.json`,
  `downloads/zzz-scanner/manifest.json`, and `CNAME`.
- Frontend catalog/config loading now prefers static JSON while keeping the
  local Node server APIs as development fallbacks.
- The Drive Disc helper download now points to GitHub Releases; the OCR
  manifest supports `packageUrls` so the helper can try multiple package
  sources when an up-to-date mirror is available.
- Added a GitHub Actions Pages workflow that publishes the Pages artifact
  without committing `dist/pages` or large `downloads/` files.

### 2026-07-01 01:00 +08:00

This upload updates the web-launched OCR scanner integration for the 1.0.28
stability release:

- Updated `/downloads/zzz-scanner/manifest.json` to serve ZZZ Scanner Next
  `1.0.28` from `/downloads/zzz-scanner/1.0.28/ZZZ-Scanner.Next-win-x64.zip`.
- The web scanner request now sends the stable fast DXGI route:
  `overlapConflictMode=recover`, `panelMinAcceptFloorMs=120`, and
  `postScrollPanelAcceptMode=safe`, with non-15 scanning still opt-in only.
- Scanner error dialogs now include the scanner version and runtime directory,
  making it clear which local OCR package actually handled the request.
- Added scanner package and `scan_req` payload validation to
  `npm run test:scanner-bridge`.

### 2026-06-24 01:31 +08:00

This upload adds or expands these major areas:

- Added the official Drive Disc sets Howling Salon and Dawn Bloom Journey,
  including local icon assets, 2-piece stats, and modeled 4-piece self buffs.
- Completed Wind stat support across maintenance, homepage panels, the
  calculator page, Drive Disc inventory, scanner import, optimizer scoring, and
  stat rules for `windDmg`, `windResIgnore`, `enemyWindResReduction`, and
  `windSheerDmg`.
- Added Wind DMG Bonus to slot-5 Drive Disc main-stat pools, using the same
  30% S-rank main-stat cap as the existing elemental DMG bonus stats.
- Extended regression validation through percent sanity, maintenance
  validation, shared combat helpers, Drive Disc import/analysis, optimizer,
  compiled panel, and damage white-box tests.

### 2026-06-23 12:55 +08:00

This upload adds or expands these major areas:

- Merged the optimizer workspace into the homepage so `/` now shows manual
  Drive Disc selection, saved loadout selection, optimized candidate tabs,
  out-of-combat panel, in-combat panel, and damage white-box output together.
- Replaced the old `/calculate.html` page with a compatibility redirect to `/`
  and tightened missing static file handling so unknown files return `404`.
- Added unified Drive Disc scheme controls for manual picks, saved loadouts,
  and optimizer results, including current-scheme 4-piece buff runtime controls
  and save/apply loadout actions from the same workspace.
- Expanded combat buff and Drive Disc set data for newer teammates and 4-piece
  behavior, including additional teammate portrait assets.
- Added regression coverage for the unified optimizer UI, compatibility
  redirect, damage modifier handling, maintenance validation, optimizer set
  behavior, shared combat helpers, and W-Engine modification values.

### 2026-06-09 20:28 +08:00

This upload adds or expands these major areas:

- Added boss stun target controls and stun multiplier modeling for direct,
  sheer, anomaly, and disorder damage, including white-box formula rows,
  modeling docs, and regression coverage.
- Added Core Skill-scaled skill multiplier support so damage rows can use
  Core Skill levels such as `0` and `A-F`; Hoshimi Miyabi now includes
  Frostburn Break core-skill damage data and cinema-targeted buffs.
- Upgraded the Drive Disc optimizer with an `exact-super-bound-parallel`
  worker-thread path, compiled/dense score kernels, worker metrics, and
  benchmark coverage for parallel exact searches.
- Added optimizer controls for recommended 4-piece set selection, agent
  default 4-piece sets, and automatic/manual 4-piece buff runtime inputs.
- Improved page-level feedback and error reporting with a shared frontend
  notice helper across the homepage, optimizer, Drive Disc, account, and
  maintenance pages.
- Expanded teammate buff maintenance into grouped teammate records with
  portrait/icon metadata, and added teammate portraits for combat buff
  browsing.
- Preserved defense ignore as a distinct maintenance stat instead of folding it
  into defense reduction during form cleanup.
- Added compiled-score, compiled-panel-score, maintenance-stat, stun-multiplier,
  preferred-Drive-Disc, and teammate-image validation coverage.

### 2026-06-07 21:15 +08:00

This upload adds or expands these major areas:

- Improved frontend usability across the calculator, optimizer, Drive Disc,
  account, and maintenance pages, including clearer empty states, compact
  mobile navigation, sticky action bars, visible optimizer progress, and a
  searchable skill multiplier picker.
- Added a shared browser dialog helper and replaced native prompt/confirm flows
  for account actions, Drive Disc deletion/import sync, loadout deletion, and
  optimizer loadout naming.
- Added homepage final-damage feedback after calculation and scroll-to-result
  behavior so the damage white-box output is easier to find.
- Preserved selected combat buff state per agent and refined custom resistance
  input handling with explicit positive/negative controls.
- Restricted sheer force and sheer damage to Rupture agents, with regression
  coverage for non-Rupture agents attempting sheer events.
- Expanded exact optimizer pruning instrumentation and warmup behavior,
  including timing metrics, seed cutoffs, skipped bound checks, and a fuzz test
  comparing exact-super-bound results with exact-legacy results.

### 2026-06-04 00:46 +08:00

This upload adds or expands these major areas:

- Added Yixuan as a Rupture/Xuanmo agent, including portrait art, base stats,
  Core Skill buffs, default sheer-damage calculation config, and a full skill
  multiplier catalog modeled on sheer force.
- Added the sheer damage system: `sheer` damage events, derived `sheerForce`,
  flat sheer force, general and element-specific sheer damage bonuses, crit
  support, resistance handling, and dedicated white-box formula rows.
- Expanded stat rules, Drive Disc set effects, W-Engine effects, W-Engine image
  assets, maintenance validation, custom buff options, and optimizer scoring for
  sheer-damage builds.
- Added new Rupture-focused W-Engines and modification value tests, including
  physical, fire, ice, ether, and sheer-force buff variants.
- Added Drive Disc analysis APIs and frontend tooling for substat effective
  rolls and per-stat damage gain curves.
- Improved the calculator and optimizer UI with sheer objective/event controls,
  entity selection helpers, analysis panels, and styling updates.
- Added `npm run test:drive-disc-analysis` plus regression coverage for sheer
  damage white-box output, optimizer progress, shared combat helpers,
  maintenance validation, and W-Engine modification values.
- Added a frontend usability audit document for the current calculator and
  optimizer experience.

### 2026-06-03 00:50 +08:00

This upload adds or expands these major areas:

- Expanded the W-Engine catalog and image assets with a larger set of Support,
  Stun, Anomaly, Attack, and Defense engines.
- Migrated W-Engine modification modeling from legacy scaling rules to explicit
  modification-rank value tables, with validation and regression tests for the
  new `modificationValues` shape.
- Expanded teammate combat buff data for Nangongyu, Youye cinema effects, Yao
  Jiayin, Rina, Lucy, Nicole, and Soukaku.
- Split attribute anomaly damage bonus and disorder damage bonus into separate
  event modifier zones; disorder no longer inherits attribute anomaly damage
  bonus or anomaly crit.
- Added normal and polarized disorder handling, and made disorder duration use
  catalog defaults instead of a user-entered duration field.
- Upgraded combat buff selection with a teammate picker, source-grouped active
  buffs, per-source remove actions, and limits for teammate, W-Engine team, and
  Drive Disc team buff sources.
- Grouped related runtime inputs for multi-effect formula and derived buffs so
  one source input can drive all linked effect rules.
- Updated homepage and optimizer damage controls, white-box rows, custom buff
  options, maintenance validation, modeling docs, and regression tests for the
  new disorder and W-Engine behavior.

### 2026-06-02 02:55 +08:00

This upload adds or expands these major areas:

- Added a calculator configuration workflow for the optimizer, with single
  direct-damage, anomaly-focused, and custom multi-event damage objectives.
- Added per-agent admin default calculation configs that can be edited from the
  maintenance page and applied from the optimizer page; Hoshimi Miyabi now ships
  with a default mixed rotation target.
- Reworked anomaly data into a unified `effects` catalog with `settlementType`,
  while still exposing attribute anomaly and disorder lists separately to the
  calculator and maintenance UI.
- Added Hoshimi Miyabi's Frost Frozen Disorder model, including its 600% fixed
  multiplier, 75% per-tick multiplier, and 20 second default duration.
- Expanded damage event normalization so disorder is modeled as an anomaly
  settlement type, event lists can sum into `totalFinalDamage`, direct damage
  exposes crit/non-crit/expected variants, and damage rows include panel
  snapshots for debugging.
- Upgraded the Drive Disc optimizer with the recommended `exact-super-bound`
  algorithm, a legacy exact comparison mode, a fast non-strict heuristic mode,
  super-bound pruning metrics, scored/pruned/processed counts, and better
  progress percentages.
- Added support for choosing multiple allowed extra 2-piece sets instead of a
  single fixed extra set.
- Improved optimizer background jobs, polling, cancelation, progress display,
  evaluation-rate reporting, complexity hints, and result metrics.
- Added `npm run benchmark:optimizer` for comparing the legacy exact optimizer
  against the new super-bound exact optimizer.
- Extended maintenance validation for default calculation configs, anomaly
  settlement types, skill references, event counts, and disorder timing.
- Expanded regression coverage for optimizer algorithms, progress accounting,
  custom/default damage configs, anomaly settlement, damage white-box output,
  and maintenance validation.

### 2026-06-01 22:54 +08:00

This upload added or expanded these major areas:

- Multi-account support with isolated Drive Disc inventories, loadouts, imports,
  and homepage selections.
- Direct, anomaly, and disorder damage calculation with white-box multiplier
  rows for defense, resistance, PEN, RES ignore, anomaly proficiency, anomaly
  level, attribute anomaly damage bonus, disorder damage bonus, anomaly crit,
  and final damage.
- Data-backed anomaly and disorder catalogs in `data/anomaly_effects.json`.
- Agent skill multiplier catalogs for Ye Shunguang, Hoshimi Miyabi, and Alice
  Thymefield, including generated total-hit rows for compatible multi-hit
  moves.
- W-Engine modification levels from 1 to 5, with exact calculation values and
  official rounded display values for self and team buffs.
- New agent and W-Engine data and assets for Hoshimi Miyabi, Alice Thymefield,
  Hailfall Star Palace, and Tenfold Starforge.
- Expanded teammate, field, boss, manual, skill-targeted, and W-Engine team
  buff modeling, including modifier-only buffs and buff amplification rules.
- Homepage and optimizer damage controls for target presets, defense,
  elemental resistance, direct skill selection, anomaly events, and disorder
  timing.
- Drive Disc import deduplication, upgrade merging, remove-missing sync, and
  loadout cleanup when imported or deleted discs disappear.
- Drive Disc loadout management and optimizer save-to-loadout flow.
- Maintenance UI support for agent skills, W-Engine modification scaling,
  anomaly/disorder effects, split self/team effects, and stricter validation.
- Additional regression tests for accounts, scanner import, W-Engine
  modification scaling, shared combat helpers, anomaly damage, damage
  white-box output, maintenance validation, and optimizer behavior.

## Features

- Agent, W-Engine, Drive Disc set, skill multiplier, stat rule, anomaly effect,
  and combat buff catalogs.
- Out-of-combat panel calculation from agent stats, Core Skill level, W-Engine
  stats, Drive Discs, and unconditional set effects.
- In-combat panel calculation from selected self, teammate, W-Engine, Drive Disc
  4-piece, field, boss, and manual buffs.
- Combat buff selection with teammate, W-Engine team, Drive Disc team, and
  custom sources grouped for review and removal.
- Damage preview for direct, sheer, anomaly, and disorder events, with
  inspectable white-box formula rows, target resistance/defense/stun controls,
  and separate damage modifier zones.
- ZZZ Scanner Drive Disc import, one-click local helper scanning, manual
  inventory editing, duplicate handling, account-scoped storage, and optional
  remove-missing synchronization.
- Saved Drive Disc loadouts that can be applied on the homepage or created from
  optimizer results.
- Drive Disc optimizer with calculation target presets, preview, background job
  progress, cancelation, set-shape constraints, multiple optional 2-piece set
  choices, recommended/default 4-piece set helpers, automatic or manual 4-piece
  buff handling, main-stat constraints, minimum stat filters, exact/fast/parallel
  algorithm choices, and damage scoring.
- Drive Disc analysis tools for current substat effective rolls and projected
  damage gains from extra substat rolls.
- Browser maintenance pages for static game data and validation-oriented JSON
  editing.

## Directory Layout

```text
zzz_calculator/
  README.md
  README.zh-CN.md
  package.json
  backend/
    server.js
    calculator.js
    driveDiscAnalysis.js
    driveDiscInventory.js
    driveDiscOptimizer.js
    driveDiscOptimizerWorker.js
  data/
    agents.json
    agent_skills.json
    anomaly_effects.json
    w_engines.json
    drive_disc_sets.json
    stat_rules.json
    combat_buffs.json
    user_drive_discs.example.json
  docs/
    changelog.md
    frontend-usability-audit.md
    goal.md
    modeling.md
  examples/
    out_of_combat_panel.example.json
    ye_shunguang_panel.example.json
  frontend/
    index.html
    drive-discs.html
    accounts.html
    maintenance.html
    app.js
    calculate.js
    drive-disc-analysis.js
    drive-discs.js
    dialogs.js
    entity-select.js
    feedback.js
    accounts.js
    accounts-page.js
    maintenance.js
    maintenanceStats.js
    shared-combat.js
    skillMultiplierCandidates.js
    assets/
  tests/
```

## Run

Requires Node.js with ES module support. No third-party package install is
currently required.

```bash
cd zzz_calculator
npm start
```

Open the printed local URL, usually `http://localhost:8787`. You can override
the port with `PORT=8791 npm start`.

The Drive Disc page can launch a small local scanner helper. Public builds link
the helper download to GitHub Releases; local Node server development can still
serve it from `/downloads/ZZZ-Scanner-Helper.exe`. The OCR package manifest
currently uses the verified GitHub Release package. The helper registers
`zzz-scanner://`, connects back to the page on
`127.0.0.1:22355`, and downloads the OCR scanner package declared by
`/downloads/zzz-scanner/manifest.json` when needed. The current scanner package
is ZZZ Scanner Next `1.0.36`.

Main pages:

- `/` - Drive Disc optimizer homepage with manual, loadout, and optimized scheme previews
- `/drive-discs.html` - Drive Disc inventory and loadout management
- `/calculate.html` - legacy optimizer compatibility entry that redirects to `/`
- `/accounts.html` - account creation, switching, rename, and deletion
- `/maintenance.html` - static catalog maintenance. Enabled by default during
  local development and disabled by default when `NODE_ENV=production`.

## Local Runtime Data

User-owned data is stored in browser-local IndexedDB: accounts, current account,
Drive Disc inventory, import history, and loadouts. In production, one user's
uploads, edits, deletes, and account switches stay in that user's browser and do
not write to a shared server inventory.

The legacy `data/user_drive_discs.json` file remains ignored by Git for backend
history tests and local migration reference. Public pages no longer read or
write it through server user-data APIs.

Use `data/user_drive_discs.example.json` as the documented empty-store shape.
Scanner exports copied into `imports/` or `data/imports/` are also ignored.

The public static data under `data/`, frontend assets, examples, docs, and tests
should stay committed so other users can clone the repository and run it
normally.

## Production

The public site is intended to run on GitHub Pages so `zzzcaculator.top` no
longer needs to point at a mainland China ECS instance and does not require ICP
filing.

Build the static Pages artifact with:

```bash
npm run build:pages
```

The artifact is written to `dist/pages` and includes the app pages, static JSON
catalog/config files, `CNAME`, and the OCR manifest. GitHub Actions runs the
same command from `main` and deploys the Pages artifact; do not commit
`dist/pages`.

Publish Helper and OCR packages through GitHub Releases instead of Git:

- tag: `scanner-1.0.36`
- `ZZZ-Scanner-Helper.exe`
- `ZZZ-Scanner.Next-win-x64.zip`

After DNS is switched, GitHub Pages should serve `zzzcaculator.top`, with
`www.zzzcaculator.top` as a compatibility entry. DNS records should point to
GitHub Pages rather than the old ECS public IP.

The Node server deployment path remains available for local or self-hosted
production use.

Set production services with:

```bash
NODE_ENV=production
```

The server then reports `maintenanceEnabled: false` and blocks
`/maintenance.html`, `/maintenance.js`, and `/api/maintenance/*`. Set
`MAINTENANCE_ENABLED=true|false` only when you intentionally need an explicit
override.

## Tests

Run focused Node test scripts with npm:

```bash
npm run test:atk-basis
npm run test:percent-sanity
npm run test:maintenance-validation
npm run test:formula
npm run test:damage-whitebox
npm run test:shared-combat
npm run test:w-engine-modification
npm run test:anomaly-damage
npm run test:maintenance-stats
npm run test:compiled-score
npm run test:compiled-panel-score
npm run test:optimizer
npm run test:optimizer-progress
npm run test:optimizer-api
npm run test:optimizer-ui
npm run test:optimizer-fuzz
npm run test:drive-disc-analysis
npm run test:drive-disc-import
npm run test:accounts
```

Run the optimizer benchmark helper when comparing exact optimizer strategies:

```bash
npm run benchmark:optimizer
```

Useful syntax checks:

```bash
node --check backend/calculator.js
node --check backend/driveDiscAnalysis.js
node --check backend/driveDiscOptimizer.js
node --check backend/server.js
node --check frontend/app.js
node --check frontend/calculate.js
node --check frontend/dialogs.js
node --check frontend/drive-disc-analysis.js
node --check frontend/drive-discs.js
node --check frontend/entity-select.js
node --check frontend/maintenance.js
node --check frontend/accounts-page.js
```

## API Overview

- `GET /api/health`
- `GET /api/app-config`
- `GET /api/meta`
- `GET /api/maintenance/catalog` (defaults to `403` in production)
- `POST|PUT|DELETE /api/maintenance/:resource` (defaults to `403` in production)
- `DELETE /api/maintenance/anomaly-effects/:type/:id` (defaults to `403` in production)
- `GET /api/example/out-of-combat`
- `GET /api/example/ye-shunguang`
- `POST /api/calculate/out-of-combat`
- `POST /api/calculate/in-combat`
- `POST /api/optimize/drive-discs/preview`
- `POST /api/optimize/drive-discs/jobs`
- `GET|DELETE /api/optimize/drive-discs/jobs/:id`
- `POST /api/optimize/drive-discs`
- `POST /api/analysis/drive-disc-substats`
- `POST /api/analysis/drive-disc-stat-gains`

The legacy user-data APIs now return `410 Gone` because user data is stored in
the browser:

- `/api/accounts*`
- `/api/user-drive-discs*`
- `/api/user-drive-disc-loadouts*`

## Modeling Notes

- Base ATK is `agent Base ATK + W-Engine Base ATK + Core Skill Base ATK`.
- Out-of-combat stats are the stable base for later conditional in-combat
  buffs.
- In-combat buffs can contribute plain stats, runtime-scaled effects, damage
  modifiers, W-Engine team buffs, and skill-targeted effects.
- Target configuration supports defense, level coefficient, per-element
  resistance, and an optional stun multiplier.
- Optimizer damage targets can use one direct, sheer, anomaly, or disorder event
  or a custom list of weighted damage events.
- Special display attributes can declare a real `damageElement`; for example,
  Ye Shunguang is displayed as Honed Edge but calculates physical damage.
- Rupture/Xuanmo damage is modeled as sheer damage: sheer force derives from
  in-combat HP, in-combat ATK, and flat sheer force, then uses sheer-specific
  damage bonuses and skips defense/PEN multipliers.
- Anomaly and disorder damage use catalog-backed multipliers from the unified
  `data/anomaly_effects.json` `effects` list, split by `settlementType`.
- Attribute anomaly and disorder damage use separate bonus zones:
  `anomalyDamageBonus` applies to attribute anomaly, while
  `disorderDamageBonus` applies to disorder.
- W-Engine modification ranks materialize explicit per-rank buff values without
  changing level 60 Base ATK or advanced stats.

For deeper implementation detail, see [docs/modeling.md](docs/modeling.md) and
[docs/changelog.md](docs/changelog.md).

## Maintenance Rule

All Zenless Zone Zero calculator data models, examples, frontend code, backend
code, and future calculator implementation should live inside this repository
unless a later integration step explicitly moves them elsewhere.
