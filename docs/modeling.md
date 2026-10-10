# Calculator Modeling

Status: current specification. Checked on 2026-10-08 against commit
`6355fbd310cc5836aff0e78bc3fb46e68a5356f8` (local source, not a production audit).

This document owns shared model semantics. Start character work with the
[authoring guide](character-authoring-guide.md); find acceptance invariants in the
[regression contract](regression-contract.md). The
[earlier model](archive/modeling-before-2026-10-08.md) is historical evidence.

## Scope and architecture

- Agent base panels use authored level-60 data. A damage-event level parameter does
  not replace those base stats with arbitrary-level progression.
- The calculator evaluates selected events and condition snapshots. It supports
  direct, Sheer, Sharp, Attribute Anomaly, Disorder, Release and Turbulence damage,
  reusable skill groups, Cinema and Potential-dependent configurations.
- Luminescence has a separate team-comparison score, not an actual damage event
  that can be added to rotation damage. See its [model](luminescence-modeling.md).
- Energy, Decibels, animation time, resource transitions, anomaly buildup and
  automatic Buff uptime are not simulated. Retain such mechanics in descriptions
  without translating them into unsupported damage effects.
- [core](../core/) owns portable calculation, normalization, validation and search.
  The browser calculates locally and runs heavy optimization in a Worker.
- [browser runtime](../webapp/src/runtime/) adapts catalogs, persistence, imports
  and Scanner communication. [backend](../backend/) serves catalogs/assets,
  local maintenance, Enka proxying and bounded diagnostics. Production does not
  accept inventories for server-side calculation.

## Data ownership

| Data | Authoritative input and consumer |
| --- | --- |
| Agent panels, Core/Cinema/Potential effects, groups and defaults | [agents.json](../data/agents.json), [Core scaling](../core/corePassiveScaling.js), [Potential scaling](../core/potentialVision.js) |
| Skill categories, explicit types/tags, moves and level rows | [agent_skills.json](../data/agent_skills.json), [skill targets](../core/skillTargets.js) |
| W-Engine effects and refinement values | [w_engines.json](../data/w_engines.json) |
| Drive Disc set effects | [drive_disc_sets.json](../data/drive_disc_sets.json) |
| Attribute, Disorder and Turbulence definitions | [anomaly_effects.json](../data/anomaly_effects.json) |
| Teammate and field Buffs | [combat_buffs.json](../data/combat_buffs.json) |
| Stable Boss identity and versioned encounters | [bosses.json](../data/bosses.json) |
| Enka identities/equipment | [mapping snapshot](../data/enka_zzz_mapping.json), [adapter](../core/enka-import/entity-mapping.js) |
| Accounts, inventory and loadouts | Browser IndexedDB `zzz-calculator-user-store` and existing localStorage fallback; [adapter](../webapp/src/runtime/local-store.js) |
| Build/optimizer selections | Browser stores and existing versioned localStorage payloads; [build](../webapp/src/stores/build.ts), [optimizer](../webapp/src/stores/optimizer.ts) |

Local maintenance writes catalog JSON. Saving does not commit a record or update
production. Packaging uses committed tracked files: reconcile intentional catalog
edits, including deletions, before assembling a release. Legacy server inventory
files are not the browser inventory source.

The Node service exposes `/api/catalog` and projected `/api/meta`. The Pages
builder emits static catalog/config from the same data. A stale service or static
build can still show an older catalog; verify the actual consumer.

## Panels and units

1. Build base stats from the agent, matching W-Engine base stat and Core nodes.
   Total Base ATK includes all three; Armorer Base DEF follows the same rule.
   W-Engines declare exactly one positive `atkBase` or `defBase`.
2. Apply unconditional equipment, set and out-of-combat effects. Do not double-count
   Core additions already included in a source's displayed panel.
3. Derive the in-combat panel and event modifiers from selected effects.
   `outOfCombatStat` reads the finished panel automatically; external teammate
   inputs remain independent snapshots.
4. Evaluate candidate-dependent formulas for each candidate panel. Compile an
   expression once where supported, not its value with an absent candidate.
5. Preserve calculation precision. Formatting and important-stat highlights do
   not change values, optimizer weights, sorting or formula semantics.

Catalog values, panel decimals, percentage points and formula units are different
representations. Use stat metadata and the formula `valueUnit`/source-unit contract;
never apply one universal percentage conversion. Core growth comes from structured
scaling rather than parsed description text.

