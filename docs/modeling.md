# Zenless Zone Zero v1 Modeling

## Scope

v1 models an out-of-combat panel first, then an optional in-combat panel layer:

1. Agent base stats are fixed at level 60. `damage.agentLevel` is modeled only
   for anomaly damage's level zone; it does not yet change base panel stats.
2. Total Base ATK is `agent Base ATK + W-Engine Base ATK + Core Skill Base ATK`.
3. Out-of-combat stats are built from agent base stats, selected Core Skill
   level bonuses, W-Engine advanced stats, Drive Disc main stats, Drive Disc
   sub-stats, and unconditional Drive Disc set effects.
4. Core Skill level defaults to the agent's maximum modeled level.
5. Special attributes can declare a `damageElement` when their damage should
   reuse an existing elemental damage bucket. Ye Shunguang is modeled as
   `attribute: "honed_edge"` and `damageElement: "physical"`.
6. In-combat stats start from `outOfCombat.panel` and then add selected Buffs
   from self, teammate, W-Engine passives, Drive Disc 4-piece effects, boss or
   enemy effects, field effects, and manual corrections.
7. Direct, anomaly, and disorder damage can be modeled as damage events in the
   same in-combat calculator. Stun, anomaly buildup, and rotation logic are
   still out of scope.

## Frontend / Backend Split

The project is organized as a small full-stack app:

- Frontend: collects agent, W-Engine, and Drive Disc input, calls the API, and
  renders the resulting panel.
- Backend: loads the static data files, performs validation, computes the
  out-of-combat panel, and returns the response.
- Data: static model JSON stays under `data/` and is the source of truth for
  both frontend metadata and backend calculations.
- In-combat Buff catalog: `data/combat_buffs.json` stores generic verified
  Buffs. W-Engine passives stay in `data/w_engines.json`, and Drive Disc set
  effects stay in `data/drive_disc_sets.json`.
- Agent skill multipliers: `data/agent_skills.json` stores active skill
  categories, moves, direct damage rows, and per-level multiplier tables.
- User inventory: scanner imports and future manual CRUD data are stored in
  `data/user_drive_discs.json`. This file is deliberately separate from
  canonical static data because it belongs to one user/account rather than the
  game rules.

## Source Notes

The model follows these game-system facts:

- Agents have rank, attribute, specialty, attack type, faction, one W-Engine,
  selected Core Skill level, and six Drive Discs.
- Core Skill enhancements can grant base-stat additions such as Base ATK and
  panel-stat additions such as CRIT Rate.
- W-Engines provide Base ATK, an advanced stat, and a passive effect. The
  passive effect only applies when the equipped agent's specialty matches the
  W-Engine specialty.
- Drive Discs have six partitions. Partitions 1, 2, and 3 have fixed main
  stats; partitions 4, 5, and 6 have constrained main-stat pools.
- Two or four Drive Discs from the same set activate 2-piece and 4-piece set
  effects. There are no 6-piece effects.
- Out-of-combat stats are the frozen base for later conditional in-combat
  bonuses.

Primary references used while drafting this model:

- https://zenless-zone-zero.fandom.com/wiki/Agent
- https://zenless-zone-zero.fandom.com/wiki/W-Engine
- https://zenless-zone-zero.fandom.com/wiki/Drive_Disc
- https://zenless-zone-zero.fandom.com/wiki/Stats

## API Surface

- `GET /api/health`
- `GET /api/meta`
- `GET /api/maintenance/catalog`
- `POST /api/maintenance/agent-skills`
- `GET /api/example/out-of-combat`
- `GET /api/example/ye-shunguang`
- `POST /api/calculate/out-of-combat`
- `POST /api/calculate/in-combat`
- `GET /api/user-drive-discs`
- `POST /api/user-drive-discs/import/zzz-scanner`
- `POST /api/user-drive-discs`
- `PUT /api/user-drive-discs/:id`
- `DELETE /api/user-drive-discs/:id`

## Core Data Shapes

