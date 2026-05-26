# Zenless Zone Zero v1 Modeling

## Scope

v1 models an out-of-combat panel first, then an optional in-combat panel layer:

1. Agent base stats are fixed at level 60.
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
7. Final damage, enemy defense, resistance, stun, skill multipliers, anomaly,
   disorder, and rotation logic are still out of scope.

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
  twoPiece?: Effect;
  fourPiece?: Effect;
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

interface Effect {
  scope: "outOfCombat" | "inCombat";
  condition: string | null;
  stats: Array<{
    stat: ZzzStat;
    value: number;
    mode: "flat" | "pct";
    basis?: "baseHp" | "outOfCombatHp" | "baseAtk" | "outOfCombatAtk" | "baseDef" | "outOfCombatDef";
  }>;
}

interface CombatBuff {
  id: string;
  hidden?: boolean;
  sourceType: "self" | "teammate" | "driveDisc4pc" | "boss" | "field" | "manual";
  name: { zhCN?: string; en?: string };
  conditionLabel?: string | null;
  scope: "inCombat";
  stats: Effect["stats"];
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
      basis: {
        base: Record<string, number>;
        outOfCombatPanel: Record<string, number>;
      };
    };
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

If a percentage HP/ATK/DEF Buff does not provide `basis`, the default is the
corresponding base stat. The frontend manual correction area exposes both
base-attack percentage and out-of-combat-attack percentage because they are
different Buff semantics.

`dmgBonus` and elemental damage bonuses are displayed separately even though
they will later share a damage multiplier bucket. CRIT Rate is not capped in
the panel layer; any future expectation formula should cap it inside the damage
calculation, not here.

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

v1 applies only effects with:

```text
scope === "outOfCombat" && condition === null
```

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

## Explicitly Deferred

- Character levels other than 60.
- Skill multipliers and core passive damage scaling.
- Mindscape Cinema.
- Conditional W-Engine passives.
- Conditional Drive Disc 4-piece effects.
- Teammate and field buffs.
- Enemy defense, resistance, weakness, and stun multipliers.
- Daze, stun windows, anomaly buildup, anomaly damage, and disorder.
- Data imports from external databases.