Anomaly Mastery percentage and flat additions occupy separate buckets. Display
rounding does not mean every dependent formula uses a rounded value: Aria's Release
ratio and Cinema 1 conversion have different rounding rules. Consult their
regression clauses before reusing a conversion.

## Effects, sources and targets

Effects retain their ownership: Core Passive, Additional Ability, Cinema,
move-sourced Buff, W-Engine, set, teammate, field or Boss. Move-sourced Buffs use
`combatBuffs.skillBuffs[]` with a valid current-agent move reference, name,
description and explicit default state. They are not a generic container for any
effect mentioning a move.

| Concern | Current rule |
| --- | --- |
| Fixed, stacked, derived and formula rules | Reuse [shared effects](../core/shared-combat.js) and [formula evaluation](../core/effectFormula.js); reference Core/Potential scaling |
| General panel/global effects | Use the default target and correct scope/stat semantics |
| Skill targets | Explicit skill type, legal tags, or character/category/move/row; `ultimate` differs from `chain` even when they share a level table |
| Anomaly targets | Specify settlement; omitted/empty effect whitelist means all effects of that settlement, and canonical saves omit empty whitelists |
| Requirements | Attribute, specialty, exclusions, agent identity and event conditions restrict only their rule |
| Coverage | Per effect rule; catalog/runtime `0..1`, maintenance percentages. Absent coverage means 100% and ignores injected overrides |
| Stacks | Shared controls retain shared identity; `activationStacks` thresholds are not extra unconditional effects |
| Buff modifiers | Modify a referenced rule once; an absent source Buff cannot produce an independent modifier benefit |
| Duration/cooldown | Descriptive or explicit formula parameters, not automatically derived uptime |

Self effects may specify `requirement.minPotentialLevel` / `maxPotentialLevel`.
Potential materialization filters inactive rules before panel/event compilation;
it does not prevent selecting authored moves at P0. Dynamic `valueSource` supports
fixed and stacked rules. For ordinary stacks the resolved value is the per-stack
value; with `activationStacks` it is the fixed activated amount. A P0 compatibility
value of zero is valid when its structured scaling source is present.

`dmgBonus` enters the damage-bonus zone; `skillMultiplierBonus` adds to the selected
skill multiplier. PEN Ratio, DEF Ignore and DEF reduction remain separate.
Evaluate per-hit modifiers before aggregating nonlinear target factors. Descriptions
preserve triggers, scope and level values; calculation reads structured data.

New maintenance data uses explicit targets, not `appliesTo` or move-ID prefixes.
Runtime compatibility remains. Lossless migrations normalize old values;
unsupported filters must produce actionable maintenance errors rather than silently
broaden the effect. Maintenance's supported fields are broader than the player
custom-Buff whitelist.

## Events, groups and defaults

A skill-backed event selects an authored row. This Pyrois Ultimate event contains
the body only, without an implicit Assault Directive:

```json
{
  "kind": "direct",
  "count": 1,
  "stunned": true,
  "critMode": "expected",
  "skillRef": {
    "agentSkillId": "pyrois",
    "categoryId": "chain",
    "moveId": "ultimate_total_annihilation",
    "rowId": "damage"
  }
}
```

- Current build skill levels are final levels; do not apply Cinema level additions
  twice. They override stale event level snapshots.
- `stunned` belongs to each event and defaults to true when absent. Group reference
  state propagates to children; target configuration has no global stun switch.
- A generated total is one stored/UI event but expands source rows for hit-sensitive
  nonlinear effects. Aggregate multiplier additions count once, not once per child.
  See [Sigrid tests](../tests/sigrid-damage.test.js).
- Group names describe actual children. Group repetition has no maximum; real row
  limits validate each group's child before repeated groups are aggregated.
- `defaultCalculationConfig` is authored content, not a simulation. Cinema resolution
  selects the highest configured threshold not above the selected level; matching
  Potential variants resolve before Cinema variants.
- Every authored move/group remains selectable at P0. Potential controls numerical
  scaling; P0 does not receive P2-P6 Buff values.
- Workbench loads administrator configurations as runtime `adminDefault`; user
  custom configurations retain separate persistence semantics.
- Optional `defaultTeammates` applies only when a character has no saved teammate
  picker or explicit Buff selection. It selects the two authored teammates and
  their Buffs up to the authored Cinema levels. Saved empty selections are also
  authoritative. Defaults do not grant teammate equipment or infer uptime.
- Characters may intentionally omit administrator defaults and groups. Vivian's
  profile-aware single Release fallback is such a case, not missing content.

