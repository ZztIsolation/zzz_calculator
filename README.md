# ZZZ Calculator

ZZZ Calculator is a Vue 3 application for Zenless Zone Zero character panels, damage modeling, Drive Disc inventory, local optimization, accounts, and scanner imports. Shared game logic lives in a platform-neutral core and is reused by the browser and the Node.js service.

中文说明见 [README.zh-CN.md](README.zh-CN.md).

## Upload Update Summaries

The entries below summarize each development day. Implementation details,
modeling decisions, and verification evidence remain in the
[detailed changelog](docs/changelog.md).

### 2026-07-19 Server And CDN Origin Migration

- Made `121.199.21.10` the documented production host and retained the existing
  atomic `/opt/zzz_calculator/releases/<release>` plus `current` deployment
  layout.
- Moved Helper and Scanner release payloads outside application releases into
  `/srv/zzz-download-origin`, where Nginx serves immutable versioned binaries
  with HTTP Range support and short-lived manifests separately.
- Changed Helper and Scanner download priority to
  `download.zzzcaculator.top`, followed by the main server and finally GitHub
  Release as a disaster-recovery fallback.
- Added a reproducible server release package command and checked-in Nginx and
  systemd production templates. GitHub Pages deployment is now manual fallback
  infrastructure and no longer claims the production custom domain.

### 2026-07-19 Daily Update

- Added drag-and-drop plus precise up/down ordering for each teammate's
  maintenance Buff list. The complete order is saved atomically and reused by
  the player Buff picker; Qianxia now shows Core Passive, Additional Ability,
  EX Special, then Cinema 1/2/4.
- Added explicit Dash Attack, EX Special, and Assist Attack move tags, including
  targeted two-piece Drive Disc effects across calculation and optimization.
- Modeled Dawn Blossom's two-piece bonus and nine requested four-piece sets,
  with independent uptime/stacks, specialty requirements, and team-effect
  exclusivity.
- Removed the optimizer's automatic ATK, Anomaly Proficiency, CRIT Rate, and
  CRIT DMG minimums. Existing untouched defaults migrate to unrestricted
  searches, while deliberate user-entered limits remain available.
- Added `/settings` with separate controls for browser-owned calculator data
  and storage used by the hosted scan integration.
- Clarified the Drive Disc toolbar as single-item add, batch import/export,
  refresh, and Scan, with Scan as the only primary action.

### 2026-07-18 Daily Update

- Added teammate attribute/specialty filtering and completed team-applicable
  Jane Doe Buffs plus Ye Shunguang Cinema 4/6 rules and the Cinema-6 loop.
- Made Anomaly and Disorder timing effect-specific, moved stun state to each
  event, and exposed live skill, Anomaly, and Disorder event multipliers.
- Unified Alice's Disorder stack model and fixed the systemic loss of Anomaly
  Mastery percentages across panels, damage calculation, and optimization.
- Added account-scoped Drive Disc JSON export and reimport without exposing
  account ownership or derived fingerprints.
- Simplified player custom-Buff choices while retaining full maintenance
  controls, and added container-aware layout regression protection.

### 2026-07-17 Daily Update

- Completed Alice Thymefield's damage, Buff, Cinema, default-loop, panel, and
  optimizer modeling, including Anomaly Mastery slot-6 support.
- Added first-class all-attribute RES ignore as a stat distinct from resistance
  reduction and compatible with existing element-specific RES ignore.

### 2026-07-16 Daily Update

- Added versioned Boss archives and moved Boss encounter Buff selection into
  the unified picker without coupling it to target defense or resistance.
- Added the 3.0 Critical Assault phase-3 field Buffs and independent refinement
  selection for teammate-carried W-Engines.
- Replaced shared Buff coverage with independent per-effect `0-1` overrides
  while preserving administrator-authored defaults.
- Fixed maintenance saves for four-piece Drive Disc skill targets and retained
  backward-compatible cleanup of legacy coverage and Boss payloads.

### 2026-07-15 Daily Update

- Removed generic effect `appliesTo` filters in favor of explicit global,
  Anomaly, move, and skill-type targets.
- Hardened canonical skill types and clarified the separate damage-bonus and
  skill-multiplier zones across maintenance, calculation, and optimization.

