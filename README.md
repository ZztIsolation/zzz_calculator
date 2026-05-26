# ZZZ Calculator

This directory is the independent maintenance area for the Zenless Zone Zero
Drive Disc calculator.

The project now follows a frontend/backend split:

- `frontend/` renders the calculator UI.
- `backend/` owns data loading, panel calculation, and API responses.
- `data/` keeps the canonical static models.
- `examples/` stores snapshot payloads for verification.

The first milestone is intentionally small: calculate an out-of-combat panel
from a level 60 agent, one W-Engine, six Drive Discs, and unconditional Drive
Disc set effects. It does not modify or depend on the existing Genshin Impact
`mona_*`, `src`, or `src-tauri` modules.

## v1 Goal

- Model level 60 agent base stats.
- Add the W-Engine Base ATK to the agent Base ATK to produce total Base ATK.
- Apply W-Engine advanced stats, Drive Disc main stats, Drive Disc sub-stats,
  and unconditional 2-piece set effects.
- Produce an out-of-combat panel that can be compared with the in-game agent
  equipment panel.
- Keep in-combat buffs, teammate buffs, enemy data, stun, anomaly, disorder,
  and full damage rotations out of v1.

## Directory Layout

```text
zzz_calculator/
  README.md
  package.json
  frontend/
    index.html
    drive-discs.html
    app.js
    drive-discs.js
    styles.css
  backend/
    server.js
    calculator.js
    driveDiscInventory.js
  docs/
    modeling.md
    changelog.md
    goal.md
  data/
    agents.json
    w_engines.json
    drive_disc_sets.json
    stat_rules.json
    user_drive_discs.json
  examples/
    out_of_combat_panel.example.json
    ye_shunguang_panel.example.json
```

## Maintenance Rule

All Zenless Zone Zero calculator data models, examples, and future calculator
implementation should live under this directory unless a later integration step
explicitly moves code into the main frontend or WASM packages.

## Run

```bash
cd zzz_calculator
node backend/server.js
```

Open the printed local URL. The backend serves the frontend and exposes the
calculator API under `/api`.

Useful API endpoints:

- `GET /api/meta`
- `GET /api/example/out-of-combat`
- `GET /api/example/ye-shunguang`
- `POST /api/calculate/out-of-combat`
- `GET /api/user-drive-discs`
- `POST /api/user-drive-discs/import/zzz-scanner`
- `POST /api/user-drive-discs`
- `PUT /api/user-drive-discs/:id`
- `DELETE /api/user-drive-discs/:id`