```ts
type ZzzStat =
  | "hpBase" | "atkBase" | "defBase"
  | "hpFlat" | "atkFlat" | "defFlat"
  | "hpPct" | "atkPct" | "defPct"
  | "critRate" | "critDmg"
  | "impact" | "anomalyProficiency" | "anomalyMastery"
  | "penFlat" | "penRatio"
  | "energyRegen"
  | "physicalResIgnore"
  | "physicalDmg" | "fireDmg" | "iceDmg" | "electricDmg" | "etherDmg"
  | "dmgBonus";

interface AgentStaticData {
  id: string;
  name: string;
  rarity: "A" | "S";
  attribute: string;
  damageElement?: "physical" | "fire" | "ice" | "electric" | "ether";
  specialty: string;
  attackTypes: string[];
  faction: string;
  coreSkill?: {
    name?: { zhCN?: string; en?: string };
    defaultLevel: string;
    maxLevel: string;
    levels: Array<{
      level: "A" | "B" | "C" | "D" | "E" | "F" | string;
      label: string;
      stats: Array<{
        stat: ZzzStat;
        value: number;
        mode: "flat" | "pct";
        target: "base" | "panel";
      }>;
      skillLevelBonuses?: Array<{ skill: string; value: number }>;
    }>;
  };
  images?: {
    portrait?: string;
    icon?: string;
    source?: string;
  };
  level60: Record<string, number>;
  combatBuffs?: {
    corePassive?: Effect | null;
    additionalAbility?: Effect | null;
    cinemaBuffs?: AgentCinemaBuff[];
  };
}

interface WEngineStaticData {
  id: string;
  name: string;
  rarity: "B" | "A" | "S";
  specialty: string;
  relatedAgentId?: string;
  images?: {
    icon?: string;
    portrait?: string;
    source?: string;
  };
  level60: {
    atkBase: number;
    advancedStat?: { stat: ZzzStat; value: number };
  };
  effect: {
    name: { zhCN?: string; en?: string };
    requirement?: {
      specialty?: string;
      label?: { zhCN?: string; en?: string };
    };
    description: { zhCN?: string; en?: string };
    buff: Effect;
  };
}

interface DriveDisc {
  id: string;
  setId: string;
  setName?: string;
  partition: 1 | 2 | 3 | 4 | 5 | 6;
  rarity: "B" | "A" | "S";
  level: number;
  mainStat: { stat: ZzzStat; value: number };
  subStats: Array<{ stat: ZzzStat; value: number }>;
}

interface DriveDiscSetStaticData {
  id: string;
  name: {
    en?: string;
    zhCN?: string;
  };
  images?: {
    icon?: string;
    source?: string;
  };
  // 2-piece effects implicitly apply to the out-of-combat panel.
  twoPiece?: Omit<Effect, "scope" | "appliesToOutOfCombatPanel">;
  // 4-piece effects implicitly apply only as in-combat effects.
  fourPiece?: Omit<Effect, "scope" | "appliesToOutOfCombatPanel">;
}

interface DriveDiscInventoryItem {
  id: string;
  ownerId: string;
  setId: string;
  setName: string;
  canonicalSetName?: {
    en?: string;
    zhCN?: string;
  } | null;
  partition: 1 | 2 | 3 | 4 | 5 | 6;
  rarity: "B" | "A" | "S";
  level: number;
  maxLevel: number;
  locked: boolean;
  equippedBy: string | null;
  mainStat: {
    stat: ZzzStat | "unknown";
    value: number;
    mode: "flat" | "pct" | "unknown";
    label: string;
    rawValue: string | number;
  };
  subStats: Array<{
    stat: ZzzStat | "unknown";
    value: number;
    mode: "flat" | "pct" | "unknown";
    label: string;
    rawValue: string | number;
  }>;
  source: {
    type: "zzz-scanner" | "manual";
    sourcePath?: string | null;
    importId?: string;
    importedAt?: string;
    sequence?: number;
    rawIndex?: number;
  };
  raw?: unknown;
}

interface DriveDiscInventoryStore {
  version: 1;
  updatedAt: string | null;
  owners: Array<{ id: string; label: string }>;
  imports: Array<{
    id: string;
    type: "zzz-scanner";
    ownerId: string;
    sourcePath: string | null;
    importedAt: string;
    itemCount: number;
    warnings: string[];
  }>;
  driveDiscs: DriveDiscInventoryItem[];
}

type SkillTarget = {
  agentSkillId: string;
  categoryId: string;
  moveId: string;
  rowId?: string;
};

type EffectTarget =
  | { kind?: "default" }
  | { kind: "skill"; skillTargets: SkillTarget[] };

type BuffRuleStat =
  | ZzzStat
  | "anomalyDamageBonus"
  | "disorderDamageBonus"
  | "baseMultiplierBonus"
  | "anomalyCritRate"
  | "anomalyCritDmg"
  | "skillMultiplierBonus";

interface Effect {
  scope: "outOfCombat" | "inCombat";
  condition: string | null;
  stats?: Array<{
    stat: ZzzStat;
    value: number;
    mode: "flat" | "pct";
    basis?: "baseHp" | "outOfCombatHp" | "baseAtk" | "outOfCombatAtk" | "baseDef" | "outOfCombatDef";
  }>;
  effects?: Array<
    | { type: "fixed"; stat: BuffRuleStat; value: number; mode: "flat" | "pct"; basis?: Effect["stats"][number]["basis"]; target?: EffectTarget }
    | { type: "derived"; stat: BuffRuleStat; mode: "flat" | "pct"; sourceLabel?: { zhCN?: string }; defaultSourceValue: number; ratio: number; cap?: number; target?: EffectTarget }
    | { type: "formula"; stat: BuffRuleStat; mode: "flat" | "pct"; source: { variable: "x"; label?: { zhCN?: string }; defaultValue: number; min?: number; max?: number }; formula: { expression: string; valueUnit?: "storedValue" | "storedPercent" }; target?: EffectTarget }
    | { type: "stacked"; stat: BuffRuleStat; mode: "flat" | "pct"; valuePerStack: number; maxStacks: number; defaultStacks?: number; basis?: Effect["stats"][number]["basis"]; target?: EffectTarget }
    // Deprecated read-only compatibility. New UI/save paths must use target.kind + stat.
    | { type: "damageModifier"; kind: "anomalyDamageBonus" | "disorderDamageBonus" | "baseMultiplierBonus" | "anomalyCritRate" | "anomalyCritDmg" | "directDamageBonus" | "skillMultiplierBonus"; value: number; valueUnit?: "decimal"; appliesTo?: { damageKinds?: Array<"direct" | "anomaly" | "disorder">; anomalyEffects?: string[]; elements?: Array<"physical" | "fire" | "ice" | "electric" | "ether">; skillTargets?: SkillTarget[] } }
  >;
  buffModifiers?: Array<{
    id?: string;
    operation: "multiplyResolvedValue";
    factor: number;
    targetBuffIds: string[];
    targetEffectIds: string[];
    label?: { zhCN?: string; en?: string };
  }>;
}

interface CombatBuff {
  id: string;
  hidden?: boolean;
  sourceType: "self" | "teammate" | "wEngine" | "driveDisc4pc" | "boss" | "field" | "manual";
  teammateId?: string;
  teammateName?: { zhCN?: string; en?: string };
  sourceLabel?: { zhCN?: string; en?: string };
  source?: { zhCN?: string; en?: string };
  sourcePeriod?: { zhCN?: string; en?: string };
  bossName?: { zhCN?: string; en?: string };
  bossSource?: { zhCN?: string; en?: string };
  name: { zhCN?: string; en?: string };
  description?: string | { zhCN?: string; en?: string } | null;
  conditionLabel?: string | { zhCN?: string; en?: string } | null;
  scope: "inCombat";
  stats: Effect["stats"];
}

interface AgentCinemaBuff extends Effect {
  cinemaLevel: 1 | 2 | 3 | 4 | 5 | 6;
  cinemaName: { zhCN?: string; en?: string };
  description: string | { zhCN?: string; en?: string };
  defaultChecked?: false;
}

interface AgentSkillCatalog {
  id: string;
  agentId: string;
  name?: { zhCN?: string; en?: string };
  categories: Array<{
    id: string;
    name: { zhCN?: string; en?: string };
    icon?: string;
    levelRange: { min: number; max: number; default: number };
    moves: Array<{
      id: string;
      name: { zhCN?: string; en?: string };
      damageElement?: "physical" | "fire" | "ice" | "electric" | "ether";
      rows: Array<{
        id: string;
        label: { zhCN?: string; en?: string };
        kind?: "damageMultiplier";
        values: number[]; // 159.8 means 159.8%
      }>;
    }>;
  }>;
  sources?: string[];
}

interface TeammateCombatBuffGroup {
  id: string;
  name: { zhCN?: string; en?: string };
  buffs: Array<{
    id: string;
    source: { zhCN?: string; en?: string };
    description: string | { zhCN?: string; en?: string };
    scope: "inCombat";
    stats: Effect["stats"];
  }>;
}

interface FieldCombatBuff extends Effect {
  id: string;
  sourceType: "field";
  name: { zhCN?: string; en?: string };
  source: { zhCN?: string; en?: string };
  sourcePeriod: { zhCN?: string; en?: string };
  description: { zhCN?: string; en?: string };
  scope: "inCombat";
}

interface BossCombatBuff extends Effect {
  id: string;
  sourceType: "boss";
  bossName: { zhCN?: string; en?: string };
  bossSource: { zhCN?: string; en?: string };
  sourcePeriod: { zhCN?: string; en?: string };
  description: { zhCN?: string; en?: string };
  scope: "inCombat";
}

interface InCombatRequest {
  agentId: string;
  coreSkillLevel?: string;
  wEngineId: string;
  driveDiscs: DriveDisc[];
  combatBuffs?: {
    activeBuffIds?: string[];
    teammateDriveDiscSetIds?: string[];
    manualStats?: Array<{
      id?: string;
      label?: string;
      stat: ZzzStat;
      value: number;
      mode: "flat" | "pct";
      basis?: Effect["stats"][number]["basis"];
    }>;
  };
  damage?: {
    agentLevel?: number; // default 60; only used by anomaly level zone for now.
    target?: {
      presetId?: string;
      defense?: number;
      levelCoefficient?: number;
      resistance?: number; // percent; fallback for all elements.
      resistanceByElement?: Partial<Record<"physical" | "fire" | "ice" | "electric" | "ether", number>>; // percent.
      stunned?: boolean; // default false.
      stunMultiplierPercent?: number; // default 150; only active when stunned is true.
    };
    skillMultiplier?: number;
    skillRef?: {
      agentSkillId: string;
      categoryId: string;
      moveId: string;
      rowId: string;
      level: number;
    };
    selectedEventId?: string;
    events?: Array<
      | { id: string; kind: "direct"; skillMultiplier?: number; skillRef?: InCombatRequest["damage"]["skillRef"]; critMode?: "expected" | "crit" | "nonCrit"; count?: number }
      | { id: string; kind: "sheer"; skillMultiplier?: number; skillRef?: InCombatRequest["damage"]["skillRef"]; critMode?: "expected" | "crit" | "nonCrit"; count?: number }
      | { id: string; kind: "anomaly"; anomalyEffect: "assault" | "shatter" | "burn" | "shock" | "corruption"; procCount?: number; count?: number }
      | { id: string; kind: "disorder"; previousAnomalyEffect: "burn" | "shock" | "corruption" | "frozen" | "flinch"; elapsedSeconds: number; count?: number }
    >;
  };
}

interface InCombatResponse {
  outOfCombat: {
    base: Record<string, number>;
    bonusTotals: Record<string, number>;
    panel: Record<string, number>;
  };
  inCombat: {
    panel: Record<string, number>;
    buffTotals: Record<string, number>;
    activeEffects: Array<{
      key: string;
      sourceType: CombatBuff["sourceType"];
      conditionLabel?: string | null;
      stats: Effect["stats"];
      resolvedStats: Array<Effect["stats"][number] & {
        resolvedStat?: ZzzStat;
        resolvedValue?: number;
      }>;
    }>;
    ignoredEffects: Array<{ key: string; sourceType?: string; reason?: string }>;
    breakdown: {
      flatFromPct: { hp: number; atk: number; def: number };
      atkPanel: {
        outOfCombatAtk: number;
        atkFlat: number;
        baseAtk: number;
        baseAtkPct: number;
        atkFromBasePct: number;
        outOfCombatAtkPct: number;
        atkFromOutOfCombatPct: number;
        total: number;
      };
      basis: {
        base: Record<string, number>;
        outOfCombatPanel: Record<string, number>;
      };
    };
  };
  damage?: {
    finalDamage: number; // selected or first event, kept for compatibility.
    totalFinalDamage: number;
    selectedEventId: string | null;
    events: Array<{
      id: string;
      kind: "direct" | "anomaly" | "disorder";
      finalDamage: number;
      singleDamage: number;
      count: number;
      multipliers: Record<string, number>;
      whiteBoxRows: Array<{
        label: string;
        formula: string;
        formulaLines?: string[];
        value: number;
        displayValue: string;
      }>;
    }>;
  };
}
```