### 2026-07-14 Daily Update

- Rebuilt administrator default loops as a cinema-tabbed master-detail modal
  and replaced skill-ID prefix targeting with structured skill targets.
- Expanded the strict optimizer contract from Top 5 to fixed Top 10 and replaced
  the result dropdown with an immediate rank selector.
- Restored maintenance visibility controls in the Vue workbench while keeping
  hidden records compatible with existing saved builds.

### 2026-07-13 Daily Update

- Accelerated strict-exact Drive Disc optimization with result-preserving
  pruning, specialized scoring paths, benchmarks, and parity checks.
- Rebuilt Vue maintenance as a structured administrator workspace with
  resource-specific forms, generated IDs, readable references, and save previews.

### 2026-07-12 Daily Update

- Archived the Vue rewrite before cleanup, then retired the legacy frontend and
  consolidated browser and Node execution around the shared core and Vue app.
- Removed obsolete duplicate runtime code and generated artifacts while
  preserving public catalogs, source assets, storage compatibility, and tests.

### 2026-07-02 Drive Disc Modal Workflow Update

This update improves the calculator's optimizer and Drive Disc workflows:

- The Drive Disc analysis modal now starts from the role-aware difference view,
  while keeping the current substat and gain-curve views available.
- Combat Buff, two-piece/four-piece optimizer filters, calculation config,
  Drive Disc edit, and loadout edit modals now use explicit cancel/apply or
  cancel/save footers, so tentative edits do not immediately mutate the active
  build.
- Stacked W-Engine effects can share one runtime stack control through
  `stackGroup`; Qingming Cage now keeps its two "Qingming Companion" effects in
  sync.

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

### 2026-06-30 GitHub Pages Deployment

This update moves the public calculator to GitHub Pages deployment:

- Added `npm run build:pages` to generate a `dist/pages` static site with
  `static/catalog.json`, `static/app-config.json`, and `CNAME`.
- Frontend catalog/config loading now prefers static JSON while keeping the
  local Node server APIs as development fallbacks.
- Added a GitHub Actions Pages workflow that publishes the Pages artifact
  without committing `dist/pages` or large `downloads/` files.

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

## Architecture

```text
core/                    shared calculations, validation, inventory rules, and optimizer engine
webapp/                  Vue 3 + Pinia + Vite application
  src/runtime/           browser catalog, storage, scanner, and optimizer adapters
  public/assets/         application images and other public assets
backend/                 Node.js APIs, file adapters, and built-app hosting
data/                    game catalogs and public configuration
examples/                stable calculation fixtures
scripts/                 server, Pages fallback, and release build helpers
deploy/                  checked-in Nginx and systemd production templates
tests/                   Node and cross-runtime regression tests
benchmarks/              opt-in performance benchmarks
docs/                    modeling notes, regression contract, and changelog
```

The browser owns user accounts, Drive Discs, import history, and loadouts through the existing IndexedDB/localStorage schema. Heavy optimization runs in one dedicated browser Worker on the public site, keeping the page responsive without creating a nested Worker pool. The Node adapter keeps worker-thread support for local and self-hosted use.

When no extra two-piece set is selected, the optimizer automatically searches complete 4+2 combinations across every available non-four-piece set plus six pieces of the selected four-piece set. Incomplete 4+1+1 and 5+1 layouts are not considered.

The optimizer can optionally enforce minimum ATK, Anomaly Proficiency, CRIT Rate, and CRIT DMG. All four constraints use the out-of-combat character panel and exclude in-combat Buffs. They are unrestricted by default, with step buttons of 50, 10, 10, and 10 respectively. Inputs may be any non-negative integer and do not need to be multiples of the step.

## Requirements And Installation

- Node.js 20
- npm

Install the Vue workspace exactly from its lock file:

```bash
npm run install:webapp
```

The root project intentionally has no third-party runtime dependencies.

## Run Locally

Build the Vue application and start the Node service:

```bash
npm start
```

The default address is `http://127.0.0.1:8787`. To serve an existing Vue build without rebuilding it, use:

```bash
npm run serve
```

For frontend-only development with hot reload:

```bash
npm run dev:webapp
```

