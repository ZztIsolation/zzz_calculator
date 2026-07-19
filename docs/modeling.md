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
   from self, teammate, W-Engine passives, Drive Disc 4-piece effects, targeted
   Drive Disc 2-piece event rules, boss or enemy effects, field effects, and
   manual corrections.
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
- Boss archive: `data/bosses.json` stores stable Boss profiles with nested,
  versioned encounters. The loader flattens each encounter into one
  `sourceType: "boss"` combat Buff while preserving the profile, appearance,
  target, source, mechanic, and score metadata in `/api/meta`.
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
- `POST /api/maintenance/{agents|agent-skills|w-engines|drive-disc-sets|anomaly-effects|teammate-buffs|field-buffs|boss-buffs}`
- `DELETE /api/maintenance/teammate-buffs/:teammateId/:buffId`
- `DELETE /api/maintenance/teammate-buffs/:teammateId`
- `DELETE /api/maintenance/boss-buffs/:bossId/:encounterId`
- `DELETE /api/maintenance/boss-buffs/:bossId`
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

Boss profiles keep defense and resistance information as catalog metadata.
Each weakness defaults to `-20`, each resistance defaults to `20`, and every
other element defaults to `0`; `target.resistanceOverrides` replaces the
default for exceptional cases. Selecting a Boss Buff does not copy these values
into the damage target. The selected encounter contributes its modeled
`playerBuffs` and `playerDebuffs` effects through `activeBuffIds`. Entries marked
`descriptiveOnly` must have an unmodeled reason and no effects. Stacked Boss
rules use the existing `runtimeInputs[encounterId].effects[ruleId].stacks`
contract. `data/bosses.json` schema version 2 does not contain separate
`mechanics` or `scoreRules` collections.

Boss profile and encounter maintenance is atomic at the file level. The POST
body is `{ boss, encounter }`; the response keeps `savedItem` for compatibility
and adds `savedBoss` plus `savedEncounter`. Updating one encounter preserves
all sibling versions. An unchanged ruleset returning in a later phase appends
to `appearances`; an effect or numeric change creates a new encounter ID. Old
maintenance clients may still submit removed encounter fields, but the server
discards them and never returns or persists them.


