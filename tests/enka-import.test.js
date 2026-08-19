import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import { createEmptyInventoryStore, normalizeInventoryStore } from "../core/inventory-model.js"
import {
  applyEnkaImportSnapshot,
  buildEnkaImportPlan,
  enkaBindingForOwner,
  enkaImportBaseMatches,
  enkaImportSnapshotMatches,
} from "../core/enka-import/import-plan.js"
import {
  buildDriveDiscSyncPlan,
  enkaDriveDiscId,
  enkaLoadoutId,
} from "../core/enka-import/drive-disc-plan.js"
import { mapShowcaseToCatalog } from "../core/enka-import/entity-mapping.js"
import { cinemaSkillBonus, parseEnkaShowcase } from "../core/enka-import/parse-enka.js"

const mapping = JSON.parse(await readFile(new URL("../data/enka_zzz_mapping.json", import.meta.url), "utf8"))
assert.equal(mapping.source.commit, "dc86b5dc06ad27d26c9a4df9f0b6ffd0417bf554")
const mappedEquipmentEntry = Object.entries(mapping.driveDiscEquipment)
  .find(([, entry]) => entry.rarity === "S" && entry.levelScale === 0.2)
const [knownEquipmentId, knownEquipment] = mappedEquipmentEntry
const catalog = {
  displayAgents: [
    { id: "hoshimi_miyabi", name: { zhCN: "星见雅" } },
    { id: "aria", name: { zhCN: "爱芮" } },
  ],
  displayWEngines: [{ id: "hailfall_star_palace", name: { zhCN: "霰落星殿" } }],
  displayDriveDiscSets: [{ id: knownEquipment.setId, name: { zhCN: knownEquipment.setName } }],
}

function makeSkillList(level = 10) {
  return [0, 1, 2, 3, 6].map(Index => ({ Index, Level: level }))
}

function makeRawDisc({ slot = 5, uid = "7038", equipmentId = knownEquipmentId, propertyId = "32303" } = {}) {
  return {
    Slot: slot,
    Equipment: {
      Id: Number(equipmentId),
      Uid: Number(uid),
      Level: 15,
      IsLocked: true,
      MainPropertyList: [{ PropertyId: Number(propertyId), PropertyLevel: 1, PropertyValue: 7.5 }],
      RandomPropertyList: [{ PropertyId: 20103, PropertyLevel: 2, PropertyValue: 2.4 }],
    },
  }
}

function makeAvatar(id, overrides = {}) {
  return {
    Id: id,
    Level: 60,
    TalentLevel: 0,
    CoreSkillEnhancement: 0,
    SkillLevelList: makeSkillList(),
    Weapon: { Id: 14109, Level: 0, UpgradeLevel: 2 },
    EquippedList: [],
    ...overrides,
  }
}

assert.equal(cinemaSkillBonus(0), 0)
assert.equal(cinemaSkillBonus(3), 2)
assert.equal(cinemaSkillBonus(5), 4)

const parsed = parseEnkaShowcase({
  PlayerInfo: {
    ShowcaseDetail: {
      AvatarList: [
        makeAvatar(1091),
        makeAvatar(1091, { TalentLevel: 3 }),
        makeAvatar(1091, { TalentLevel: 6, SkillLevelList: makeSkillList(12) }),
      ],
    },
  },
})
assert.equal(parsed.agents[0].coreSkillLevel, "none")
assert.equal(parsed.agents[0].wEngine.level, 0)
assert.deepEqual(parsed.agents[0].skillLevels, { basic: 10, special: 10, dodge: 10, chain: 10, assist: 10 })
assert.deepEqual(parsed.agents[1].skillLevels, { basic: 12, special: 12, dodge: 12, chain: 12, assist: 12 })
assert.deepEqual(parsed.agents[2].skillLevels, { basic: 16, special: 16, dodge: 16, chain: 16, assist: 16 })