Set `PORT` to change the Node port. The service binds to `127.0.0.1` by default; container or network exposure requires an explicit `HOST` such as `0.0.0.0`. Maintenance is disabled in production unless `MAINTENANCE_ENABLED=true` is set explicitly. Maintenance writes accept loopback browser origins by default; every non-loopback origin must be listed explicitly in the comma-separated `MAINTENANCE_ALLOWED_ORIGINS` setting.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Workbench: character setup, damage configuration, Buffs, Drive Disc schemes, and optimizer |
| `/discs` | Drive Disc inventory, account-scoped JSON import/export, loadouts, and scanner flow |
| `/accounts` | Local account creation, switching, rename, and deletion |
| `/maintenance` | Structured Vue editor for all eight maintenance resources, available only when maintenance is enabled |

`/calculate.html`, `/drive-discs.html`, and `/accounts.html` remain compatibility redirects. When maintenance is enabled, `/maintenance.html` redirects to `/maintenance`; when disabled, both maintenance page routes return 404 and maintenance APIs return 403.

The workbench event manager shows each skill, Anomaly, and Disorder event's current multiplier in both the target list and the active-event details. Skill values follow the selected current skill level; Anomaly values include proc count; and Disorder values update immediately from the source effect, Disorder type, and elapsed time. The displayed value includes any stored event scale but does not multiply the separate event count or fold in CRIT, damage bonus, defense, and other final-damage zones. The player-facing event-scale input is hidden to avoid confusing it with a skill multiplier, while structured maintenance and existing saved events retain the field and its calculation behavior. Disorder elapsed time is snapped to the source effect's tick interval and is no longer pre-clamped to the catalog base duration when saved. The catalog preview still shows the base-duration multiplier; final damage clamps elapsed time to the base duration plus active Buff extensions, then recomputes remaining time, ticks, and multiplier.

In the workbench Buff picker, every selected teammate-carried W-Engine has its own refinement selector using that W-Engine's supported range. Changing the level refreshes the Buff preview immediately, while only Apply commits the draft and Cancel leaves the saved build unchanged. The chosen refinement appears in the enabled-Buff summary and feeds the same calculation input used by both the workbench and the Drive Disc optimizer.

All-attribute resistance ignore is modeled as the first-class `allResIgnore` effect instead of six duplicated element rules or a resistance-reduction alias. It remains semantically distinct from enemy resistance reduction, stacks with the matching element-specific resistance-ignore stat, and is available in both maintenance forms and workbench custom Buffs for global or skill-targeted effects. Existing element-specific resistance-ignore fields remain supported.

Ye Shunguang now includes her official Cinema 4 and Cinema 6 mechanics. Ether Veil: Judgment captures the configured stun multiplier even for events authored as not stunned, caps the vulnerability bonus at 110% normally, and raises that cap to 200% at Cinema 4 without treating the difference as a flat damage bonus. Cinema 6 adds the stated 1500% ATK final-hit multiplier only to Return to Dust and Cut Delusion, Open Heaven. Its administrator default keeps the existing twelve-transformation window and resolves to twelve Cinema-2 short axes, two paid Chase Cloud Ultimates, six Cut Delusion finishers, and six Return to Dust finishers.

Jane Doe is available as a teammate Buff group containing only team-applicable Core Passive F, Cinema 2, and Cinema 4 effects. Her Core extends Flinch by five seconds, raising full-duration Flinch Disorder from `525%` to `450% + 15 x 7.5% = 562.5%`; Assault Anomaly CRIT Rate is `clamp(40 + Jane AP x 0.16, 0, 100)%`, with a default 375 AP input that can be lowered, and Anomaly CRIT DMG is 50%. Cinema 2 applies 15% DEF ignore and another 50% Anomaly CRIT DMG to Assault only. Cinema 4 adds 18% Attribute Anomaly DMG without entering the Disorder bonus zone. Selecting a Buff means its trigger condition is satisfied; no uptime timeline is simulated.

The workbench custom Buff editor uses a simplified player-facing whitelist. It keeps the six element damage bonuses separate, but replaces element-specific Sheer DMG, CRIT DMG, DEF ignore, resistance reduction, and resistance ignore choices with their generic or current-attribute forms; the Anomaly Mastery-above-140 conversion is maintenance-only. The structured maintenance forms still expose every explicit element field, and existing custom Buff records using hidden choices remain readable and fully calculated.