## In-Combat Panel Rules

The in-combat panel is not recalculated from the naked character. It is:

```text
inCombat.panel = outOfCombat.panel + selected in-combat Buffs
```

Plain stat bonuses such as CRIT Rate, CRIT DMG, PEN Ratio, generic damage
bonus, elemental damage bonus, and physical resistance ignore are additive on
top of the out-of-combat panel.

Percentage HP/ATK/DEF Buffs must state their basis when the distinction matters:

```text
atkPct +10%, basis baseAtk:
  flat attack contribution = outOfCombat.base.atk * 0.10

atkPct +10%, basis outOfCombatAtk:
  flat attack contribution = outOfCombat.panel.atk * 0.10
```

The frontend manual correction area exposes both base-attack percentage and
out-of-combat-attack percentage because they are different Buff semantics.

`dmgBonus` and elemental damage bonuses are displayed separately even though
they will later share a damage multiplier bucket. CRIT Rate is not capped in
the panel layer; any future expectation formula should cap it inside the damage
calculation, not here.

### Buff Rule Types

Structured Buffs can use these calculation rules:

- `fixed`: directly adds one stored stat value.
- `derived`: converts a runtime source number by `sourceValue * ratio / 100`,
  then applies optional `cap`.
- `formula`: evaluates a safe single-variable expression from source `x` into
  the stored stat value. It only permits numbers, `x`, arithmetic, parentheses,
  and `floor/ceil/round/min/max/clamp`.