const mapped = mapShowcaseToCatalog(
  parseEnkaShowcase({
    PlayerInfo: {
      ShowcaseDetail: {
        AvatarList: [makeAvatar(1091, {
          EquippedList: [makeRawDisc(), makeRawDisc({ slot: 6, uid: "7039", equipmentId: "999999" })],
        })],
      },
    },
  }),
  catalog,
  mapping,
  { uid: "1302309616" },
)
assert.equal(mapped.mappedAgents.length, 1)
assert.equal(mapped.mappedAgents[0].agentId, "hoshimi_miyabi")
assert.equal(mapped.mappedAgents[0].wEngine.id, "hailfall_star_palace")
assert.equal(mapped.mappedAgents[0].driveDiscPreset.driveDiscs.length, 1)
assert.equal(mapped.mappedAgents[0].driveDiscPreset.driveDiscs[0].id, "enka-zzz:1302309616:7038")
assert.equal(mapped.mappedAgents[0].driveDiscPreset.driveDiscs[0].mainStat.stat, "windDmg")
assert.equal(mapped.mappedAgents[0].driveDiscPreset.driveDiscs[0].mainStat.value, 30)
assert.deepEqual(
  mapped.mappedAgents[0].driveDiscPreset.driveDiscs[0].subStats.map(stat => [stat.stat, stat.value]),
  [["critRate", 4.8]],
)
assert.ok(mapped.warnings.some(warning => /6号位.*未导入/.test(warning)))
assert.notEqual(enkaDriveDiscId("1302309616", "7038"), enkaDriveDiscId("1300027938", "7038"))

function importedDisc(uid, equipmentUid, agentId, overrides = {}) {
  return {
    id: enkaDriveDiscId(uid, equipmentUid),
    setId: knownEquipment.setId,
    setName: knownEquipment.setName,
    partition: 1,
    rarity: "S",
    level: 15,
    maxLevel: 15,
    locked: true,
    equippedBy: agentId,
    mainStat: { stat: "hpFlat", value: 2200, mode: "flat", label: "生命值" },
    subStats: [{ stat: "critRate", value: 0.048, mode: "pct", label: "暴击率" }],
    source: { type: "enka-zzz-showcase", uid, agentId, equipmentUid },
    ...overrides,
  }
}

const uid = "1302309616"
const agentId = "hoshimi_miyabi"
const currentDisc = importedDisc(uid, "100", agentId, {
  level: 12,
  reservedForAgentId: "aria",
  excludedForAgentIds: ["yixuan"],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
})
const staleDisc = importedDisc(uid, "101", agentId, {
  id: enkaDriveDiscId(uid, "101"),
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
})
const driveStore = {
  ...createEmptyInventoryStore(),
  driveDiscs: [currentDisc, staleDisc],
  driveDiscLoadouts: [{
    id: enkaLoadoutId(uid, agentId),
    ownerId: "default",
    agentId,
    name: "自定义展示名",
    driveDiscIdsBySlot: { 1: currentDisc.id, 2: staleDisc.id },
    source: { type: "enka-zzz-showcase", uid, agentId },
  }],
}
const drivePlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    driveDiscSourceCount: 1,
    driveDiscPreset: { driveDiscs: [importedDisc(uid, "100", agentId)] },
  }],
  driveDiscState: { ownerId: "default", store: driveStore },
  now: new Date("2026-08-18T00:00:00.000Z"),
})
const updatedDisc = drivePlan.nextStore.driveDiscs.find(item => item.id === currentDisc.id)
assert.equal(updatedDisc.level, 15)
assert.equal(updatedDisc.reservedForAgentId, "aria")
assert.deepEqual(updatedDisc.excludedForAgentIds, ["yixuan"])
assert.equal(drivePlan.nextStore.driveDiscs.find(item => item.id === staleDisc.id).equippedBy, "")
assert.equal(drivePlan.unequippedDiscs, 1)
assert.deepEqual(drivePlan.nextStore.driveDiscLoadouts[0].driveDiscIdsBySlot, { 1: currentDisc.id })
assert.equal(drivePlan.nextStore.driveDiscLoadouts[0].name, "自定义展示名")
assert.equal(drivePlan.results[0].operations.updated.length, 1)
assert.equal(drivePlan.results[0].operations.unequipped.length, 1)

