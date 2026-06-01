# ZZZ Calculator

Zenless Zone Zero Drive Disc, panel, damage, and optimizer workspace. The app is
a small dependency-free Node.js backend with static browser pages for account
management, inventory maintenance, out-of-combat and in-combat panel
calculation, damage inspection, and Drive Disc optimization.

Chinese documentation is available in [README.zh-CN.md](README.zh-CN.md).

## Upload Update Summaries

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
  level, anomaly damage bonus, anomaly crit, and final damage.
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
- Damage preview for direct, anomaly, and disorder events, with inspectable
  white-box formula rows.
- ZZZ Scanner Drive Disc import, manual inventory editing, duplicate handling,
  account-scoped storage, and optional remove-missing synchronization.
- Saved Drive Disc loadouts that can be applied on the homepage or created from
  optimizer results.
- Drive Disc optimizer with calculation target presets, preview, background job
  progress, cancelation, set-shape constraints, multiple optional 2-piece set
  choices, main-stat constraints, minimum stat filters, exact/fast algorithm
  choices, and damage scoring.
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
    driveDiscInventory.js
    driveDiscOptimizer.js
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
    drive-discs.js
    accounts.js
    accounts-page.js
    maintenance.js
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
npm run test:optimizer
npm run test:optimizer-progress
npm run test:optimizer-api
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
node --check backend/server.js
node --check frontend/app.js
node --check frontend/calculate.js
node --check frontend/drive-discs.js
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
- Optimizer damage targets can use one direct/anomaly event or a custom list of
  weighted direct, anomaly, and disorder events.
- Special display attributes can declare a real `damageElement`; for example,
  Ye Shunguang is displayed as Honed Edge but calculates physical damage.
- Anomaly and disorder damage use catalog-backed multipliers from the unified
  `data/anomaly_effects.json` `effects` list, split by `settlementType`.
- W-Engine modification ranks materialize buff values without changing level 60
  Base ATK or advanced stats.

For deeper implementation detail, see [docs/modeling.md](docs/modeling.md) and
[docs/changelog.md](docs/changelog.md).

## Maintenance Rule

All Zenless Zone Zero calculator data models, examples, frontend code, backend
code, and future calculator implementation should live inside this repository
unless a later integration step explicitly moves them elsewhere.