- `stacked`: multiplies `valuePerStack` by runtime stack count.

Buffs can also declare `buffModifiers` for effects that amplify another active
Buff rather than directly adding a stat. The first supported operation is
`multiplyResolvedValue`: when the modifier Buff and the target Buff are both
active, and the current rule id matches `targetEffectIds`, the rule's resolved
stored value is multiplied by `factor`. Multiple matching modifiers multiply
together. If the target Buff is not active, the modifier contributes no value.
This is used for Youye's Cinema 1, which multiplies her additional ability's
`anomalyDamageBonus` and `disorderDamageBonus` rules by `1.3`.

Every rule can choose an amplification target:

- `target.kind: "default"` (or omitted) uses the ordinary Buff path. Panel and
  enemy-target stats are added to the in-combat panel/target totals. Default
  event stats such as `anomalyDamageBonus`, `disorderDamageBonus`,
  `baseMultiplierBonus`, `anomalyCritRate`, and `anomalyCritDmg` are kept out
  of the panel and applied only inside the relevant damage event formula.
- `target.kind: "skill"` requires at least one `skillTargets` entry and is only
  valid for in-combat Buffs. It never writes into the global panel. It is
  evaluated against the selected damage event's `skillSource`; manually typed
  multipliers without a skill reference do not match. Omitting `rowId` targets
  the whole move, while a `rowId` targets only that multiplier row. Generated
  total rows also carry their source row ids, so a row-targeted rule is applied
  once when the generated total contains that source row.

