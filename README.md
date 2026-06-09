# ZZZ Calculator

Zenless Zone Zero Drive Disc, panel, damage, and optimizer workspace. The app is
a small dependency-free Node.js backend with static browser pages for account
management, inventory maintenance, out-of-combat and in-combat panel
calculation, damage inspection, and Drive Disc optimization.

Chinese documentation is available in [README.zh-CN.md](README.zh-CN.md).

## Upload Update Summaries

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
- ZZZ Scanner Drive Disc import, manual inventory editing, duplicate handling,
  account-scoped storage, and optional remove-missing synchronization.
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
    calculate.html
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

Main pages:

- `/` - homepage calculator, panel view, combat buffs, and damage white box
- `/drive-discs.html` - Drive Disc inventory and loadout management
- `/calculate.html` - Drive Disc optimizer workspace
- `/accounts.html` - account creation, switching, rename, and deletion
- `/maintenance.html` - static catalog maintenance

## Local Runtime Data

`data/user_drive_discs.json` is intentionally ignored by Git because it stores
local player inventory, imports, account records, loadouts, and current account
selection. A fresh clone can run without this file: the backend uses an empty
store when it is missing, then creates the local file after importing or
editing Drive Discs.

Use `data/user_drive_discs.example.json` as the documented empty-store shape.
Scanner exports copied into `imports/` or `data/imports/` are also ignored.

The public static data under `data/`, frontend assets, examples, docs, and tests
should stay committed so other users can clone the repository and run it
normally.

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
- `GET /api/meta`
- `GET /api/accounts`
- `POST /api/accounts`
- `POST /api/accounts/current`
- `PUT|DELETE /api/accounts/:id`
- `GET /api/maintenance/catalog`
- `POST|PUT|DELETE /api/maintenance/:resource`
- `DELETE /api/maintenance/anomaly-effects/:type/:id`
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
- `GET|DELETE /api/user-drive-discs`
- `POST /api/user-drive-discs/import/zzz-scanner`
- `POST /api/user-drive-discs`
- `PUT|DELETE /api/user-drive-discs/:id`
- `GET|POST /api/user-drive-disc-loadouts`
- `PUT|DELETE /api/user-drive-disc-loadouts/:id`

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