Alice Thymefield is fully available with her official core passive, additional ability, and Cinema 1/2/4/6 rules. Her in-combat Anomaly Mastery above 140 converts to Anomaly Proficiency at 1.6 per point; physical Disorder receives 18% multiplier per remaining second up to 180%; Polarized Assault uses 100% of normal Assault; the recurring core follow-up uses an explicit 2.5% event scale; and Cinema 6 uses 3300% Anomaly Proficiency as its damage basis with forced CRIT. Her administrator defaults cover a full-duration physical-anomaly window at Cinema 0, the additional Ultimate-triggered Polarized Assault at Cinema 2, and six winning-state follow-ups at Cinema 6. Slot 6 optimization compares both Anomaly Mastery and ATK%.

Anomaly Mastery percentage and flat-point bonuses use separate calculation buckets. The agent base and Core Skill white-stat additions are combined before out-of-combat percentages from Drive Discs, 2-piece sets, and W-Engine advanced stats are applied; in-combat percentages scale the current out-of-combat panel, and in-combat flat points are added last. Phaethon's Melody now contributes its 8% Anomaly Mastery 2-piece effect. With Core Skill F, a 30% Anomaly Mastery slot 6, and that 2-piece effect, Alice retains the exact internal value `142 * 1.38 = 195.96`, displayed as `195`. Her Additional Ability alone consumes game-rounded values: it floors current in-combat Anomaly Mastery before the 140-point threshold and floors the converted Anomaly Proficiency afterward. With Modification Level 1 Tenfold Starforge, `255.96` Mastery therefore converts as `floor((floor(255.96) - 140) * 1.6) = 184`; damage, browser calculation, and optimization all use the resulting integer conversion.

The maintenance UI keeps the legacy top-tab, record-list, and resource-specific form workflow while using Vue and Naive UI controls. It never asks administrators to enter internal IDs. Effect targets distinguish global effects, structured Anomaly targets, specific moves, and general skill types. An Anomaly target selects Attribute Anomaly or Disorder plus concrete effects; new data never stores legacy `appliesTo`, and the player custom-Buff editor does not expose raw duration extension without this target selector. New records and their nested skill rows, effects, modifiers, and calculation events receive generated identifiers; cross-record references use searchable labels and skill-target effects provide a complete catalog/category/move/row cascade. Skill targets use a stable two-row layout with full readable move-series ranges, while long tables and the editor scroll independently. Image provenance and multiple data sources remain separate. Shared stack arrays, default-calculation target events, W-Engine modification previews, and W-Engine/Drive Disc conditions, durations, effect text, coverage, and modifiers are all edited through readable controls. Administrator default loops appear as a compact role-form summary and open in a dedicated cinema-tabbed modal with a target-event list on the left and one active event editor on the right. Cancelling the modal leaves the role draft untouched; a new cinema variant copies the active loop with regenerated event IDs, and cinema zero remains the required base. Every damage or skill-group event has an administrator-authored stunned state; administrator defaults are read-only in the workbench, while non-administrator modes can switch each event independently. Skill-group counts are system-managed as `1 / 0 / 100 / 1` (default/min/max/step). Each in-combat effect rule has its own administrator coverage switch and editable default percentage; enabled rules keep system-managed `0 / 1 / 0.1` min/max/step metadata, and only those rules expose a `0-1` decimal player override in the Buff picker and optimizer. Teammate Buffs are edited as role groups with a secondary Buff list and a single active Buff editor. That secondary list supports drag ordering and accessible up/down controls; its complete order is committed with the selected Buff in one maintenance save, and the player picker consumes the same stored array order. The read-only save preview masks internal identities and technical condition values while showing coverage defaults as percentages.

Teammate Buff groups carry required role-level attribute and specialty metadata. The picker exposes dynamic multi-select filters for both dimensions: values within one filter use OR, the two dimensions use AND, and both combine with text search. Maintenance shows and searches the localized role labels, while bulk add/remove affects only the filtered visible Buffs.