Skill-targeted rules may use only the event-safe stats: elemental resistance
ignore, current/element resistance reduction, `enemyDefReduction`, generic and
elemental damage bonuses, `anomalyDamageBonus`, `disorderDamageBonus`, and
`skillMultiplierBonus`.
`skillMultiplierBonus` stores UI percentages, so `1500` means `+1500%` and the
calculator adds `15` to the direct skill multiplier:

```json
{
  "type": "fixed",
  "target": {
    "kind": "skill",
    "skillTargets": [
      {
        "agentSkillId": "hoshimi_miyabi",
        "categoryId": "basic",
        "moveId": "frost_moon",
        "rowId": "charge_3"
      }
    ]
  },
  "stat": "skillMultiplierBonus",
  "value": 1500,
  "mode": "flat"
}
```

Skill-targeted `dmgBonus` and elemental damage bonus are additive with the
normal generic/elemental damage bonus zone for the matched event only.
Skill-targeted defense, resistance reduction, and resistance ignore modify only
the matched event's defense/resistance multiplier. Legacy `type:
"damageModifier"` rules are still accepted by the calculator and maintenance
validator so older saved data can load, but new maintenance UI and custom Buff
UI no longer create that rule type.

For the HP-to-damage Buff, use:
`clamp(floor((x - 15000) / 400) + 10, 10, 40)`, with source `x` clamped to
15000-27000 and defaulted to 27000. Stored percent conventions still apply, so
formula result `40` for `dmgBonus` means 40% before the backend converts it to
the panel fraction `0.4`.

## ATK Basis Rules

Attack has three intentionally separate stages:

```text
base.atk = agent Base ATK + W-Engine Base ATK + Core Skill Base ATK
outOfCombat.panel.atk = base.atk * (1 + outOfCombat atkPct) + outOfCombat atkFlat
inCombat.panel.atk = outOfCombat.panel.atk + selected in-combat ATK buffs
```

Out-of-combat `atkPct` always scales from `base.atk`. This includes Drive Disc
ATK% main stats, Drive Disc ATK% sub-stats, unconditional out-of-combat set
effects, and W-Engine advanced stats when an advanced stat is ATK%.

In-combat ATK% must preserve its basis:

- `basis: "baseAtk"` scales from `outOfCombat.base.atk`.
- `basis: "outOfCombatAtk"` scales from `outOfCombat.panel.atk`.
- Teammate, boss/enemy, field, and manual Buffs default to
  `outOfCombatAtk` when they provide in-combat `atkPct` without an explicit
  basis.
- Self, W-Engine, and Drive Disc 4-piece in-combat `atkPct` effects must write
  `basis` explicitly. If they do not, the calculator ignores that effect and
  reports `missingAtkPctBasis`.

When adding new data, never treat `atkPct` as self-explanatory in an in-combat
effect. Either write a `basis` field or make sure the source type is one of the
explicit out-of-combat defaults above.

## Damage Events

The in-combat calculator now accepts a list of damage events. If `events` is
omitted, the legacy direct-damage fields are normalized into one direct event.
`damage.finalDamage` remains the selected or first event's damage for backward
compatibility; `damage.totalFinalDamage` is the sum of all events.

Direct damage uses:

```text
atk * skillMultiplier * critMultiplier * (1 + generic/element dmg bonus)
  * defenseMultiplier * resistanceMultiplier * stunMultiplier