for (const preservedInventoryCase of [
  { label: "零盘", driveDiscSourceCount: 0 },
  { label: "全部映射失败", driveDiscSourceCount: 2 },
]) {
  const preservedInventoryPlan = buildDriveDiscSyncPlan({
    uid,
    mappedAgents: [{
      agentId,
      agentName: "星见雅",
      driveDiscSourceCount: preservedInventoryCase.driveDiscSourceCount,
      driveDiscPreset: null,
    }],
    driveDiscState: { ownerId: "default", store: driveStore },
    now: new Date("2026-08-18T00:15:00.000Z"),
  })
  assert.equal(preservedInventoryPlan.changed, false, preservedInventoryCase.label)
  assert.deepEqual(preservedInventoryPlan.nextStore.driveDiscs, driveStore.driveDiscs, preservedInventoryCase.label)
  assert.deepEqual(
    preservedInventoryPlan.nextStore.driveDiscLoadouts,
    driveStore.driveDiscLoadouts,
    preservedInventoryCase.label,
  )
  assert.equal(preservedInventoryPlan.unequippedDiscs, 0, preservedInventoryCase.label)
}

const scannerCanonicalId = "scanner-existing-canonical"
const scannerThenEnkaPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    driveDiscSourceCount: 1,
    driveDiscPreset: { driveDiscs: [importedDisc(uid, "300", agentId)] },
  }],
  driveDiscState: {
    ownerId: "default",
    store: {
      ...createEmptyInventoryStore(),
      driveDiscs: [{
        ...importedDisc(uid, "300", agentId),
        id: scannerCanonicalId,
        ownerId: "default",
        locked: false,
        equippedBy: null,
        reservedForAgentId: "aria",
        excludedForAgentIds: ["yixuan"],
        statUnitVersion: 2,
        subStats: [{ stat: "critRate", value: 4.8, mode: "pct", label: "暴击率" }],
        source: { type: "zzz-scanner", sequence: 4 },
      }],
    },
  },
  now: new Date("2026-08-18T00:30:00.000Z"),
})
assert.equal(scannerThenEnkaPlan.addedDiscs, 0)
assert.equal(scannerThenEnkaPlan.sourceMergedDiscs, 1)
assert.equal(scannerThenEnkaPlan.nextStore.driveDiscs[0].id, scannerCanonicalId)
assert.equal(scannerThenEnkaPlan.nextStore.driveDiscs[0].locked, true)
assert.equal(scannerThenEnkaPlan.nextStore.driveDiscs[0].equippedBy, agentId)
assert.equal(scannerThenEnkaPlan.nextStore.driveDiscs[0].reservedForAgentId, "aria")
assert.deepEqual(scannerThenEnkaPlan.nextStore.driveDiscs[0].excludedForAgentIds, ["yixuan"])
assert.ok(scannerThenEnkaPlan.nextStore.driveDiscs[0].provenance.enkaZzz)
assert.ok(scannerThenEnkaPlan.nextStore.driveDiscs[0].provenance.scanner)
assert.equal(
  scannerThenEnkaPlan.nextStore.driveDiscLoadouts[0].driveDiscIdsBySlot[1],
  scannerCanonicalId,
)
assert.deepEqual(scannerThenEnkaPlan.results[0].driveDiscIdsBySlot, { 1: scannerCanonicalId })
assert.equal(scannerThenEnkaPlan.nextStore.driveDiscLoadouts[0].name, "展柜佩戴套装 - 星见雅")

for (const legacyAutomaticName of ["Enka 当前装备", "Enka 当前装备 - 旧角色名"]) {
  const automaticNamePlan = buildDriveDiscSyncPlan({
    uid,
    mappedAgents: [{
      agentId,
      agentName: "星见雅",
      driveDiscSourceCount: 1,
      driveDiscPreset: { driveDiscs: [importedDisc(uid, "300", agentId)] },
    }],
    driveDiscState: {
      ownerId: "default",
      store: {
        ...scannerThenEnkaPlan.nextStore,
        driveDiscLoadouts: scannerThenEnkaPlan.nextStore.driveDiscLoadouts.map(loadout => ({
          ...loadout,
          name: legacyAutomaticName,
        })),
      },
    },
    now: new Date("2026-08-18T00:45:00.000Z"),
  })
  assert.equal(automaticNamePlan.nextStore.driveDiscLoadouts[0].name, "展柜佩戴套装 - 星见雅")
}