The catalog owns current defaults. Describe exact maintained values only in the
relevant topic or regression clause, instead of duplicating templates. See
[group expansion](../core/calculationSkillGroups.js) and
[default resolution](../core/defaultCalculationConfig.js).

## Damage and score domains

| Domain | Boundary and implementation |
| --- | --- |
| Direct | [Calculator core](../core/calculator-core.js) applies the authored basis and standard factors; attack-type `pierce` metadata does not select Sheer |
| Sheer | Dedicated force-basis semantics, not renamed ordinary ATK damage |
| Sharp | `armorer` / `kind: sharp` select DEF basis and up to two critical trials; [sharpDamage.js](../core/sharpDamage.js) owns the formula. Ordinary CRIT Rate feeds Sharp with its profile cap; ordinary direct/Sheer critical probability caps at 100% |
| Attribute Anomaly | Attribute, anomaly basis, proc count and matching anomaly effects |
| Disorder | Original non-Wind anomaly and remaining-time model; does not inherit all Attribute Anomaly bonuses/critical zones |
| Release | [anomalyRelease.js](../core/anomalyRelease.js) resolves source/trigger ownership and unit-aware expressions without double-counting effects |
| Turbulence | Non-Wind base, explicit elapsed time and the [Wind contract](wind-anomaly-modeling.md), not a Wind character's panel |
| Luminescence | [Separate comparison score](luminescence-modeling.md) and objective |

Sharp white-box output keeps ordinary and Sharp-specific damage bonuses separate.
Ordinary CRIT DMG and laceration damage remain separate stats.

General Release events retain `triggerActorRef` and `anomalySource`. Current sources
follow live build panels; external snapshots stay fixed during optimization.
Calculate each contributor's complete nonlinear anomaly unit before combining
contributions. Representable ownership does not establish a complete cross-agent
build picker or joint A+B optimization.

Aria's player editor constrains the source to her own Corruption. Velina uses
`releaseSource` and omits redundant generalized fields; see the
[Wind topic](wind-anomaly-modeling.md). Fixed Release multipliers replace the anomaly
multiplier basis, rather than blindly multiplying final damage.

## Optimization and persistence

Strict optimization uses the same event semantics as normal calculation. Preserve
Top 10 IDs, stable order and numeric tolerance, not merely the top score. Bounds
need proof and exhaustive small-space checks; unsupported fast paths fall back
safely. Node workers and the browser Worker have separate execution adapters.

Preserve user choices, unknown compatible fields and account boundaries. A failed
read is not an empty store. New catalog defaults must not replace saved custom
configurations. Agent revisions, three-way draft merging and per-agent history
protect maintenance; see [maintenance invariants](regression-contract.md#维护功能).

## API status

[Server routing](../backend/server.js) and the [Vue router](../webapp/src/router.ts)
are the definitive implementation. This is a status map, not a duplicate schema.

| Interface | Status |
| --- | --- |
| `GET /api/health`, `/api/meta`, `/api/catalog`, `/api/app-config` | Normal service/catalog interfaces |
| `/api/enka/zzz/:uid` | Runtime-gated proxy; catalog presence alone does not establish mapping |
| `/api/maintenance/*` | Local/explicitly enabled, origin-guarded; agent writes require revision conditions |
| `/api/calculate/*`, `/api/analysis/*`, `/api/optimize/*` | Development/verification interfaces; production returns 403 |
| `/api/accounts*`, `/api/user-drive-discs*` | Retired user-data APIs return 410; data belongs to browser storage |
| Reservation/exclusion/loadout adapters | Some are development-only exceptions; production rejects retired user-data routes |
| `/internal/scans` and diagnostics | Separately protected operational surface, not an inventory upload channel |

## Sources and verification

Pin official structured revisions. The Claret materializer is a specialized
importer, not a safe way to regenerate maintained characters. Record source
disagreements, supplementary levels and unsupported effects in topic/fixture data.
The [authoring guide](character-authoring-guide.md#阶段一资料核对) owns that workflow.

Formula changes require affected normal/white-box, compiled, dense, fixed-score,
Worker and optimizer checks. UI changes require field/save/reload verification.
Parity alone does not independently prove mechanic correctness. Use the
[regression contract](regression-contract.md) and package scripts for acceptance.

Still outside this model: arbitrary-level base-stat progression, automatic combat
and resource timelines, full-team joint Drive Disc search, and explicitly unmodeled
record effects. Implemented Cinema, conditional equipment, teammate/field Buffs,
imports and mixed damage events are not deferred features.
