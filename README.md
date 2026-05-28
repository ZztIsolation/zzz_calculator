# ZZZ Calculator

Zenless Zone Zero Drive Disc and damage calculator with a small Node backend and
a static frontend. It can manage local Drive Disc inventory, calculate
out-of-combat and in-combat panels, preview/launch Drive Disc optimization, and
maintain the public game data used by the calculator.

## Features

- Agent, W-Engine, Drive Disc set, skill, stat rule, and combat buff catalogs.
- Out-of-combat and in-combat panel calculation APIs.
- Drive Disc inventory import from ZZZ Scanner JSON exports.
- Drive Disc loadout storage and optimizer endpoints.
- Browser pages for the home calculator, inventory, calculation workspace, and
  data maintenance.
- Example payloads and focused Node test scripts for calculator behavior.

## Directory Layout

```text
zzz_calculator/
  README.md
  package.json
  backend/
    server.js
    calculator.js
    driveDiscInventory.js
    driveDiscOptimizer.js
  data/
    agents.json
    agent_skills.json
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
    maintenance.html
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

- `/` - home calculator
- `/drive-discs.html` - Drive Disc inventory
- `/calculate.html` - calculation workspace
- `/maintenance.html` - catalog maintenance

## Local Runtime Data

`data/user_drive_discs.json` is intentionally ignored by Git because it stores
local player inventory, imports, and loadouts. A fresh clone can run without
this file: the backend uses an empty Drive Disc store when it is missing, then
creates the local file after importing or editing Drive Discs.

Use `data/user_drive_discs.example.json` as the documented empty-store shape.
Scanner exports copied into `imports/` or `data/imports/` are also ignored.

The public static data under `data/`, frontend assets, examples, docs, and tests
should stay committed so other users can clone the repository and run it
normally.

## Tests

Run individual focused tests with npm scripts:

```bash
npm run test:atk-basis
npm run test:percent-sanity
npm run test:maintenance-validation
npm run test:formula
npm run test:damage-whitebox
npm run test:optimizer
npm run test:optimizer-progress
npm run test:optimizer-api
```

## API Overview

- `GET /api/health`
- `GET /api/meta`
- `GET /api/maintenance/catalog`
- `POST|PUT|DELETE /api/maintenance/:resource`
- `GET /api/example/out-of-combat`
- `GET /api/example/ye-shunguang`
- `POST /api/calculate/out-of-combat`
- `POST /api/calculate/in-combat`
- `POST /api/optimize/drive-discs/preview`
- `POST /api/optimize/drive-discs`
- `POST /api/optimize/drive-discs/jobs`
- `GET|DELETE /api/optimize/drive-discs/jobs/:id`
- `GET /api/user-drive-discs`
- `POST /api/user-drive-discs/import/zzz-scanner`
- `POST /api/user-drive-discs`
- `PUT|DELETE /api/user-drive-discs/:id`
- `GET|POST /api/user-drive-disc-loadouts`
- `PUT|DELETE /api/user-drive-disc-loadouts/:id`

## Maintenance Rule

All Zenless Zone Zero calculator data models, examples, frontend code, backend
code, and future calculator implementation should live inside this repository
unless a later integration step explicitly moves them elsewhere.