const legacyStore = {
  ...createEmptyInventoryStore(),
  driveDiscs: [{
    ...importedDisc(uid, "200", agentId),
    id: "enka-200",
    ownerId: "default",
    source: { type: "enka-showcase", agentId },
  }],
  driveDiscLoadouts: [{
    id: `enka-showcase-${agentId}`,
    ownerId: "default",
    agentId,
    name: "Enka 当前装备",
    driveDiscIdsBySlot: { 1: "enka-200" },
    source: { type: "enka-showcase", agentId },
  }],
}
delete legacyStore.driveDiscs[0].source
delete legacyStore.driveDiscs[0].statUnitVersion
const normalizedLegacyStore = normalizeInventoryStore(legacyStore)
assert.equal(normalizedLegacyStore.driveDiscs[0].subStats[0].value, 0.048)
assert.notEqual(normalizedLegacyStore.driveDiscs[0].statUnitVersion, 2)
const migrationPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{ agentId, agentName: "星见雅", driveDiscSourceCount: null, driveDiscPreset: null }],
  driveDiscState: { ownerId: "default", store: normalizedLegacyStore },
  now: new Date("2026-08-18T00:00:00.000Z"),
})
assert.equal(migrationPlan.migratedDiscs, 1)
assert.equal(migrationPlan.nextStore.driveDiscs[0].id, enkaDriveDiscId(uid, "200"))
assert.equal(migrationPlan.nextStore.driveDiscs[0].subStats[0].value, 4.8)
assert.equal(migrationPlan.nextStore.driveDiscs[0].statUnitVersion, 2)
assert.equal(migrationPlan.nextStore.driveDiscLoadouts[0].id, enkaLoadoutId(uid, agentId))
assert.equal(migrationPlan.nextStore.driveDiscLoadouts[0].driveDiscIdsBySlot[1], enkaDriveDiscId(uid, "200"))
assert.equal(migrationPlan.results[0].operations.migratedDiscs.length, 1)
assert.equal(migrationPlan.results[0].operations.migratedLoadouts.length, 1)

const duplicateMigrationPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{ agentId, agentName: "星见雅", driveDiscSourceCount: null, driveDiscPreset: null }],
  driveDiscState: {
    ownerId: "default",
    store: {
      ...legacyStore,
      driveDiscLoadouts: [
        ...legacyStore.driveDiscLoadouts,
        {
          id: enkaLoadoutId(uid, agentId),
          ownerId: "default",
          agentId,
          name: "已迁移配装",
          driveDiscIdsBySlot: {},
          source: { type: "enka-zzz-showcase", uid, agentId },
        },
      ],
    },
  },
  now: new Date("2026-08-18T00:00:00.000Z"),
})
assert.equal(duplicateMigrationPlan.nextStore.driveDiscLoadouts.length, 1)
assert.equal(duplicateMigrationPlan.nextStore.driveDiscLoadouts[0].name, "已迁移配装")
assert.equal(duplicateMigrationPlan.nextStore.driveDiscLoadouts[0].driveDiscIdsBySlot[1], enkaDriveDiscId(uid, "200"))

