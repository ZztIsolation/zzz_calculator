所有修改记录应当极致详细，越详细越好。

# Changelog

This changelog is the long-form maintenance log for `zzz_calculator`. Every
future change to the Zenless Zone Zero calculator should be appended here with
the reason, the files touched, the model impact, and the verification performed.

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
- 效果记录
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
ignoredEffects = ["cloudcleave_radiance.passive"]
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