```

`stunMultiplier` is `1` unless `damage.target.stunned` is true. The UI stores
`stunMultiplierPercent` as a percent, so `150` becomes an internal multiplier
of `1.5`.

Anomaly and disorder reuse the same attack, damage bonus, defense, resistance,
PEN, RES ignore, RES reduction, and stun multiplier logic as direct damage.
Attribute anomaly can use anomaly-specific crit modifiers; disorder does not
use anomaly crit.

### Anomaly Damage

Attribute anomaly damage uses:

```text
atk * anomalyMultiplier * (1 + generic/element dmg bonus)
  * defenseMultiplier * resistanceMultiplier * stunMultiplier
  * anomalyProficiency / 100
  * anomalyLevel
  * (1 + anomalyDamageBonus)
  * anomalyCritMultiplier
```

`anomalyDamageBonus` is the attribute anomaly damage bonus bucket. It is
independent from the existing generic/elemental damage bonus bucket and does not
affect disorder. `disorderDamageBonus` is the separate disorder-only bonus
bucket. `damageKinds` scopes are mutually exclusive: `anomaly` matches attribute
anomaly events and `disorder` matches disorder events.

The anomaly and disorder catalogs live in `data/anomaly_effects.json` and are
editable from the maintenance UI. v1 ships these default anomaly multipliers:

- Assault / 强击: `713%`
- Shatter / 碎冰: `500%`
- Burn / 灼烧: `50%` per tick, default `20` ticks
- Shock / 感电: `125%` per proc, default `10` procs
- Corruption / 侵蚀: `62.5%` per tick, default `20` ticks

The level zone is modeled as:

```text
anomalyLevel = trunc4(1 + (clamp(agentLevel, 1, 60) - 1) / 59)
```

The result is clamped between `1` and `2`. Current base panels still come from
level-60 static data; supporting character levels other than 60 requires future
agent, W-Engine, and core-skill stat tables.

### Disorder Damage

Disorder is manually modeled from the previous anomaly effect and elapsed time.
The second anomaly that triggers Disorder is not treated as the damage source in
v1; the current in-combat panel is used as the source snapshot.

Disorder damage uses the same common zones as attribute anomaly, but replaces
the attribute anomaly bonus and anomaly crit zones with `disorderDamageBonus`
only:

```text
atk * disorderMultiplier * (1 + generic/element dmg bonus)
  * defenseMultiplier * resistanceMultiplier * stunMultiplier
  * anomalyProficiency / 100
  * anomalyLevel
  * (1 + disorderDamageBonus)