```ts
type ZzzStat =
  | "hpBase" | "atkBase" | "defBase"
  | "hpFlat" | "atkFlat" | "defFlat"
  | "hpPct" | "atkPct" | "defPct"
  | "critRate" | "critDmg"
  | "impact" | "anomalyProficiency" | "anomalyMastery"
  | "penFlat" | "penRatio"
  | "energyRegen"
  | "allResIgnore"
  | "physicalResIgnore" | "fireResIgnore" | "iceResIgnore"
  | "electricResIgnore" | "etherResIgnore" | "windResIgnore"
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
  // Ordinary 2-piece rules apply out of combat; skill targets apply to events.
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

type SkillType =
  | "basic" | "dodge" | "assist" | "special" | "chain" | "ultimate"
  | "core_skill" | "additional_ability" | "cinema";

type SkillTag = "dashAttack" | "exSpecial" | "assistAttack";

type SkillTarget =
  | { kind: "skillType"; skillType: SkillType }
  | { kind: "skillTag"; skillTag: SkillTag }
  | {
      kind: "specific";
      agentSkillId: string;
      categoryId: string;
      skillType: SkillType;
      moveId?: string;
      rowId?: string;
    };

type EffectTarget =
  | { kind?: "default" }
  | { kind: "skill"; skillTargets: SkillTarget[] }
  | {
      kind: "anomaly";
      settlementType: "attribute" | "disorder";
      anomalyEffects: Array<"assault" | "shatter" | "burn" | "shock" | "corruption" | "frozen" | "frost_frozen" | "flinch">;
    };

type BuffRuleStat =
  | ZzzStat
  | "anomalyDamageBonus"
  | "disorderDamageBonus"
  | "baseMultiplierBonus"
  | "disorderBaseMultiplierBonus"
  | "anomalyCritRate"
  | "anomalyCritDmg"
  | "anomalyDurationBonusSeconds"
  | "stunDmgMultiplierBonus" | "stunDmgMultiplierBonusAlways" | "stunDmgMultiplierBonusCapAlways"
  | "sheerDmgBonus" | "physicalSheerDmg" | "fireSheerDmg" | "iceSheerDmg" | "electricSheerDmg" | "etherSheerDmg" | "windSheerDmg"
  | "physicalCritDmg" | "fireCritDmg" | "iceCritDmg" | "electricCritDmg" | "etherCritDmg" | "windCritDmg"
  | "physicalDefIgnore" | "fireDefIgnore" | "iceDefIgnore" | "electricDefIgnore" | "etherDefIgnore" | "windDefIgnore"
  | "skillMultiplierBonus";

interface EffectCoverage {
  default: number; // Stored as 0-1; maintenance displays 0%-100%, player controls display 0-1.
  min: 0;
  max: 1;
  step: 0.1;
}

type EffectRule = (
  | { type: "fixed"; stat: BuffRuleStat; value: number; mode: "flat" | "pct"; basis?: Effect["stats"][number]["basis"]; target?: EffectTarget }
  | { type: "derived"; stat: BuffRuleStat; mode: "flat" | "pct"; sourceLabel?: { zhCN?: string }; defaultSourceValue: number; ratio: number; cap?: number; target?: EffectTarget }
  | { type: "formula"; stat: BuffRuleStat; mode: "flat" | "pct"; source: { variable: "x"; label?: { zhCN?: string }; defaultValue: number; min?: number; max?: number }; formula: { expression: string; valueUnit?: "storedValue" | "storedPercent" }; target?: EffectTarget }
  | { type: "stacked"; stat: BuffRuleStat; mode: "flat" | "pct"; valuePerStack: number; maxStacks: number; defaultStacks?: number; stackGroup?: string; stackLabel?: { zhCN?: string; en?: string }; basis?: Effect["stats"][number]["basis"]; target?: EffectTarget }
) & {
  id: string;
  coverage?: EffectCoverage;
  condition?: string | { zhCN?: string; en?: string };
  durationSeconds?: number;
  cooldownSeconds?: number;
  requirement?: { specialty?: string };
};

interface Effect {
  scope: "outOfCombat" | "inCombat";
  condition: string | null;
  exclusiveGroup?: string;
  stats?: Array<{
    stat: ZzzStat;
    value: number;
    mode: "flat" | "pct";
    basis?: "baseHp" | "outOfCombatHp" | "baseAtk" | "outOfCombatAtk" | "baseDef" | "outOfCombatDef";
  }>;
  effects?: EffectRule[];
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
  period?: FieldCombatBuffPeriod | null;
  bossName?: { zhCN?: string; en?: string };
  bossSource?: { zhCN?: string; en?: string };
  name: { zhCN?: string; en?: string };
  description?: string | { zhCN?: string; en?: string } | null;
  conditionLabel?: string | { zhCN?: string; en?: string } | null;
  scope: "inCombat";
  stats: Effect["stats"];
}

interface FieldCombatBuffPeriod {
  modeId: string;
  gameVersion: string;
  phaseNo: number;
  phaseName: { zhCN?: string; en?: string };
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
      skillType: SkillType;
      skillTags?: SkillTag[];
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
  period: FieldCombatBuffPeriod;
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
    wEngineTeamModificationLevels?: Record<string, number>;
    manualStats?: Array<{
      id?: string;
      label?: string;
      stat: ZzzStat;
      value: number;
      mode: "flat" | "pct";
      basis?: Effect["stats"][number]["basis"];
    }>;
    runtimeInputs?: Record<string, {
      effects?: Record<string, {
        coverage?: number;
        sourceValue?: number;
        stacks?: number;
      }>;
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
      stunMultiplierPercent?: number; // default 150; activation is decided by each event.
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
      | { id: string; kind: "direct"; stunned?: boolean; skillMultiplier?: number; skillRef?: InCombatRequest["damage"]["skillRef"]; damageBasis?: "atk" | "anomalyProficiency"; damageRatioPct?: number; critMode?: "expected" | "crit" | "nonCrit"; count?: number }
      | { id: string; kind: "sheer"; stunned?: boolean; skillMultiplier?: number; skillRef?: InCombatRequest["damage"]["skillRef"]; damageRatioPct?: number; critMode?: "expected" | "crit" | "nonCrit"; count?: number }
      | { id: string; kind: "anomaly"; stunned?: boolean; anomalyEffect: "assault" | "shatter" | "burn" | "shock" | "corruption"; anomalyVariant?: "normal" | "polarizedAssault"; damageRatioPct?: number; procCount?: number; count?: number }
      | { id: string; kind: "disorder"; stunned?: boolean; previousAnomalyEffect: "burn" | "shock" | "corruption" | "frozen" | "flinch"; disorderType?: "normal" | "polarized"; damageRatioPct?: number; elapsedSeconds: number; count?: number }
      | { id: string; kind: "skillGroup"; stunned?: boolean; skillGroupId: string; count?: number }
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

### Teammate W-Engine Refinement Selection

Each selected teammate-carried W-Engine has an independent refinement level.
The per-agent browser build persists the selection as a lightweight entry in
`combat.addedBuffs`; this is a reference to catalog data, not a copied custom
Buff:

```json
{
  "id": "wEngine:<engineId>.team",
  "sourceCategory": "wEngine",
  "sourceKind": "wEngineTeam",
  "wEngineModificationLevel": 1
}
```

The same Buff ID remains present in `combat.activeBuffIds`. New saves keep the
ID and reference together. For compatibility, a valid older `addedBuffs`-only
W-Engine reference is restored as active. This reuses the existing owner-scoped
localStorage schema and does not change its key or version. Stored levels are
clamped to the referenced W-Engine's catalog range; a missing or non-numeric
value defaults to refinement 1, while an old out-of-range UI value such as `99`
becomes the catalog maximum. This targeted normalization does not alter custom
Buffs.

The Buff picker edits selected IDs, lightweight references, and runtime inputs
in one temporary draft. Selecting a W-Engine creates a refinement-1 reference;
changing the selector rematerializes that candidate's effect preview without
discarding its rule-level runtime inputs. Deselecting or bulk-removing it clears
the reference and runtime values. Apply commits the complete draft, while
Cancel has no persisted side effect.

When a build is calculated, the store projects the references into
`combatBuffs.wEngineTeamModificationLevels`, keyed by the canonical team Buff
ID. The shared calculator materializes each source W-Engine at that level before
resolving its team Buff. Direct calculation input still uses the strict core
contract: a missing, fractional, or out-of-range level falls back to the
W-Engine's default refinement instead of being clamped. The optimizer consumes
the same build input, so its scores cannot diverge from the workbench selection.
The enabled-Buff summary includes the selected refinement, and only entries with
`sourceKind: "custom"` contribute to custom-Buff lists and counts.

Coverage belongs to an individual `EffectRule`, never to the containing Buff.
The maintenance switch creates or removes that rule's `coverage` object. Runtime
overrides use `combatBuffs.runtimeInputs[buffId].effects[effectId].coverage`.
Rules without catalog coverage ignore runtime coverage values and remain at
100%. Legacy parent catalog/runtime coverage is still read and expanded to each
child rule during normalization, but maintenance writes only the canonical
per-rule shape. Administrators edit defaults as `0%-100%` in maintenance, while
the player-facing Buff picker and optimizer edit the same values directly on a
`0-1` decimal scale.

New catalog and maintenance data must not store `appliesTo`. Element-specific
critical damage and defense ignore use the explicit stat keys above, while
multi-element effects are represented as multiple rules. Skill restrictions use
`target.kind: "skill"` only. Attribute-Anomaly and Disorder restrictions use
`target.kind: "anomaly"`, with a settlement type and one or more concrete
effects. `anomalyDurationBonusSeconds` is stored in raw seconds, is valid only
for a Disorder Anomaly target, and is not a stored percentage. The runtime still reads legacy `damageModifier` and
`appliesTo` payloads for old browser state. Maintenance loading converts known
element and skill filters; an unconvertible legacy `damageKinds` or
`anomalyEffects` filter blocks saving instead of persisting hidden behavior.

Disorder events keep `elapsedSeconds` after snapping it to the selected source
effect's tick interval, even when it exceeds the catalog base duration. The
event editor's multiplier preview remains catalog-only. Final calculation sums
matching `anomalyDurationBonusSeconds`, clamps elapsed time to `base duration +
duration bonus`, and recomputes remaining time, tick count, and base multiplier.
Without a duration Buff, behavior is unchanged. Duration extensions do not
automatically add Attribute-Anomaly `procCount`; they model only the status
window used by later Disorder settlement.

Jane Doe's teammate group uses this contract directly. Core Passive F targets
Flinch Disorder with `+5` seconds and targets Assault with Anomaly CRIT Rate
`clamp(40 + x * 0.16, 0, 100)%` plus 50% Anomaly CRIT DMG. Its runtime source
`x` is Jane's AP, defaulting to and capped at 375 while allowing lower values.
Cinema 2 adds 15% DEF ignore and another 50% Anomaly CRIT DMG to Assault only.
Cinema 4 targets all catalog Attribute Anomalies with 18% Anomaly DMG and does
not enter the Disorder bonus bucket. Selecting these Buffs means their stated
trigger conditions are already satisfied; uptime is not simulated.

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
- `stacked`: multiplies `valuePerStack` by runtime stack count. Multiple
  stacked rules can share one runtime stack input by using the same
  `stackGroup`, for cases where one in-game stack state drives several stat
  bonuses. Rules in the same group should use the same `maxStacks` and
  `defaultStacks`; `stackLabel` controls the shared UI label.

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
  `baseMultiplierBonus`, `disorderBaseMultiplierBonus`, `anomalyCritRate`, and `anomalyCritDmg` are kept out
  of the panel and applied only inside the relevant damage event formula.
  Use `baseMultiplierBonus` for attribute anomaly multiplier additions and
  `disorderBaseMultiplierBonus` for disorder multiplier additions.
- `target.kind: "skill"` requires at least one `skillTargets` entry and is
  valid for in-combat Buffs or a skill-targeted Drive Disc 2-piece rule. It
  never writes into the global panel. It is
  evaluated against the selected damage event's `skillSource`; manually typed
  multipliers without a skill reference do not match. A `kind: "skillType"`
  target matches that skill type across all agents. A `kind: "specific"`
  target requires an agent and skill type; omitting `moveId` targets that
  agent's complete skill type, omitting `rowId` targets the whole move, and a
  `rowId` targets only that multiplier row. Generated total rows also carry
  their source row ids, so a row-targeted rule is applied once when the
  generated total contains that source row.

A `kind: "skillTag"` target matches an explicit move tag. The initial tags are
`dashAttack`, `exSpecial`, and `assistAttack`. Tags are orthogonal to
`skillType`: for example, a Dash Attack keeps `skillType: "dodge"`, while a
Dodge Counter has the same top-level type without the `dashAttack` tag. Every
tag must be stored on the catalog move and copied into `skillSource`; runtime
matching never infers tags from Chinese names or IDs. Multiple targets in one
rule use OR semantics, but one rule cannot mix specific moves, skill types, and
skill tags.

Every catalog move stores an explicit `skillType`. `special` intentionally
includes both Special Attacks and EX Special Attacks; `dodge` and `assist`
retain their existing top-level grouping. Chain Attacks and Ultimates remain in
the same multiplier-table category but use distinct `chain` and `ultimate`
skill types. Normal event generation and canonical target matching accept only
that explicit field; move IDs never determine a new event's type. One skill
type may share a multiplier-table category with another type, but a single type
must not be split across multiple categories for the same agent. Legacy
`moveIdPrefixes` inputs remain runtime-compatible: known `chain_` / `ultimate_`
prefixes are normalized to explicit types before matching or persistence, while
unknown prefixes retain legacy runtime behavior and are rejected by maintenance
saves. New catalog and UI writes never emit prefix targets.

Rule-level `condition`, `durationSeconds`, and `cooldownSeconds` are descriptive
trigger metadata and do not automatically derive uptime. A rule with
`coverage` remains independently adjustable and defaults to its catalog value;
an omitted coverage is treated as 100%. Stacked rules likewise use their
configured default/max stacks. `requirement.specialty` is enforced against the
current agent before the rule is resolved.

Skill-targeted rules may use only the event-safe stats: elemental resistance
ignore, current/element resistance reduction, `enemyDefReduction`, generic and
elemental damage bonuses, `anomalyDamageBonus`, `disorderDamageBonus`, captured
stun-vulnerability caps, and `skillMultiplierBonus`.
Targeted `dmgBonus` is displayed as “技能目标伤害加成%”. It enters the same
additive damage-bonus zone as generic and elemental damage bonuses:
`1 + genericBonus + elementBonus + targetedSkillBonus`. It does not change the
stored skill multiplier.
`skillMultiplierBonus` stores UI percentages, so `1500` means `+1500%` and the
calculator adds `15` to the direct skill multiplier:

```json
{
  "type": "fixed",
  "target": {
    "kind": "skill",
    "skillTargets": [
      {
        "kind": "specific",
        "agentSkillId": "hoshimi_miyabi",
        "categoryId": "basic",
        "skillType": "basic",
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

Direct damage normally uses:

```text
atk * skillMultiplier * critMultiplier * (1 + generic/element dmg bonus)
  * defenseMultiplier * resistanceMultiplier * stunMultiplier * damageScale
```

`damageRatioPct` is stored as a schema percentage and becomes `damageScale`
during normalization. The player-facing event manager no longer exposes this
technical scale as an editable field, because it can be mistaken for the skill
or Anomaly multiplier. Structured maintenance and existing payloads retain it.
A skill row or manual direct event may set
`damageBasis: "anomalyProficiency"`; that replaces `atk` in the first factor
without changing the direct-damage CRIT, damage-bonus, defense, resistance, or
stun zones. Alice Cinema 6 uses this form for its `3300%` guaranteed-CRIT
follow-up.

The event manager's `current multiplier` is an event-level preview, not a final
damage result. Direct and Sheer events use the current-level skill multiplier;
attribute Anomaly uses `baseMultiplier * procCount`; and Disorder uses its
fixed-plus-remaining-ticks multiplier and Polarized scale. All three fold in
`damageScale`, including a stored `damageRatioPct`, but do not multiply the
separate event `count` or include CRIT, damage bonus, defense, resistance, stun,
Anomaly Proficiency, or other final-damage zones. Skill-group wrappers have no
synthetic aggregate multiplier; their child-event preview resolves each child
independently.

Each event's `stunned` flag decides whether the stun zone uses the configured
multiplier and defaults to `true` when omitted. The target stores only
`stunMultiplierPercent`, so `150` becomes an internal multiplier of `1.5` for
stunned events. A skill-group reference overrides every child event with its
own `stunned` value during expansion. Non-stunned events use `1`, except that
`stunDmgMultiplierBonusAlways` remains active by design.

`stunDmgMultiplierBonusCapAlways` models effects such as Ye Shunguang's Ether
Veil: Judgment. Its stored UI percentage is the maximum captured vulnerability
bonus, not a fixed damage bonus. When a matching rule is active, both stunned
and non-stunned events use:

```text
min(configuredStunMultiplier + stunBonuses, 1 + stunDmgMultiplierBonusCapAlways)
```

Therefore `110` caps the final multiplier at `2.1`, while `200` caps it at
`3.0`. Without this rule, the normal event-level `stunned` behavior is
unchanged. Ye Shunguang's Core Passive targets only attacks performed after
entering Clarity state. Cinema 4 multiplies the Core Passive cap from `110` to
`200` through `multiplyResolvedValue`; it does not add a flat `90%` damage
bonus and contributes nothing if the Core Passive is inactive.

Legacy non-administrator payloads may still provide `damage.target.stunned`.
Normalization copies that value into events which do not already have an
explicit flag and then discards the target-level state. Administrator-default
payloads always use their authored event values, with missing values defaulting
to `true`.

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
bucket. Their stat keys carry the event scope directly; new data does not add a
separate event-kind filter.

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

`elapsed` is rounded to the nearest interval declared by the selected catalog
effect's `tickIntervalSeconds`. Burn and Corruption use `0.5`-second intervals;
Shock, Frozen, Frost Frozen, and Flinch use whole-second intervals. The
workbench, administrator editor, maintenance cleaner, multiplier preview, and
calculation core all resolve the same catalog interval. Existing off-step
values are normalized lazily, so `4.5` seconds on a whole-second effect becomes
`5` seconds. Missing or unknown effects retain a `0.5`-second compatibility
fallback.

Event storage does not clamp `elapsed` to the catalog base duration because a
matching combat effect may extend the effective anomaly duration. The final
Disorder calculation clamps elapsed time against that effective duration after
duration bonuses are known. The base-only event preview uses the catalog
duration and therefore displays zero remaining ticks when elapsed exceeds it.

`baseDuration` always comes from the catalog effect duration. Most effects use
`10` seconds; Miyabi's Frost Frozen Disorder uses `20` seconds. Effective
`duration` is `baseDuration + durationBonusSeconds` after matching combat
effects are resolved. Homepage and calculation-page inputs do not accept
per-event duration overrides.

The model supports Polarized Disorder's `25%` multiplier scale and Alice's
Polarized Assault label/100% Assault settlement. It still does not model
anomaly buildup time, buildup ownership, multi-agent source weighting, or
wind/vortex-style newer special cases.

Alice's Core Passive maps its 18%-per-second, 180%-maximum description onto the
existing `disorderBaseMultiplierBonus` rule as 18% per stack, with both
`defaultStacks` and `maxStacks` set to `10`. The Buff editor exposes this as one
layer control. Do not add physical-only remaining-time or cap stat keys; all
Disorder base-multiplier additions use the shared event-modifier bucket.

### Agent Cinema Buff Data Shape

Agent cinema Buffs live under `agent.combatBuffs.cinemaBuffs` as a sparse array.
Only cinemas with a modeled numerical effect or a modeled calculation event are
stored; do not create empty entries for unrelated cinema levels. Each entry
keeps the cinema level, cinema name, literal Buff description, and structured
`effects` rules. `effects` may be empty when the numerical mechanic is carried
entirely by a cinema-specific damage event, as with Alice Cinema 6:

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
        "effects": [
          { "id": "effect-1", "type": "fixed", "stat": "atkPct", "value": 20, "mode": "pct", "basis": "baseAtk", "coverage": { "default": 1, "min": 0, "max": 1, "step": 0.1 } }
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

Ye Shunguang Cinema 6 uses two move-targeted `skillMultiplierBonus: 1500`
rules for Return to Dust and Cut Delusion, Open Heaven. This is mathematically
equivalent to their final hits dealing an additional `1500% ATK` while keeping
the triggering move's CRIT, damage, defense, and resistance zones. Her
Cinema-6 administrator variant preserves the existing twelve Cinema-2 short
axes, keeps two paid Chase Cloud, Startled Thunder Ultimates, and replaces four
of ten Return to Dust finishers, producing six Cut Delusion finishers and six
Return to Dust finishers. Cinema 0-1 uses the base variant, Cinema 2-5 uses the
Cinema-2 variant, and Cinema 6 uses this dedicated variant.

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
      "attribute": "physical",
      "specialty": "support",
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

`attribute` and `specialty` are required role-level enum fields for maintained
teammate groups. They are stored once on the teammate instead of being repeated
on every Buff. At load time, the backend flattens those teammate entries into
normal `CombatBuff` candidates so the existing `activeBuffIds` calculation path
can apply them. The grouped shape, including both role fields, remains available
in `/api/meta` for frontend display, where the homepage renders:

- teammate name;
- Buff source, such as `核心被动`, `强化特殊技`, `影画1`, `额外能力`;
- literal description;
- structured calculation effect.

The teammate picker derives its available attribute and specialty options from
the currently loaded groups. Multiple values within one dimension use OR;
attribute and specialty use AND with each other and with text search. Bulk add
and remove operate on the resulting visible Buffs. Legacy groups without either
field remain visible while no teammate filter is active, but do not match an
active filter.

The maintenance UI keeps the grouped shape visible: administrators first select
a teammate, assign its required attribute and specialty, then choose one Buff
from the secondary list and edit only that Buff. IDs stay internal.
`POST /api/maintenance/teammate-buffs` continues to accept
`{ teammate, buff }`; omitting either new ID asks the server to generate it
before validation. The two DELETE forms remove one Buff or the complete
teammate group respectively.

For the first teammate, 千夏 currently has:

- `核心被动`: `atkFlat +1050`;
- `强化特殊技`: `atkFlat +50`.

Field Buffs are stored in `fieldBuffs`:

```json
{
  "fieldBuffs": [
    {
      "id": "field.critical_assault.v3_0.p3.example",
      "sourceType": "field",
      "name": { "zhCN": "场地效果名" },
      "source": { "zhCN": "危局强袭战" },
      "period": {
        "modeId": "critical_assault",
        "gameVersion": "3.0",
        "phaseNo": 3,
        "phaseName": { "zhCN": "第三期" }
      },
      "sourcePeriod": { "zhCN": "3.0版本第三期" },
      "description": { "zhCN": "字面说明" },
      "scope": "inCombat",
      "effects": [
        { "id": "field-effect-1", "type": "fixed", "stat": "dmgBonus", "value": 20, "mode": "flat", "coverage": { "default": 1, "min": 0, "max": 1, "step": 0.1 } }
      ]
    }
  ]
}
```

Field Buffs keep `sourcePeriod` as a compatibility display string, but filtering
and maintenance should use `period.modeId`, `period.gameVersion`,
`period.phaseNo`, and `period.phaseName`. Maintenance limits `modeId` to
`defense_v5` / `critical_assault`, `gameVersion` to `3.0` through `3.3`, and
`phaseNo` to `1` through `4`; `source`, `sourcePeriod`, `phaseName`, and missing
new-record IDs are generated from those controlled values. Boss Buffs are stored
in `bossBuffs` with `bossName`, `bossSource`, `sourcePeriod`, `description`,
and `effects`. Coverage is optional on each effect rule: its presence authorizes
a player override, while absence fixes that rule at 100%. Hidden validation
entries live in `systemBuffs`; they remain calculable but are filtered from
`/api/meta`.

All other maintenance create endpoints also accept an omitted top-level ID.
Owned category, move, row, effect, modifier, skill-group, and calculation-event
IDs are generated automatically, while IDs supplied by existing records remain
stable. This changes only the maintenance write contract; persisted catalog
shapes and runtime calculation semantics remain unchanged.

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
as panel stats in v1. Anomaly Mastery percentage and flat-point inputs are not
interchangeable. Core Skill `anomalyMasteryFlat` entries targeted at the panel
are part of the stable white stat, while `anomalyMastery` remains a stored
percentage input:

```text
outOfCombatAnomalyMastery =
  (agentAnomalyMastery + coreSkillWhiteStatMastery)
  * (1 + anomalyMasteryPct)
  + anomalyMasteryFlat

inCombatAnomalyMastery =
  outOfCombatAnomalyMastery
  * (1 + inCombatAnomalyMasteryPct)
  + inCombatAnomalyMasteryFlat
```

The public calculation breakdown exposes these accumulators as
`anomalyMasteryPct` and `anomalyMasteryFlat`. Stored inventory and maintenance
inputs keep using `stat: "anomalyMastery", mode: "pct"` for percentage sources,
so existing user data does not require migration. Damage and optimizer paths
retain full precision. The Vue panel truncates only the displayed Anomaly
Mastery integer to match the game.

Phaethon's Melody contributes 8% Anomaly Mastery through its unconditional
2-piece effect. Alice at Core Skill F therefore has a white stat of `142`; a
30% slot-6 main stat plus Phaethon's Melody produces `195.96` internally and
`195` in the displayed panel.

## Effect Scope Rules

v1 applies out-of-combat effects with:

```text
scope === "outOfCombat" && condition === null
```

Drive Disc set effects use fixed defaults instead of storing those fields.
Ordinary 2-piece panel rules apply to the out-of-combat panel. A 2-piece rule
with `target.kind: "skill"` is instead injected as an in-combat event modifier
when the equipped set count reaches two; it never changes the displayed panel
and needs no active Buff ID. Four-piece effects are modeled as in-combat
effects and continue to use the active Buff ID/equipment validation path.

Team effects may set `exclusiveGroup`. When two active effects share a group,
only the first is resolved. Drive Disc application orders the current wearer's
effect before an external teammate copy, so Proto Punk's team damage bonus is
counted once and the ignored copy records `reason: "exclusiveGroup"`.

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

Resistance ignore is stored as a percentage stat but is not a panel stat in the
same sense as ATK or CRIT. Damage calculation consumes `allResIgnore` plus the
matching element-specific resistance-ignore stat for direct, anomaly,
disorder, and sheer events. This remains distinct from `enemyResReduction` and
the element-specific enemy resistance-reduction fields even though both values
reduce effective resistance in the final damage formula.

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
- Automatic trigger timing or rotation-derived uptime for conditional Drive
  Disc effects.
- Teammate and field buffs.
- Enemy weakness handling.
- Daze, stun windows, anomaly buildup, anomaly ownership weighting, polarity
  disorder, and multi-hit rotation totals.
- Data imports from external databases.