const baseStore = createEmptyInventoryStore()
const existingMiyabi = {
  agentLevel: 50,
  cinemaLevel: 1,
  wEngineId: "old-engine",
  selectedOptimizedRank: 9,
  manualDriveDiscIdsBySlot: { 1: "manual-1" },
  lastAnomalySourceSnapshot: { hash: "keep" },
  combat: { activeBuffIds: ["buff-a"], runtimeInputs: { a: 1 } },
  damage: { events: [{ id: "custom-event" }], target: { defense: 123 }, skillLevelsByCategory: { basic: 8 } },
  skillLevelsByCategory: { basic: 7 },
  damageConfig: { legacyOption: "keep", skillLevelsByCategory: { basic: 6 } },
}
const buildSelection = {
  version: 2,
  currentOwnerId: "default",
  byOwner: { default: { currentAgentId: agentId, byAgent: { [agentId]: existingMiyabi } } },
}
const legacySelection = structuredClone(buildSelection)
legacySelection.byOwner.default.byAgent[agentId].legacyOnly = { preserved: true }
const selectedAgents = [
  {
    agentId,
    agentName: "星见雅",
    agentLevel: 60,
    cinemaLevel: 6,
    coreSkillLevel: "F",
    skillLevels: { basic: 16, special: 16 },
    wEngine: null,
    driveDiscSourceCount: 0,
    driveDiscPreset: null,
  },
  {
    agentId: "aria",
    agentName: "爱芮",
    agentLevel: 55,
    cinemaLevel: 2,
    coreSkillLevel: "D",
    skillLevels: { basic: 12 },
    wEngine: { id: "aria-engine", level: 0, modificationLevel: 1 },
    driveDiscSourceCount: null,
    driveDiscPreset: null,
  },
]
const importPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: selectedAgents,
  store: baseStore,
  ownerId: "default",
  buildSelection,
  legacySelection,
  now: new Date("2026-08-18T01:00:00.000Z"),
  transactionId: "tx-1",
})
const nextMiyabi = importPlan.nextBuildSelection.byOwner.default.byAgent[agentId]
assert.equal(nextMiyabi.agentLevel, 60)
assert.equal(nextMiyabi.wEngineId, "old-engine")
assert.deepEqual(nextMiyabi.combat, existingMiyabi.combat)
assert.deepEqual(nextMiyabi.damage.events, existingMiyabi.damage.events)
assert.deepEqual(nextMiyabi.damage.target, existingMiyabi.damage.target)
assert.deepEqual(nextMiyabi.manualDriveDiscIdsBySlot, { 1: "manual-1" })
assert.deepEqual(nextMiyabi.lastAnomalySourceSnapshot, { hash: "keep" })
assert.deepEqual(nextMiyabi.damage.skillLevelsByCategory, { basic: 16, special: 16 })
assert.deepEqual(nextMiyabi.skillLevelsByCategory, { basic: 16, special: 16 })
assert.deepEqual(nextMiyabi.damageConfig, {
  legacyOption: "keep",
  skillLevelsByCategory: { basic: 16, special: 16 },
})
assert.deepEqual(importPlan.nextLegacySelection.byOwner.default.byAgent[agentId].legacyOnly, { preserved: true })
assert.equal(importPlan.nextBuildSelection.byOwner.default.byAgent.aria.wEngineLevel, 0)
assert.equal(enkaBindingForOwner(importPlan.nextStore, "default").uid, uid)
assert.equal(importPlan.nextStore.enkaImportState.byOwner.default.undoJournal.status, "prepared")
assert.equal(importPlan.agents.length, 2)