Boss data uses a separate `data/bosses.json` archive. Stable profile fields (name, aliases, local image, defense, weaknesses, and resistances) own multiple versioned encounters containing enemy intel, player buffs/debuffs, appearances, and sources. An unchanged returning encounter adds an appearance; changed rules create a new encounter. Modeled entries reuse normal effect rules, while unsupported effects remain visible as `descriptiveOnly` and never enter calculation. The unified Buff picker filters Boss Buffs by version, phase, and Boss name, allows at most one Boss Buff globally, and keeps field Buffs independent. The enemy-target panel only owns the 1588, 476, 953, and Custom defense presets plus the current damage-element resistance and initial stun multiplier; whether damage occurs during stun is configured per calculation event. Selecting a Boss Buff never changes target defense or resistance. Legacy Specific Boss saves migrate their encounter into Buff selection and reset the target to 953 defense with zero resistance.

## Local Data

Accounts, Drive Discs, loadouts, and calculation settings remain in the browser and scoped to the current account. Existing installations keep the same IndexedDB and localStorage keys; no destructive migration is required. The public server accepts a privacy-limited scan diagnostic summary by default: a random anonymous identifier, scan versions and options, duration, counters, error codes, and structured visual acceptance gates. It never contains Drive Disc contents, account labels, screenshots, local paths, full logs, or exception stacks. Users can disable collection at `/settings`, and server records expire after 30 days.

The manual Drive Disc editor is limited to S-rank discs and generates internal IDs automatically. Its four fixed substat rows use the ten legal in-game choices, distinguish flat and percentage HP/ATK/DEF, and accept one to six rolls; the UI converts those rolls back into the existing `{ stat, value }` storage shape. Imported non-S discs and hidden equipped-agent metadata remain unchanged.

The Drive Disc inventory can export every disc in the current account to a versioned `zzz-calculator-drive-disc-export` JSON file. Export runs entirely in the browser, ignores active table filters, excludes other accounts and loadouts, and removes account ownership plus derived fingerprints from each record. The same import preview accepts this native format alongside ZZZ Scanner JSON, recomputes fingerprints, and assigns every imported disc to the account that is current at import time. Imports merge by default; the existing explicit “remove missing” option is required for mirror-style deletion.

The local file `data/user_drive_discs.json`, scanner exports under `imports/` or `data/imports/`, build output, logs, downloads, and Playwright artifacts are ignored by Git. Public catalogs, including `data/bosses.json` and local Boss WebP assets, examples, source assets, and tests remain versioned.

## Tests And Builds

Run the complete regression suite after installing webapp dependencies:

```bash
npm test
```

Useful focused commands:

```bash
npm run test:webapp
npm run test:layout
npm --prefix webapp run build
npm run build:server
npm run build:pages
npm run benchmark:optimizer
```

`npm test` covers the Node calculation model, optimizer fixtures/progress/API/fuzz behavior, storage compatibility, scanner bridge, production server behavior, and the Vue test suite. `npm run test:layout` builds the app and uses Chromium to reject clipped labels, overflowing controls, and unintended horizontal scrolling across desktop, scaled-desktop, and mobile layouts. CI uses Node 20 and runs both suites for every branch and pull request.

## Production Server Deployment

The production application runs on `121.199.21.10`. Application releases and
download payloads deliberately use separate lifecycles:

```text
/opt/zzz_calculator/
  releases/<release>/             immutable application release
  current -> releases/<release>/  active atomic symlink

/srv/zzz-download-origin/
  downloads/
    zzz-scanner/
      manifest.json
      helper-manifest.json
      helper/1.2.1/ZZZ-Scanner-Helper.exe
      1.0.39/ZZZ-Scanner.Next-win-x64-fdd.zip
      1.0.39/ZZZ-Scanner.Next-win-x64-self-contained.zip
```

Build a deployable archive containing the tracked source and the generated Vue
application with:

```bash
npm run build:server
```

The archive is written to `output/zzz-calculator-server-<commit>.tar.gz`. It
does not contain the ignored `downloads/` workspace. Nginx serves
`/downloads/` directly from `/srv/zzz-download-origin`, so large downloads do
not pass through Node and support CDN Range requests. The two manifest files
use `no-cache`; versioned `.exe` and `.zip` files use one-year immutable cache
headers. The reference production files are
`deploy/nginx/zzz-calculator.conf` and
`deploy/systemd/zzz-calculator.service`.