```

```text
Burn Disorder       = 450% + floor((duration - elapsed) / 0.5) * 50%
Shock Disorder      = 450% + floor(duration - elapsed) * 125%
Corruption Disorder = 450% + floor((duration - elapsed) / 0.5) * 62.5%
Frozen Disorder     = 450% + floor(duration - elapsed) * 7.5%
Frost Frozen Disorder (Miyabi) = 600% + floor(duration - elapsed) * 75%
Flinch Disorder     = 450% + floor(duration - elapsed) * 7.5%
```

`elapsed` is clamped to `0..duration`, and `duration` always comes from the
catalog effect duration. Most effects are fixed at `10` seconds; Miyabi's Frost
Frozen Disorder is fixed at `20` seconds. Homepage and calculation-page inputs
do not accept per-event disorder duration overrides.

v1 explicitly does not model anomaly buildup, buildup ownership, multi-agent
source weighting, polarity disorder, or wind/vortex-style newer special cases.

### Agent Cinema Buff Data Shape

Agent cinema Buffs live under `agent.combatBuffs.cinemaBuffs` as a sparse array.
Only modeled cinemas are stored; do not create empty entries for missing cinema
levels. Each entry keeps the cinema level, cinema name, literal Buff
description, and structured `effects` rules:

```json
{
  "combatBuffs": {
    "corePassive": null,
    "additionalAbility": null,
    "cinemaBuffs": [
      {
        "cinemaLevel": 1,
        "cinemaName": { "zhCN": "影画名称" },
        "description": { "zhCN": "Buff 原文描述" },
        "scope": "inCombat",
        "defaultChecked": false,
        "coverage": { "default": 1, "min": 0, "max": 1, "step": 0.1 },
        "effects": [
          { "id": "effect-1", "type": "fixed", "stat": "atkPct", "value": 20, "mode": "pct", "basis": "baseAtk" }
        ]
      }
    ]
  }
}
```

At load time, cinema entries become normal self Buff candidates with IDs like
`agent:ye_shunguang.cinema.1`. They are not checked by default, because a
modeled cinema should not imply the player owns that cinema. Since they are
self Buffs, in-combat `atkPct` rules must declare `basis` explicitly.

### Teammate Buff Data Shape

Combat Buff data uses `data/combat_buffs.json` version 2. Teammate, field,
boss, and hidden system Buffs are stored separately for maintenance, then the
backend flattens them into the existing `activeBuffIds` calculation path.

Teammate Buffs are stored by teammate first, because one teammate can contribute
multiple independent Buff sources:

```json
{
  "teammates": [
    {
      "id": "qianxia",
      "name": { "zhCN": "千夏" },
      "buffs": [
        {
          "id": "qianxia.core_passive.angelic_chord_atk_flat_1050",
          "source": { "zhCN": "核心被动" },
          "description": { "zhCN": "字面描述原文" },
          "scope": "inCombat",
          "stats": [
            { "stat": "atkFlat", "value": 1050, "mode": "flat" }
          ]
        }
      ]
    }
  ]
}
```

At load time, the backend flattens those teammate entries into normal
`CombatBuff` candidates so the existing `activeBuffIds` calculation path can
apply them. The grouped shape remains available in `/api/meta` for frontend
display, where the homepage renders:

- teammate name;
- Buff source, such as `核心被动`, `强化特殊技`, `影画1`, `额外能力`;
- literal description;
- structured calculation effect.

For the first teammate, 千夏 currently has:

- `核心被动`: `atkFlat +1050`;
- `强化特殊技`: `atkFlat +50`.

Field Buffs are stored in `fieldBuffs`:

```json
{
  "fieldBuffs": [
    {
      "id": "field.example",
      "sourceType": "field",
      "name": { "zhCN": "场地效果名" },
      "source": { "zhCN": "危局" },
      "sourcePeriod": { "zhCN": "2.8版本第三期" },
      "description": { "zhCN": "字面说明" },
      "scope": "inCombat",
      "coverage": { "default": 1, "min": 0, "max": 1, "step": 0.1 },
      "effects": []
    }
  ]
}
```

Boss Buffs are stored in `bossBuffs` with `bossName`, `bossSource`,
`sourcePeriod`, `description`, `coverage`, and `effects`. Hidden validation
entries live in `systemBuffs`; they remain calculable but are filtered from
`/api/meta`.

### Custom Buff Input Rule

Homepage custom Buffs are user-created, temporary in-combat corrections stored
inside the local homepage selection state. They are converted into
`combatBuffs.manualStats` when the calculator sends an in-combat request.

The custom Buff modal intentionally creates only one custom Buff at a time, and
that Buff contains only one stat effect. This keeps manual corrections
inspectable on the homepage and prevents a single opaque "custom" row from
silently bundling several unrelated calculations together.

## User Drive Disc Inventory

The user inventory is the source for future pages such as "all Drive Discs",
"import", and "manual edit". It is not the same as the six Drive Discs equipped
by the calculator form.

The first supported source is ZZZ Scanner's Chinese JSON export. The sample file
inspected on 2026-05-26 is:

```text
E:\yan1\ZZZ-Scanner-master\ZZZ-Scanner.Next\publish-dpi-fix\Scans\2026-05-26-19-12-09\export.json
```

Its top-level shape is an array of 200 Drive Disc objects. Each object uses
Chinese field names:

```json
{
  "序号": 1,
  "名称": "流光咏叹",
  "槽位": 1,
  "品质": "S",
  "等级": 15,
  "最大等级": 15,
  "主属性": { "生命值": 2200 },
  "副属性": [
    { "攻击力": "6%" },
    { "暴击率": "4.8%" },
    { "暴击伤害": "14.4%" },
    { "攻击力": 38 }
  ]
}
```

Import rules:

- `序号` becomes `source.sequence` and participates in the stable generated id.
- `名称` becomes `setName`.
- `setId` is generated as `scanner-set-${sha1(setName).slice(0, 12)}` until the
  canonical Drive Disc set catalog is expanded enough to resolve it.
- `槽位` becomes `partition`.
- `品质`, `等级`, and `最大等级` become `rarity`, `level`, and `maxLevel`.
- `主属性` becomes `mainStat`.
- `副属性` becomes `subStats`.
- The full source object is preserved in `raw` so future UI can show the scanner
  value exactly and so OCR/parser issues can be debugged later.

Chinese stat labels are normalized by value mode:

- `"生命值": 2200` -> `hpFlat: 2200`
- `"生命值": "3%"` -> `hpPct: 0.03`
- `"攻击力": 316` or `38` -> `atkFlat`
- `"攻击力": "6%"` -> `atkPct: 0.06`
- `"防御力": 184` or `15` -> `defFlat`
- `"防御力": "4.8%"` -> `defPct: 0.048`
- `"暴击率"` -> `critRate`
- `"暴击伤害"` -> `critDmg`
- `"异常精通"` -> `anomalyProficiency`
- `"异常掌控"` -> `anomalyMastery`
- `"冲击力"` -> `impact`
- `"能量自动回复"` -> `energyRegen`
- `"穿透值"` -> `penFlat`
- `"穿透率"` -> `penRatio`
- `"物理/火/冰/电属性/以太伤害加成"` -> the corresponding elemental damage
  bonus stat.

The imported 2026-05-26 scanner export contains these set names:

- `流光咏叹`
- `沧浪行歌`
- `月光骑士颂`
- `山大王`
- `云岿如我`
- `法厄同之歌`
- `如影相随`
- `折枝剑歌`

These sets are intentionally not assumed to have known 2-piece or 4-piece
effects yet. Until `data/drive_disc_sets.json` is expanded, imported discs from
those sets can still be stored, displayed, filtered, and edited, but set effects
may be ignored by panel calculation.

## Out-Of-Combat Calculation

Use two accumulators:

- `base`: base values that percentage stats scale from.
- `bonus`: additive flat and percentage bonuses from equipment.

For v1, total base attack is special:

```text
base.atk = agent.level60.atkBase + wEngine.level60.atkBase
```

After Core Skill modeling, the actual v1 formula is:

```text
base.atk = agent.level60.atkBase + wEngine.level60.atkBase + coreSkill.atkBase
```

For Ye Shunguang at Core Skill F:

```text
base.atk = 863 + 743 + 75 = 1681
```

HP and DEF do not receive W-Engine base values:

```text
base.hp = agent.level60.hpBase
base.def = agent.level60.defBase
```

If a future Core Skill grants Base HP or Base DEF, those additions should enter
`base.hp` or `base.def` before percentage bonuses are applied.

Panel formulas:

```text
hpPanel  = base.hp  * (1 + hpPct)  + hpFlat
atkPanel = base.atk * (1 + atkPct) + atkFlat
defPanel = base.def * (1 + defPct) + defFlat
```

Other tracked stats are additive unless later evidence requires a different
formula:

```text
critRate = agent.critRate + all critRate bonuses
critDmg = agent.critDmg + all critDmg bonuses
penRatio = all penRatio bonuses
penFlat = all penFlat bonuses
dmgBonus = matching attribute damage bonuses + generic dmgBonus
```

Core Skill panel bonuses are added before the final panel is produced. For Ye
Shunguang at Core Skill F:

```text
critRate = agent.critRate + driveDisc/set critRate + 0.048 + 0.048 + 0.048
```

Impact, Anomaly Mastery, Anomaly Proficiency, and Energy Regen are represented
as panel stats in v1. Their exact in-game display formatting should be verified
against screenshots before implementation.

## Effect Scope Rules

v1 applies out-of-combat effects with:

```text
scope === "outOfCombat" && condition === null
```

Drive Disc set effects use fixed defaults instead of storing those fields:
2-piece effects always apply to the out-of-combat panel, and 4-piece effects
are always modeled as in-combat effects.

Examples:

- Hormone Punk 2-piece ATK +10% is applied.
- Hormone Punk 4-piece ATK after entering combat is not applied.
- Swing Jazz 4-piece squad DMG after Chain Attack or Ultimate is not applied.
- W-Engine passives are not applied unless explicitly marked out-of-combat and
  unconditional.
- Core Skill enhancement stats are applied according to the selected Core Skill
  level because they are part of the agent's stable out-of-combat progression.

## Simple Target Function

The first scoring function is only a ranking helper:

```text
score = atkPanel * (1 + min(critRate, 1) * critDmg) * (1 + selectedDmgBonus)
```

`selectedDmgBonus` defaults to the agent `damageElement` damage stat when it is
present, otherwise the agent attribute damage stat, plus generic `dmgBonus`.

`physicalResIgnore` is not a panel stat in the same sense as ATK or CRIT. It is
stored now because Cloudcleave Radiance grants Physical RES Ignore, but it
should be consumed later by enemy resistance damage calculation rather than by
the out-of-combat panel formula.

This target function is deliberately not a real rotation model. Attack, Stun,
Anomaly, Support, Defense, and Rupture-specific scoring should be added later.

The Drive Disc optimizer still uses its existing `damage` objective. A future
optimizer pass should expose at least these objectives:

- `directDamage`: maximize one selected direct event.
- `anomalyDamage`: maximize one selected anomaly or disorder event.
- `mixedRotationTotal`: let the user choose direct skills and anomaly/disorder
  counts, then maximize the total damage sum.

## Explicitly Deferred

- Character levels other than 60 for base panel calculation.
- Multi-hit rotation totals, skill resource modeling, and core passive damage
  scaling.
- Mindscape Cinema.
- Conditional W-Engine passives.
- Conditional Drive Disc 4-piece effects.
- Teammate and field buffs.
- Enemy weakness handling.
- Daze, stun windows, anomaly buildup, anomaly ownership weighting, polarity
  disorder, and multi-hit rotation totals.
- Data imports from external databases.