const dependencyStore = normalizeInventoryStore({
  ...scannerThenEnkaPlan.nextStore,
  driveDiscs: [
    ...scannerThenEnkaPlan.nextStore.driveDiscs,
    {
      ...importedDisc(uid, "manual-old", agentId),
      id: "manual-old",
      ownerId: "default",
      partition: 5,
      setId: "manual-set-a",
      setName: "手动套装 A",
      source: { type: "manual" },
    },
    {
      ...importedDisc(uid, "manual-clear", agentId),
      id: "manual-clear",
      ownerId: "default",
      partition: 6,
      setId: "manual-set-b",
      setName: "手动套装 B",
      source: { type: "manual" },
    },
  ],
  driveDiscLoadouts: [
    ...scannerThenEnkaPlan.nextStore.driveDiscLoadouts,
    {
      id: "previous-loadout",
      ownerId: "default",
      agentId,
      name: "原套装",
      driveDiscIdsBySlot: { 1: "manual-old", 2: "manual-clear" },
    },
  ],
})
const manualBefore = { 1: "manual-old", 2: "manual-clear" }
const dependencySelection = {
  version: 2,
  currentOwnerId: "default",
  byOwner: {
    default: {
      currentAgentId: agentId,
      byAgent: {
        [agentId]: {
          discMode: "manual",
          selectedLoadoutId: "previous-loadout",
          manualDriveDiscIdsBySlot: manualBefore,
          manualDriveDiscsBySlot: manualBefore,
          driveDiscIdsBySlot: manualBefore,
        },
      },
    },
  },
}
const canonicalManualPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    wEngine: null,
    driveDiscSourceCount: 6,
    driveDiscPreset: { driveDiscs: [importedDisc(uid, "300", agentId)] },
  }],
  store: dependencyStore,
  ownerId: "default",
  buildSelection: dependencySelection,
  legacySelection: structuredClone(dependencySelection),
  now: new Date("2026-08-18T02:00:00.000Z"),
  transactionId: "tx-canonical-manual",
})
const canonicalManualConfig = canonicalManualPlan.nextBuildSelection.byOwner.default.byAgent[agentId]
const expectedCanonicalManual = { 1: scannerCanonicalId }
assert.deepEqual(canonicalManualConfig.manualDriveDiscIdsBySlot, expectedCanonicalManual)
assert.deepEqual(canonicalManualConfig.manualDriveDiscsBySlot, expectedCanonicalManual)
assert.deepEqual(canonicalManualConfig.driveDiscIdsBySlot, expectedCanonicalManual)
assert.equal(canonicalManualConfig.discMode, "loadout")
assert.equal(canonicalManualConfig.selectedLoadoutId, enkaLoadoutId(uid, agentId))
assert.deepEqual(canonicalManualPlan.drivePlan.results[0].driveDiscIdsBySlot, expectedCanonicalManual)
const manualPreview = canonicalManualPlan.agents[0].changes.find(change => change.label === "自选套装")
assert.equal(manualPreview.before, "原 2/6")
assert.equal(manualPreview.after, "展柜 1/6（清空 2 号位）")
assert.deepEqual(manualPreview.clearedSlots, [2])
assert.deepEqual(canonicalManualPlan.journal.changedDriveDiscIds, [])
assert.deepEqual(canonicalManualPlan.journal.changedLoadoutIds, [])
assert.ok(canonicalManualPlan.journal.affectedDriveDiscIds.includes("manual-old"))
assert.ok(canonicalManualPlan.journal.affectedDriveDiscIds.includes("manual-clear"))
assert.ok(canonicalManualPlan.journal.affectedDriveDiscIds.includes(scannerCanonicalId))
assert.ok(canonicalManualPlan.journal.affectedLoadoutIds.includes("previous-loadout"))
assert.ok(canonicalManualPlan.journal.affectedLoadoutIds.includes(enkaLoadoutId(uid, agentId)))
assert.equal(
  canonicalManualPlan.changeCount,
  canonicalManualPlan.agents[0].changes.length + 1,
)
assert.ok(enkaImportSnapshotMatches({
  store: canonicalManualPlan.nextStore,
  buildSelection: canonicalManualPlan.nextBuildSelection,
  legacySelection: canonicalManualPlan.nextLegacySelection,
  journal: canonicalManualPlan.journal,
}, "after"))
const dependencyChangedStore = structuredClone(canonicalManualPlan.nextStore)
dependencyChangedStore.driveDiscs.find(disc => disc.id === "manual-old").locked = false
assert.equal(enkaImportSnapshotMatches({
  store: dependencyChangedStore,
  buildSelection: canonicalManualPlan.nextBuildSelection,
  legacySelection: canonicalManualPlan.nextLegacySelection,
  journal: canonicalManualPlan.journal,
}, "after"), false)
const canonicalManualUndone = applyEnkaImportSnapshot({
  store: canonicalManualPlan.nextStore,
  buildSelection: canonicalManualPlan.nextBuildSelection,
  legacySelection: canonicalManualPlan.nextLegacySelection,
  journal: canonicalManualPlan.journal,
}, "before")
assert.deepEqual(
  canonicalManualUndone.buildSelection.byOwner.default.byAgent[agentId],
  dependencySelection.byOwner.default.byAgent[agentId],
)

for (const preservedDriveCase of [
  { label: "零盘", driveDiscSourceCount: 0 },
  { label: "全部映射失败", driveDiscSourceCount: 2 },
]) {
  const preservedPlan = buildEnkaImportPlan({
    uid,
    mappedAgents: [{
      agentId,
      agentName: "星见雅",
      wEngine: null,
      driveDiscSourceCount: preservedDriveCase.driveDiscSourceCount,
      driveDiscPreset: null,
    }],
    store: createEmptyInventoryStore(),
    ownerId: "default",
    buildSelection: dependencySelection,
    legacySelection: structuredClone(dependencySelection),
    now: new Date("2026-08-18T02:10:00.000Z"),
    transactionId: `tx-preserve-${preservedDriveCase.driveDiscSourceCount}`,
  })
  const config = preservedPlan.nextBuildSelection.byOwner.default.byAgent[agentId]
  assert.deepEqual(config.manualDriveDiscIdsBySlot, manualBefore, preservedDriveCase.label)
  assert.equal(config.discMode, "manual", preservedDriveCase.label)
  assert.equal(config.selectedLoadoutId, "previous-loadout", preservedDriveCase.label)
}