Before enabling the internal diagnostics page, create the Basic Auth file on the server without adding it to the repository:

```bash
sudo htpasswd -c /etc/nginx/zzz-calculator-scan-admin.htpasswd <admin-name>
sudo nginx -t
sudo systemctl reload nginx
```

systemd uses `StateDirectory=zzz-calculator` for `/var/lib/zzz-calculator`. Scan diagnostics are written by UTC date under `telemetry/scan-events-YYYY-MM-DD.ndjson`, closed days are gzip-compressed, and files expire after 30 days. The protected internal entry point is `/internal/scans`.

The public site remains `https://zzzcaculator.top`, preserving the browser
origin and existing IndexedDB/localStorage data. The public download endpoint
is `https://download.zzzcaculator.top`; Tencent CDN should use
`https://zzzcaculator.top` as its HTTPS origin and send the same origin Host.
The CDN origin and acceleration domain must remain different.

## Legacy GitHub Pages Fallback

Build the static deployment artifact with:

```bash
npm run build:pages
```

The output is written to `dist/pages` and is never committed. It contains the
SPA, static catalog/config payloads, Scanner manifests, and both verified
Scanner packages when available. It deliberately omits `CNAME` so a fallback
deployment cannot reclaim the production domain. `.github/workflows/pages.yml`
is manual-only; a push to `main` no longer deploys Pages automatically.

## Scanner Integration

The Drive Disc scanner flow uses a small local Helper registered for the `zzz-scanner://` protocol. The Helper communicates with the page at `127.0.0.1:22355`, reads `/downloads/zzz-scanner/manifest.json`, and prepares ZZZ Scanner Next.

The current supported OCR runtime is ZZZ Scanner Next `1.0.39`, with Helper `1.2.1` or newer. Supported systems are Windows 10 1809 (Build 17763) or newer x64 and Windows 11 x64, including N and LTSC editions. x86, ARM64, and Windows 7 are outside the current support commitment. Version 1.0.39 reports structured timeout diagnostics including ROI completeness, the final acceptance gate, stable frames, window size, DPI, capture backend, and visual profile. These fields may enter the privacy-limited summary above; screenshots and OCR text remain local.

The schema v3 manifest locks the size, package SHA-256, and every installed file for both framework-dependent and self-contained packages. The Helper selects the smaller package when .NET 8 Desktop Runtime is present; otherwise it automatically uses the self-contained compatibility package without installing .NET or modifying the system. After a verified Scanner handshake, the Helper deletes the package ZIP and every inactive runtime, while retaining the active runtime and the newest successful and failed scan outputs. Structured errors identify environment, disk, download, integrity, extraction, native dependency, port, game-process, elevation, and UAC-cancellation failures and expose appropriate retry, repair, log, or elevation actions.

The public `/settings` page separates browser data from Scanner storage. Browser cleanup deletes the calculator's IndexedDB and local settings only. Scanner cleanup is executed by Helper and removes inactive runtimes, transient packages, stale downloads, and excess outputs without uninstalling the active Scanner. Helper `1.2.1` installs into `%LOCALAPPDATA%\ZZZScannerNext\helper` and supports verified in-place self-updates. Users upgrading from Helper `1.1.x` click **Download and update Helper**, run the downloaded file, and confirm the one-time takeover; the installer safely closes the uniquely verified old Helper, installs the managed copy, and restarts it. Helper `1.2.0` and later update automatically through protocol v3.

The current binaries are unsigned, so SmartScreen, antivirus, or enterprise
policy can block the Helper before it starts; software that has not started
cannot display its own diagnostics. Manifests prefer the Tencent CDN download
domain, retry the main production server, and retain GitHub Release as the final
fallback. Local and Cloud Zenless Zone Zero targets are both supported. Scanner
packages and generated scans are release artifacts or local caches, not normal
source-control content.

## Documentation

- [Modeling notes](docs/modeling.md)
- [Long-term regression contract](docs/regression-contract.md)
- [Frontend layout contract](docs/frontend-layout-contract.md)
- [Detailed changelog](docs/changelog.md)

All calculator models, public data, frontend code, backend code, examples, tests, and release scripts are maintained in this repository.