const conflictingScannerDisc = normalizeInventoryStore({
  ...createEmptyInventoryStore(),
  driveDiscs: [{
    ...importedDisc(uid, "scanner-shape", agentId),
    id: "scanner-shape",
    ownerId: "default",
    level: 10,
    maxLevel: 15,
    statUnitVersion: 2,
    source: { type: "zzz-scanner", sequence: 1 },
    subStats: [{ stat: "critRate", value: 2.4, mode: "pct", label: "暴击率" }],
  }],
})
const distinctDiscPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    wEngine: null,
    driveDiscSourceCount: 1,
    driveDiscPreset: { driveDiscs: [importedDisc(uid, "conflict-enka", agentId)] },
  }],
  store: conflictingScannerDisc,
  ownerId: "default",
  buildSelection: dependencySelection,
  legacySelection: structuredClone(dependencySelection),
  now: new Date("2026-08-18T02:20:00.000Z"),
  transactionId: "tx-distinct-disc",
})
assert.equal(distinctDiscPlan.hasUnresolvedConflicts, false)
assert.equal(distinctDiscPlan.drivePlan.results[0].hasUsableLoadout, true)
assert.equal(distinctDiscPlan.drivePlan.results[0].operations.added.length, 1)
assert.equal(distinctDiscPlan.drivePlan.results[0].operations.conflicts?.length ?? 0, 0)
assert.deepEqual(
  distinctDiscPlan.nextBuildSelection.byOwner.default.byAgent[agentId].manualDriveDiscIdsBySlot,
  { 1: enkaDriveDiscId(uid, "conflict-enka") },
)
assert.equal(distinctDiscPlan.nextBuildSelection.byOwner.default.byAgent[agentId].discMode, "loadout")
const mirrorOnlySelection = {
  version: 2,
  currentOwnerId: "default",
  byOwner: {
    default: {
      currentAgentId: agentId,
      byAgent: {
        [agentId]: {
          skillLevels: { basic: 12 },
          damage: { skillLevelsByCategory: { basic: 8 } },
        },
      },
    },
  },
}
const mirrorOnlyPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    skillLevels: { basic: 12 },
    wEngine: null,
    driveDiscSourceCount: 0,
    driveDiscPreset: null,
  }],
  store: createEmptyInventoryStore(),
  ownerId: "default",
  buildSelection: mirrorOnlySelection,
  legacySelection: structuredClone(mirrorOnlySelection),
  now: new Date("2026-08-18T01:30:00.000Z"),
  transactionId: "tx-mirror-preview",
})
assert.ok(mirrorOnlyPlan.agents[0].changes.some(change => change.label === "技能等级同步"))
assert.deepEqual(
  mirrorOnlyPlan.nextBuildSelection.byOwner.default.byAgent[agentId].damage.skillLevelsByCategory,
  { basic: 12 },
)
assert.ok(enkaImportSnapshotMatches({
  store: importPlan.nextStore,
  buildSelection: importPlan.nextBuildSelection,
  legacySelection: importPlan.nextLegacySelection,
  journal: importPlan.journal,
}, "after"))
assert.ok(enkaImportBaseMatches({
  store: baseStore,
  buildSelection,
  legacySelection,
  journal: importPlan.journal,
}))
const unrelatedStoreChange = structuredClone(baseStore)
unrelatedStoreChange.owners[0].label = "并发修改"
assert.equal(enkaImportBaseMatches({
  store: unrelatedStoreChange,
  buildSelection,
  legacySelection,
  journal: importPlan.journal,
}), false)

const undone = applyEnkaImportSnapshot({
  store: importPlan.nextStore,
  buildSelection: importPlan.nextBuildSelection,
  legacySelection: importPlan.nextLegacySelection,
  journal: importPlan.journal,
}, "before")
assert.deepEqual(undone.buildSelection.byOwner.default.byAgent[agentId], existingMiyabi)
assert.equal(undone.buildSelection.byOwner.default.byAgent.aria, undefined)
assert.equal(enkaBindingForOwner(undone.store, "default"), null)

assert.throws(() => buildEnkaImportPlan({
  uid: "1300027938",
  mappedAgents: selectedAgents,
  store: importPlan.nextStore,
  ownerId: "default",
  buildSelection: importPlan.nextBuildSelection,
  legacySelection: importPlan.nextLegacySelection,
}), error => error?.code === "UID_BINDING_MISMATCH")

console.log("enka-import.test.js: all assertions passed")
