import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  buildScannerImportPlan,
  createEmptyInventoryStore,
  normalizeInventoryStore,
  upsertDriveDisc,
} from "../core/inventory-model.js"
import {
  applyEnkaImportSnapshot,
  backfillEnkaImportHistory,
  buildEnkaRebindPlan,
  buildEnkaImportPlan,
  enkaBindingForOwner,
  enkaRebindEligibility,
  enkaImportBaseMatches,
  enkaImportHistoryForOwner,
  enkaImportSnapshotMatches,
  markEnkaImportCommitted,
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

const mappedUnknownStat = mapShowcaseToCatalog(
  parseEnkaShowcase({
    PlayerInfo: {
      ShowcaseDetail: {
        AvatarList: [makeAvatar(1091, {
          EquippedList: [makeRawDisc({ uid: "7040", propertyId: "999999" })],
        })],
      },
    },
  }),
  catalog,
  mapping,
  { uid: "1302309616" },
)
assert.equal(mappedUnknownStat.mappedAgents[0].driveDiscPreset.driveDiscs.length, 1)
assert.equal(mappedUnknownStat.mappedAgents[0].driveDiscPreset.driveDiscs[0].mainStat.stat, "unknown")
assert.equal(mappedUnknownStat.mappedAgents[0].driveDiscPreset.driveDiscs[0].mainStat.raw.propertyId, "999999")
assert.ok(mappedUnknownStat.warnings.some(warning => /未知词条 PropertyId 999999.*不会参与属性计算/.test(warning)))

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
    updatedAt: "2026-08-01T00:00:00.000Z",
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
assert.equal(drivePlan.nextStore.driveDiscLoadouts[0].updatedAt, "2026-08-18T00:00:00.000Z")
assert.equal(drivePlan.results[0].operations.updated.length, 1)
assert.equal(drivePlan.results[0].operations.unequipped.length, 1)

const movedDisc = importedDisc(uid, "move-100", agentId, {
  ownerId: "default",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
})
const previousSystemLoadoutId = enkaLoadoutId(uid, agentId)
const customLoadoutId = "user-custom-loadout"
const movedPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{
    agentId: "aria",
    agentName: "爱芮",
    driveDiscSourceCount: 1,
    driveDiscPreset: { driveDiscs: [importedDisc(uid, "move-100", "aria")] },
  }],
  driveDiscState: {
    ownerId: "default",
    store: {
      ...createEmptyInventoryStore(),
      driveDiscs: [movedDisc],
      driveDiscLoadouts: [{
        id: previousSystemLoadoutId,
        ownerId: "default",
        agentId,
        name: "展柜佩戴套装 - 星见雅",
        driveDiscIdsBySlot: { 1: movedDisc.id },
        source: { type: "enka-zzz-showcase", uid, agentId },
      }, {
        id: customLoadoutId,
        ownerId: "default",
        agentId,
        name: "用户自定义套装",
        driveDiscIdsBySlot: { 1: movedDisc.id },
        source: { type: "manual" },
      }],
    },
  },
  now: new Date("2026-08-18T00:10:00.000Z"),
})
assert.equal(movedPlan.hasBlockingErrors, false)
assert.equal(movedPlan.nextStore.driveDiscs.length, 1)
assert.equal(movedPlan.nextStore.driveDiscs[0].id, movedDisc.id)
assert.equal(movedPlan.nextStore.driveDiscs[0].equippedBy, "aria")
assert.ok(!movedPlan.nextStore.driveDiscLoadouts.some(loadout => loadout.id === previousSystemLoadoutId))
assert.ok(movedPlan.nextStore.driveDiscLoadouts.some(loadout => loadout.id === customLoadoutId))
assert.ok(movedPlan.nextStore.driveDiscLoadouts.some(loadout => loadout.id === enkaLoadoutId(uid, "aria")))
assert.deepEqual(movedPlan.deletedLoadoutIds, [previousSystemLoadoutId])
assert.deepEqual(movedPlan.removedLoadoutDiscReferences, [{
  loadoutId: previousSystemLoadoutId,
  agentId,
  driveDiscId: movedDisc.id,
  slots: ["1"],
}])

const missingPreviousAgentDisc = structuredClone(movedDisc)
delete missingPreviousAgentDisc.source.agentId
const missingPreviousAgentPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{
    agentId: "aria",
    agentName: "爱芮",
    driveDiscSourceCount: 1,
    driveDiscPreset: { driveDiscs: [importedDisc(uid, "move-100", "aria")] },
  }],
  driveDiscState: {
    ownerId: "default",
    store: {
      ...createEmptyInventoryStore(),
      driveDiscs: [missingPreviousAgentDisc],
      driveDiscLoadouts: [{
        id: previousSystemLoadoutId,
        ownerId: "default",
        agentId,
        driveDiscIdsBySlot: { 1: movedDisc.id },
        source: { type: "enka-zzz-showcase", uid, agentId },
      }],
    },
  },
  now: new Date("2026-08-18T00:11:00.000Z"),
})
assert.equal(missingPreviousAgentPlan.hasBlockingErrors, false)
assert.deepEqual(missingPreviousAgentPlan.deletedLoadoutIds, [previousSystemLoadoutId])
assert.ok(!missingPreviousAgentPlan.nextStore.driveDiscLoadouts.some(loadout => loadout.id === previousSystemLoadoutId))
assert.ok(missingPreviousAgentPlan.nextStore.driveDiscLoadouts.some(loadout => loadout.id === enkaLoadoutId(uid, "aria")))

const crossAgentIdentityPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    driveDiscSourceCount: 1,
    driveDiscPreset: { driveDiscs: [importedDisc(uid, "shared-in-response", agentId)] },
  }, {
    agentId: "aria",
    agentName: "爱芮",
    driveDiscSourceCount: 1,
    driveDiscPreset: { driveDiscs: [importedDisc(uid, "shared-in-response", "aria")] },
  }],
  driveDiscState: { ownerId: "default", store: driveStore },
  now: new Date("2026-08-18T00:12:00.000Z"),
})
assert.equal(crossAgentIdentityPlan.changed, false)
assert.equal(crossAgentIdentityPlan.hasBlockingErrors, true)
assert.equal(crossAgentIdentityPlan.blockingErrors[0].code, "ENKA_EQUIPMENT_IDENTITY_CONFLICT")
assert.deepEqual(crossAgentIdentityPlan.nextStore, driveStore)

const mismatchedDiscUidPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    driveDiscSourceCount: 1,
    driveDiscPreset: { driveDiscs: [importedDisc("1300027938", "wrong-source", agentId)] },
  }],
  driveDiscState: { ownerId: "default", store: driveStore },
  now: new Date("2026-08-18T00:13:00.000Z"),
})
assert.equal(mismatchedDiscUidPlan.hasBlockingErrors, true)
assert.equal(mismatchedDiscUidPlan.blockingErrors[0].code, "ENKA_DISC_UID_MISMATCH")
assert.deepEqual(mismatchedDiscUidPlan.nextStore, driveStore)

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
const crossUidLegacyStore = structuredClone(legacyStore)
crossUidLegacyStore.driveDiscs[0].source.uid = "1300027938"
crossUidLegacyStore.driveDiscLoadouts[0].source.uid = "1300027938"
const normalizedCrossUidLegacyStore = normalizeInventoryStore(crossUidLegacyStore)
const crossUidLegacyPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{ agentId, agentName: "星见雅", driveDiscSourceCount: null, driveDiscPreset: null }],
  driveDiscState: { ownerId: "default", store: normalizedCrossUidLegacyStore },
  now: new Date("2026-08-18T00:00:00.000Z"),
})
assert.equal(crossUidLegacyPlan.hasBlockingErrors, true)
assert.deepEqual(
  new Set(crossUidLegacyPlan.blockingErrors.map(error => error.code)),
  new Set(["LEGACY_ENKA_UID_MISMATCH"]),
)
assert.deepEqual(
  new Set(crossUidLegacyPlan.blockingErrors.map(error => error.details.kind)),
  new Set(["driveDisc", "loadout"]),
)
assert.equal(crossUidLegacyPlan.migratedDiscs, 0)
assert.equal(crossUidLegacyPlan.migratedLoadouts, 0)
assert.deepEqual(crossUidLegacyPlan.nextStore, normalizedCrossUidLegacyStore)

const untrustedLegacyStore = structuredClone(legacyStore)
delete untrustedLegacyStore.driveDiscs[0].source
delete untrustedLegacyStore.driveDiscs[0].statUnitVersion
untrustedLegacyStore.driveDiscLoadouts[0].source = { type: "manual" }
const normalizedLegacyStore = normalizeInventoryStore(untrustedLegacyStore)
assert.equal(normalizedLegacyStore.driveDiscs[0].subStats[0].value, 0.048)
assert.notEqual(normalizedLegacyStore.driveDiscs[0].statUnitVersion, 2)
const untrustedMigrationPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{ agentId, agentName: "星见雅", driveDiscSourceCount: null, driveDiscPreset: null }],
  driveDiscState: { ownerId: "default", store: normalizedLegacyStore },
  now: new Date("2026-08-18T00:00:00.000Z"),
})
assert.equal(untrustedMigrationPlan.migratedDiscs, 0)
assert.equal(untrustedMigrationPlan.migratedLoadouts, 0)
assert.equal(untrustedMigrationPlan.nextStore.driveDiscs[0].id, "enka-200")
assert.equal(untrustedMigrationPlan.nextStore.driveDiscLoadouts[0].id, `enka-showcase-${agentId}`)

const migrationPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{ agentId, agentName: "星见雅", driveDiscSourceCount: null, driveDiscPreset: null }],
  driveDiscState: { ownerId: "default", store: legacyStore },
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

const unversionedPercentEnkaDisc = importedDisc(uid, "unit-4.8", agentId, {
  mainStat: { stat: "windDmg", value: 30, mode: "pct", label: "风属性伤害加成" },
  subStats: [
    { stat: "critRate", value: 0.048, mode: "pct", label: "暴击率" },
    { stat: "critDmg", value: 9.6, mode: "pct", label: "暴击伤害" },
  ],
})
delete unversionedPercentEnkaDisc.statUnitVersion
const normalizedUnversionedPercentStore = normalizeInventoryStore({
  ...createEmptyInventoryStore(),
  driveDiscs: [unversionedPercentEnkaDisc],
})
assert.equal(normalizedUnversionedPercentStore.driveDiscs[0].mainStat.value, 30)
assert.deepEqual(
  normalizedUnversionedPercentStore.driveDiscs[0].subStats.map(stat => stat.value),
  [4.8, 9.6],
)
assert.equal(normalizedUnversionedPercentStore.driveDiscs[0].statUnitVersion, 2)

const corruptedVersionTwoEnkaStore = normalizeInventoryStore({
  ...createEmptyInventoryStore(),
  driveDiscs: [importedDisc(uid, "unit-corrupted", agentId, {
    statUnitVersion: 2,
    mainStat: { stat: "windDmg", value: 3000, mode: "pct", label: "风属性伤害加成" },
    subStats: [
      { stat: "critRate", value: 480, mode: "pct", label: "暴击率" },
      { stat: "critDmg", value: 9.6, mode: "pct", label: "暴击伤害" },
    ],
  })],
})
assert.equal(corruptedVersionTwoEnkaStore.driveDiscs[0].mainStat.value, 30)
assert.equal(corruptedVersionTwoEnkaStore.driveDiscs[0].subStats[0].value, 4.8)
assert.equal(corruptedVersionTwoEnkaStore.driveDiscs[0].subStats[1].value, 9.6)
assert.equal(corruptedVersionTwoEnkaStore.driveDiscs[0].statUnitVersion, 2)
const renormalizedVersionTwoEnkaStore = normalizeInventoryStore(corruptedVersionTwoEnkaStore)
assert.deepEqual(renormalizedVersionTwoEnkaStore.driveDiscs[0], corruptedVersionTwoEnkaStore.driveDiscs[0])

const alreadyBoundLegacyPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{ agentId, agentName: "星见雅", driveDiscSourceCount: null, driveDiscPreset: null }],
  driveDiscState: {
    ownerId: "default",
    store: {
      ...legacyStore,
      enkaImportState: {
        version: 1,
        byOwner: { default: { binding: { uid, boundAt: "2026-08-17T00:00:00.000Z" } } },
      },
    },
  },
  now: new Date("2026-08-18T00:00:00.000Z"),
})
assert.equal(alreadyBoundLegacyPlan.migratedDiscs, 0)
assert.equal(alreadyBoundLegacyPlan.migratedLoadouts, 0)
assert.equal(alreadyBoundLegacyPlan.nextStore.driveDiscs[0].id, "enka-200")

const alreadyBoundCrossUidPlan = buildDriveDiscSyncPlan({
  uid,
  mappedAgents: [{ agentId, agentName: "星见雅", driveDiscSourceCount: null, driveDiscPreset: null }],
  driveDiscState: {
    ownerId: "default",
    store: {
      ...normalizedCrossUidLegacyStore,
      enkaImportState: {
        version: 1,
        byOwner: { default: { binding: { uid, boundAt: "2026-08-17T00:00:00.000Z" } } },
      },
    },
  },
  now: new Date("2026-08-18T00:00:00.000Z"),
})
assert.equal(alreadyBoundCrossUidPlan.hasBlockingErrors, false)
assert.equal(alreadyBoundCrossUidPlan.migratedDiscs, 0)
assert.equal(alreadyBoundCrossUidPlan.migratedLoadouts, 0)
assert.equal(alreadyBoundCrossUidPlan.nextStore.driveDiscs[0].id, "enka-200")
assert.equal(alreadyBoundCrossUidPlan.nextStore.driveDiscs[0].source.uid, "1300027938")

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
    sourceUid: uid,
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
    sourceUid: uid,
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
const firstImportHistory = enkaImportHistoryForOwner(importPlan.nextStore, "default")
assert.deepEqual(Object.keys(firstImportHistory.byAgent).sort(), ["aria", agentId].sort())
assert.equal(firstImportHistory.byAgent[agentId].agentName, "星见雅")
assert.equal(firstImportHistory.byAgent[agentId].completeness, "full")
assert.equal(firstImportHistory.byAgent[agentId].firstImportedAt, "2026-08-18T01:00:00.000Z")
assert.equal(firstImportHistory.byAgent[agentId].lastImportedAt, "2026-08-18T01:00:00.000Z")
assert.equal(firstImportHistory.byAgent[agentId].snapshot.agentLevel, 60)
assert.equal(firstImportHistory.byAgent[agentId].snapshot.coreSkillLevel, 6)
assert.equal(firstImportHistory.byAgent[agentId].snapshot.driveDiscCount, 0)
assert.equal(firstImportHistory.byAgent.aria.snapshot.wEngine, null)
assert.deepEqual(importPlan.journal.before.inventory.history, null)
assert.deepEqual(importPlan.journal.after.inventory.history, importPlan.nextStore.enkaImportState.byOwner.default.history)

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
          loadoutId: "previous-loadout",
          manualDriveDiscIdsBySlot: manualBefore,
          manualDriveDiscsBySlot: manualBefore,
          driveDiscIdsBySlot: manualBefore,
        },
      },
    },
  },
}
const dependencyLegacySelection = structuredClone(dependencySelection)
delete dependencyLegacySelection.byOwner.default.byAgent[agentId].loadoutId
const canonicalManualPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    sourceUid: uid,
    wEngine: null,
    driveDiscSourceCount: 6,
    driveDiscPreset: { driveDiscs: [importedDisc(uid, "300", agentId)] },
  }],
  store: dependencyStore,
  ownerId: "default",
  buildSelection: dependencySelection,
  legacySelection: dependencyLegacySelection,
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
assert.equal(canonicalManualConfig.loadoutId, enkaLoadoutId(uid, agentId))
assert.equal(
  Object.prototype.hasOwnProperty.call(
    canonicalManualPlan.nextLegacySelection.byOwner.default.byAgent[agentId],
    "loadoutId",
  ),
  false,
)
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
      sourceUid: uid,
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
    sourceUid: uid,
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
    sourceUid: uid,
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

const invalidUidPlan = buildEnkaImportPlan({
  uid: "12abc",
  mappedAgents: selectedAgents,
  store: baseStore,
  ownerId: "default",
  buildSelection,
  legacySelection,
  transactionId: "tx-invalid-uid",
})
assert.equal(invalidUidPlan.hasBlockingErrors, true)
assert.equal(invalidUidPlan.blockingErrors[0].code, "INVALID_GAME_UID")
assert.equal(invalidUidPlan.journal, null)
assert.deepEqual(invalidUidPlan.nextStore, baseStore)

const invalidUidOnBoundOwnerPlan = buildEnkaImportPlan({
  uid: "12abc",
  mappedAgents: selectedAgents,
  store: importPlan.nextStore,
  ownerId: "default",
  buildSelection: importPlan.nextBuildSelection,
  legacySelection: importPlan.nextLegacySelection,
  transactionId: "tx-invalid-uid-bound-owner",
})
assert.equal(invalidUidOnBoundOwnerPlan.hasBlockingErrors, true)
assert.deepEqual(
  invalidUidOnBoundOwnerPlan.blockingErrors.map(error => error.code),
  ["INVALID_GAME_UID"],
)
assert.equal(invalidUidOnBoundOwnerPlan.journal, null)

const agentUidMismatchPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{ ...selectedAgents[0], sourceUid: "1300027938" }],
  store: baseStore,
  ownerId: "default",
  buildSelection,
  legacySelection,
  transactionId: "tx-agent-uid-mismatch",
})
assert.equal(agentUidMismatchPlan.blockingErrors[0].code, "AGENT_SOURCE_UID_MISMATCH")
assert.equal(agentUidMismatchPlan.hasUnresolvedConflicts, true)

const agentUidMissingPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{ ...selectedAgents[0], sourceUid: undefined }],
  store: baseStore,
  ownerId: "default",
  buildSelection,
  legacySelection,
  transactionId: "tx-agent-uid-missing",
})
assert.equal(agentUidMissingPlan.blockingErrors[0].code, "AGENT_SOURCE_UID_MISSING")

const discUidMismatchPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    sourceUid: uid,
    driveDiscSourceCount: 1,
    driveDiscPreset: { driveDiscs: [importedDisc("1300027938", "wrong-source", agentId)] },
  }],
  store: baseStore,
  ownerId: "default",
  buildSelection,
  legacySelection,
  transactionId: "tx-disc-uid-mismatch",
})
assert.equal(discUidMismatchPlan.blockingErrors[0].code, "ENKA_DISC_UID_MISMATCH")
assert.deepEqual(discUidMismatchPlan.nextBuildSelection, buildSelection)

const mismatchedAgentDisc = importedDisc(uid, "wrong-agent", "aria", {
  provenance: {
    version: 1,
    enkaZzz: {
      uid,
      equipmentUid: "wrong-agent",
      equipmentId: knownEquipmentId,
      lastAgentId: "aria",
    },
  },
})
const discAgentMismatchPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    sourceUid: uid,
    driveDiscSourceCount: 1,
    driveDiscPreset: { agentId: "aria", driveDiscs: [mismatchedAgentDisc] },
  }],
  store: baseStore,
  ownerId: "default",
  buildSelection,
  legacySelection,
  transactionId: "tx-disc-agent-mismatch",
})
assert.equal(discAgentMismatchPlan.hasBlockingErrors, true)
assert.deepEqual(
  new Set(discAgentMismatchPlan.blockingErrors.map(error => error.code)),
  new Set(["ENKA_PRESET_AGENT_MISMATCH", "ENKA_DISC_AGENT_MISMATCH"]),
)
assert.equal(discAgentMismatchPlan.journal, null)
assert.deepEqual(discAgentMismatchPlan.nextStore, baseStore)

const canonicalDiscCollisionOccupant = importedDisc(uid, "canonical-collision", agentId, {
  ownerId: "default",
  level: 12,
  equippedBy: null,
  source: { type: "manual" },
})
const canonicalDiscCollisionStore = normalizeInventoryStore({
  ...baseStore,
  driveDiscs: [canonicalDiscCollisionOccupant],
})
const canonicalDiscCollisionPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    sourceUid: uid,
    driveDiscSourceCount: 1,
    driveDiscPreset: {
      agentId,
      driveDiscs: [importedDisc(uid, "canonical-collision", agentId)],
    },
  }],
  store: canonicalDiscCollisionStore,
  ownerId: "default",
  buildSelection,
  legacySelection,
  transactionId: "tx-canonical-disc-collision",
})
assert.equal(canonicalDiscCollisionPlan.hasBlockingErrors, true)
assert.equal(canonicalDiscCollisionPlan.blockingErrors[0].code, "ENKA_CANONICAL_ID_COLLISION")
assert.equal(canonicalDiscCollisionPlan.journal, null)
assert.deepEqual(canonicalDiscCollisionPlan.nextStore, canonicalDiscCollisionStore)
assert.deepEqual(canonicalDiscCollisionPlan.nextBuildSelection, buildSelection)
assert.deepEqual(canonicalDiscCollisionPlan.nextLegacySelection, legacySelection)

const canonicalLoadoutCollisionStore = normalizeInventoryStore({
  ...baseStore,
  driveDiscLoadouts: [{
    id: enkaLoadoutId(uid, agentId),
    ownerId: "default",
    agentId,
    name: "用户手动套装",
    driveDiscIdsBySlot: { 1: "manual-1" },
    source: { type: "manual" },
  }],
})
const canonicalLoadoutCollisionPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    sourceUid: uid,
    driveDiscSourceCount: 1,
    driveDiscPreset: {
      agentId,
      driveDiscs: [importedDisc(uid, "canonical-loadout-collision", agentId)],
    },
  }],
  store: canonicalLoadoutCollisionStore,
  ownerId: "default",
  buildSelection,
  legacySelection,
  transactionId: "tx-canonical-loadout-collision",
})
assert.equal(canonicalLoadoutCollisionPlan.hasBlockingErrors, true)
assert.equal(canonicalLoadoutCollisionPlan.blockingErrors[0].code, "ENKA_CANONICAL_LOADOUT_ID_COLLISION")
assert.equal(canonicalLoadoutCollisionPlan.journal, null)
assert.deepEqual(canonicalLoadoutCollisionPlan.nextStore, canonicalLoadoutCollisionStore)
assert.deepEqual(canonicalLoadoutCollisionPlan.nextBuildSelection, buildSelection)
assert.deepEqual(canonicalLoadoutCollisionPlan.nextLegacySelection, legacySelection)

const committedStore = structuredClone(importPlan.nextStore)
committedStore.enkaImportState.byOwner.default.undoJournal.status = "committed"
committedStore.enkaImportState.byOwner.default.undoJournal.committedAt = "2026-08-18T01:01:00.000Z"
const previousUndoJournal = structuredClone(committedStore.enkaImportState.byOwner.default.undoJournal)
const repeatedPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: selectedAgents,
  store: committedStore,
  ownerId: "default",
  buildSelection: importPlan.nextBuildSelection,
  legacySelection: importPlan.nextLegacySelection,
  now: new Date("2026-08-18T03:00:00.000Z"),
  transactionId: "tx-noop",
})
assert.equal(repeatedPlan.isNoop, true)
assert.equal(repeatedPlan.journal, null)
assert.equal(repeatedPlan.changeCount, 0)
assert.deepEqual(repeatedPlan.nextStore.enkaImportState.byOwner.default.undoJournal, previousUndoJournal)
assert.equal(
  enkaBindingForOwner(repeatedPlan.nextStore, "default").lastImportedAt,
  enkaBindingForOwner(committedStore, "default").lastImportedAt,
)

const observationOnlyStore = structuredClone(baseStore)
observationOnlyStore.updatedAt = "2026-08-18T03:00:00.000Z"
assert.equal(enkaImportBaseMatches({
  store: observationOnlyStore,
  buildSelection,
  legacySelection,
  journal: importPlan.journal,
}), true)

const observedDependencyStore = structuredClone(dependencyStore)
const observedScannerDisc = observedDependencyStore.driveDiscs.find(disc => disc.provenance?.scanner)
observedScannerDisc.updatedAt = "2026-08-18T03:00:00.000Z"
observedScannerDisc.provenance.scanner.lastSeenAt = "2026-08-18T03:00:00.000Z"
observedScannerDisc.provenance.scanner.lastImportId = "observation-only"
assert.equal(enkaImportBaseMatches({
  store: observedDependencyStore,
  buildSelection: dependencySelection,
  legacySelection: dependencyLegacySelection,
  journal: canonicalManualPlan.journal,
}), true)

assert.throws(() => buildEnkaImportPlan({
  uid: "1300027938",
  mappedAgents: selectedAgents,
  store: importPlan.nextStore,
  ownerId: "default",
  buildSelection: importPlan.nextBuildSelection,
  legacySelection: importPlan.nextLegacySelection,
}), error => error?.code === "UID_BINDING_MISMATCH")

const historyOnlyStore = structuredClone(committedStore)
delete historyOnlyStore.enkaImportState.byOwner.default.history
const historyOnlyPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: selectedAgents,
  store: historyOnlyStore,
  ownerId: "default",
  buildSelection: importPlan.nextBuildSelection,
  legacySelection: importPlan.nextLegacySelection,
  now: new Date("2026-08-18T04:00:00.000Z"),
  transactionId: "tx-history-only",
})
assert.equal(historyOnlyPlan.isNoop, false)
assert.deepEqual(historyOnlyPlan.historyChanges.addedAgentIds.sort(), ["aria", agentId].sort())
assert.deepEqual(historyOnlyPlan.historyChanges.updatedAgentIds, [])
assert.equal(historyOnlyPlan.changeCount, 2)
assert.equal(historyOnlyPlan.journal.changedDriveDiscIds.length, 0)
assert.equal(historyOnlyPlan.journal.changedLoadoutIds.length, 0)
const historyOnlyRepeat = buildEnkaImportPlan({
  uid,
  mappedAgents: selectedAgents,
  store: historyOnlyPlan.nextStore,
  ownerId: "default",
  buildSelection: historyOnlyPlan.nextBuildSelection,
  legacySelection: historyOnlyPlan.nextLegacySelection,
  now: new Date("2026-08-18T05:00:00.000Z"),
  transactionId: "tx-history-only-repeat",
})
assert.equal(historyOnlyRepeat.isNoop, true)
assert.equal(
  enkaImportHistoryForOwner(historyOnlyRepeat.nextStore, "default").byAgent[agentId].lastImportedAt,
  "2026-08-18T04:00:00.000Z",
)

const restoredBeforeHistory = applyEnkaImportSnapshot({
  store: importPlan.nextStore,
  buildSelection: importPlan.nextBuildSelection,
  legacySelection: importPlan.nextLegacySelection,
  journal: importPlan.journal,
}, "before")
assert.equal(restoredBeforeHistory.store.enkaImportState?.byOwner?.default?.history, undefined)
assert.deepEqual(
  applyEnkaImportSnapshot({
    store: baseStore,
    buildSelection,
    legacySelection,
    journal: importPlan.journal,
  }, "after").store.enkaImportState.byOwner.default.history,
  importPlan.nextStore.enkaImportState.byOwner.default.history,
)

function historyAgent(index, overrides = {}) {
  return {
    agentId: `history-agent-${index}`,
    agentName: `历史角色${String(index).padStart(2, "0")}`,
    sourceUid: uid,
    agentLevel: 60,
    cinemaLevel: 0,
    coreSkillLevel: "A",
    skillLevels: { basic: 12 },
    wEngine: null,
    driveDiscSourceCount: 0,
    driveDiscPreset: null,
    ...overrides,
  }
}

const emptySelection = {
  version: 2,
  currentOwnerId: "default",
  byOwner: { default: { currentAgentId: null, byAgent: {} } },
}
const historyBatchOne = buildEnkaImportPlan({
  uid,
  mappedAgents: [historyAgent(1), historyAgent(2), historyAgent(3)],
  store: normalizeInventoryStore(createEmptyInventoryStore()),
  ownerId: "default",
  buildSelection: emptySelection,
  legacySelection: emptySelection,
  now: new Date("2026-08-19T01:00:00.000Z"),
  transactionId: "tx-history-batch-one",
})
const historyBatchTwo = buildEnkaImportPlan({
  uid,
  mappedAgents: [historyAgent(4), historyAgent(5), historyAgent(6), historyAgent(7), historyAgent(8), historyAgent(9)],
  store: historyBatchOne.nextStore,
  ownerId: "default",
  buildSelection: historyBatchOne.nextBuildSelection,
  legacySelection: historyBatchOne.nextLegacySelection,
  now: new Date("2026-08-19T02:00:00.000Z"),
  transactionId: "tx-history-batch-two",
})
assert.equal(Object.keys(enkaImportHistoryForOwner(historyBatchTwo.nextStore, "default").byAgent).length, 9)
const historyOverlapUpdate = buildEnkaImportPlan({
  uid,
  mappedAgents: [historyAgent(2, { agentLevel: 50 }), historyAgent(9)],
  store: historyBatchTwo.nextStore,
  ownerId: "default",
  buildSelection: historyBatchTwo.nextBuildSelection,
  legacySelection: historyBatchTwo.nextLegacySelection,
  now: new Date("2026-08-19T03:00:00.000Z"),
  transactionId: "tx-history-overlap",
})
const cumulativeHistory = enkaImportHistoryForOwner(historyOverlapUpdate.nextStore, "default")
assert.equal(Object.keys(cumulativeHistory.byAgent).length, 9)
assert.equal(cumulativeHistory.byAgent["history-agent-2"].firstImportedAt, "2026-08-19T01:00:00.000Z")
assert.equal(cumulativeHistory.byAgent["history-agent-2"].lastImportedAt, "2026-08-19T03:00:00.000Z")
assert.equal(cumulativeHistory.byAgent["history-agent-1"].lastImportedAt, "2026-08-19T01:00:00.000Z")

const backfillUndo = { id: "keep-undo", status: "committed" }
const backfillStore = normalizeInventoryStore({
  ...createEmptyInventoryStore(),
  currentOwnerId: "default",
  driveDiscLoadouts: [
    {
      id: enkaLoadoutId(uid, agentId),
      ownerId: "default",
      agentId,
      name: "展柜佩戴套装 - 星见雅",
      driveDiscIdsBySlot: { 1: "disc-a", 2: "disc-b" },
      source: { type: "enka-zzz-showcase", uid, agentId },
    },
    {
      id: enkaLoadoutId(uid, "aria"),
      ownerId: "default",
      agentId: "aria",
      name: "手动套装",
      driveDiscIdsBySlot: { 1: "disc-c" },
      source: { type: "manual" },
    },
    {
      id: enkaLoadoutId("1300027938", "aria"),
      ownerId: "default",
      agentId: "aria",
      name: "其他 UID 展柜套装",
      driveDiscIdsBySlot: { 1: "disc-d" },
      source: { type: "enka-zzz-showcase", uid: "1300027938", agentId: "aria" },
    },
    {
      id: enkaLoadoutId(uid, "unknown-agent"),
      ownerId: "default",
      agentId: "unknown-agent",
      name: "未收录角色套装",
      driveDiscIdsBySlot: { 1: "disc-e" },
      source: { type: "enka-zzz-showcase", uid, agentId: "unknown-agent" },
    },
    {
      id: "custom-enka-loadout",
      ownerId: "default",
      agentId: "aria",
      name: "自定义 ID",
      driveDiscIdsBySlot: { 1: "disc-f" },
      source: { type: "enka-zzz-showcase", uid, agentId: "aria" },
    },
  ],
  enkaImportState: {
    version: 1,
    byOwner: {
      default: {
        binding: { uid, boundAt: "2026-08-01T00:00:00.000Z", lastImportedAt: "2026-08-02T00:00:00.000Z" },
        undoJournal: backfillUndo,
      },
    },
  },
})
const backfillResult = backfillEnkaImportHistory({
  store: backfillStore,
  ownerId: "default",
  knownAgents: catalog.displayAgents,
  now: new Date("2026-08-20T01:00:00.000Z"),
})
assert.equal(backfillResult.changed, true)
assert.equal(backfillResult.history.backfillVersion, 1)
assert.deepEqual(Object.keys(backfillResult.history.byAgent), [agentId])
assert.equal(backfillResult.history.byAgent[agentId].completeness, "partial")
assert.equal(backfillResult.history.byAgent[agentId].snapshot.driveDiscCount, 2)
assert.equal(backfillResult.history.byAgent[agentId].snapshot.driveDiscSourceCount, null)
assert.equal(backfillResult.history.byAgent[agentId].lastImportedAt, null)
assert.deepEqual(enkaBindingForOwner(backfillResult.store, "default"), enkaBindingForOwner(backfillStore, "default"))
assert.deepEqual(backfillResult.store.enkaImportState.byOwner.default.undoJournal, backfillUndo)
assert.equal(backfillEnkaImportHistory({
  store: backfillResult.store,
  ownerId: "default",
  knownAgents: catalog.displayAgents,
}).changed, false)
const unavailableCatalogBackfill = backfillEnkaImportHistory({
  store: backfillStore,
  ownerId: "default",
  knownAgents: [],
})
assert.equal(unavailableCatalogBackfill.changed, false)
assert.equal(unavailableCatalogBackfill.store.enkaImportState.byOwner.default.history, undefined)

const damagedHistoryStore = structuredClone(backfillResult.store)
damagedHistoryStore.enkaImportState.byOwner.default.history.futureMetadata = { keep: true }
damagedHistoryStore.enkaImportState.byOwner.default.history.byAgent.aria = {
  agentId: "aria",
  agentName: "爱芮",
  uid: "1300027938",
  completeness: "full",
  firstImportedAt: null,
  lastImportedAt: null,
  snapshot: { driveDiscCount: 6, driveDiscSourceCount: 6 },
  futureRecordField: "keep",
}
assert.equal(enkaImportHistoryForOwner(damagedHistoryStore, "default").byAgent.aria, undefined)
const repairedHistoryPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{ ...selectedAgents[1], sourceUid: uid }],
  store: damagedHistoryStore,
  ownerId: "default",
  buildSelection,
  legacySelection,
  now: new Date("2026-08-20T02:00:00.000Z"),
  transactionId: "tx-repair-damaged-history",
})
assert.equal(repairedHistoryPlan.nextStore.enkaImportState.byOwner.default.history.futureMetadata.keep, true)
assert.equal(repairedHistoryPlan.nextStore.enkaImportState.byOwner.default.history.byAgent.aria.uid, uid)
assert.equal(repairedHistoryPlan.nextStore.enkaImportState.byOwner.default.history.byAgent.aria.futureRecordField, "keep")
assert.equal(enkaImportHistoryForOwner(repairedHistoryPlan.nextStore, "default").byAgent.aria.agentName, "爱芮")

// A rebind removes only the old UID's ownership. Scanner data and user edits survive,
// while Enka-only records and their references are removed in the same snapshot.
const replacementUid = "1300027938"
const sharedBeforeBinding = structuredClone(scannerThenEnkaPlan.nextStore.driveDiscs[0])
delete sharedBeforeBinding.provenance.enkaZzz
sharedBeforeBinding.source = {
  type: "zzz-scanner",
  importId: "scanner-before-binding",
  sourcePath: "before-binding.json",
  sequence: 7,
  rawIndex: 0,
}
sharedBeforeBinding.locked = false
sharedBeforeBinding.equippedBy = null
sharedBeforeBinding.reservedForAgentId = "aria"
sharedBeforeBinding.excludedForAgentIds = ["yixuan"]
const rebindInitialStore = normalizeInventoryStore({
  ...createEmptyInventoryStore(),
  driveDiscs: [sharedBeforeBinding],
})
const rebindInitialSelection = {
  version: 2,
  currentOwnerId: "default",
  byOwner: {
    default: {
      currentAgentId: agentId,
      byAgent: {
        [agentId]: {
          agentLevel: 40,
          combat: { activeBuffIds: ["keep-user-buff"] },
        },
      },
    },
  },
}
const firstBindingPlan = buildEnkaImportPlan({
  uid,
  mappedAgents: [{
    agentId,
    agentName: "星见雅",
    sourceUid: uid,
    agentLevel: 60,
    cinemaLevel: 2,
    coreSkillLevel: "F",
    skillLevels: { basic: 12 },
    wEngine: null,
    driveDiscSourceCount: 2,
    driveDiscPreset: {
      agentId,
      driveDiscs: [
        importedDisc(uid, "300", agentId),
        importedDisc(uid, "rebind-only", agentId, { partition: 2 }),
      ],
    },
  }],
  store: rebindInitialStore,
  ownerId: "default",
  buildSelection: rebindInitialSelection,
  legacySelection: structuredClone(rebindInitialSelection),
  now: new Date("2026-08-20T03:00:00.000Z"),
  transactionId: "tx-first-binding-for-rebind",
})
assert.equal(firstBindingPlan.hasBlockingErrors, false)
assert.equal(enkaRebindEligibility(firstBindingPlan.nextStore, "default").allowed, true)
let reboundSourceStore = markEnkaImportCommitted(
  firstBindingPlan.nextStore,
  "default",
  firstBindingPlan.journal.id,
)
const sharedCanonicalId = firstBindingPlan.drivePlan.results[0].driveDiscIdsBySlot[1]
const enkaOnlyId = firstBindingPlan.drivePlan.results[0].driveDiscIdsBySlot[2]
const sharedAfterBinding = reboundSourceStore.driveDiscs.find(disc => disc.id === sharedCanonicalId)
assert.ok(sharedAfterBinding.provenance.enkaZzz)
assert.ok(sharedAfterBinding.provenance.scanner)

reboundSourceStore = structuredClone(reboundSourceStore)
reboundSourceStore.driveDiscLoadouts.push({
  id: "user-loadout-with-old-enka-disc",
  ownerId: "default",
  agentId,
  name: "用户自定义套装",
  driveDiscIdsBySlot: { 2: enkaOnlyId },
  source: { type: "manual" },
})
const selectionBeforeRebind = structuredClone(firstBindingPlan.nextBuildSelection)
const legacyBeforeRebind = structuredClone(firstBindingPlan.nextLegacySelection)
selectionBeforeRebind.byOwner.default.byAgent[agentId].agentLevel = 47
legacyBeforeRebind.byOwner.default.byAgent[agentId].agentLevel = 47
for (const document of [selectionBeforeRebind, legacyBeforeRebind]) {
  const config = document.byOwner.default.byAgent[agentId]
  config.manualDriveDiscIdsBySlot = { 2: enkaOnlyId }
  config.manualDriveDiscsBySlot = { 2: enkaOnlyId }
  config.driveDiscIdsBySlot = { 2: enkaOnlyId }
}

const rebindPlan = buildEnkaRebindPlan({
  previousUid: uid,
  uid: replacementUid,
  mappedAgents: [{
    agentId: "aria",
    agentName: "爱芮",
    sourceUid: replacementUid,
    agentLevel: 60,
    cinemaLevel: 1,
    coreSkillLevel: "F",
    skillLevels: { basic: 12 },
    wEngine: null,
    driveDiscSourceCount: 0,
    driveDiscPreset: null,
  }],
  store: reboundSourceStore,
  ownerId: "default",
  buildSelection: selectionBeforeRebind,
  legacySelection: legacyBeforeRebind,
  now: new Date("2026-08-20T04:00:00.000Z"),
  transactionId: "tx-safe-rebind",
})
assert.equal(rebindPlan.kind, "enka-rebind")
assert.equal(rebindPlan.hasBlockingErrors, false)
assert.equal(rebindPlan.journal.kind, "enka-rebind")
assert.equal(enkaBindingForOwner(rebindPlan.nextStore, "default").uid, replacementUid)
assert.equal(enkaRebindEligibility(rebindPlan.nextStore, "default").allowed, true)
assert.equal(rebindPlan.nextStore.driveDiscs.some(disc => disc.id === enkaOnlyId), false)
const detachedShared = rebindPlan.nextStore.driveDiscs.find(disc => disc.id === sharedCanonicalId)
assert.ok(detachedShared)
assert.equal(detachedShared.provenance.enkaZzz, undefined)
assert.ok(detachedShared.provenance.scanner)
assert.equal(detachedShared.source.type, "zzz-scanner")
assert.equal(detachedShared.locked, false)
assert.equal(detachedShared.equippedBy, null)
assert.equal(detachedShared.reservedForAgentId, "aria")
assert.deepEqual(detachedShared.excludedForAgentIds, ["yixuan"])
assert.equal(
  rebindPlan.nextStore.driveDiscLoadouts.some(loadout => loadout.id === enkaLoadoutId(uid, agentId)),
  false,
)
const retainedCustomLoadout = rebindPlan.nextStore.driveDiscLoadouts
  .find(loadout => loadout.id === "user-loadout-with-old-enka-disc")
assert.ok(retainedCustomLoadout)
assert.deepEqual(retainedCustomLoadout.driveDiscIdsBySlot, {})
const configAfterRebind = rebindPlan.nextBuildSelection.byOwner.default.byAgent[agentId]
assert.equal(configAfterRebind.agentLevel, 47)
assert.equal(Object.prototype.hasOwnProperty.call(configAfterRebind, "cinemaLevel"), false)
assert.deepEqual(configAfterRebind.combat.activeBuffIds, ["keep-user-buff"])
assert.deepEqual(configAfterRebind.manualDriveDiscIdsBySlot, {})
assert.deepEqual(configAfterRebind.manualDriveDiscsBySlot, {})
assert.deepEqual(configAfterRebind.driveDiscIdsBySlot, {})
assert.deepEqual(rebindPlan.nextLegacySelection.byOwner.default.byAgent[agentId].manualDriveDiscIdsBySlot, {})
assert.deepEqual(rebindPlan.nextLegacySelection.byOwner.default.byAgent[agentId].manualDriveDiscsBySlot, {})
assert.deepEqual(rebindPlan.nextLegacySelection.byOwner.default.byAgent[agentId].driveDiscIdsBySlot, {})
assert.deepEqual(Object.keys(enkaImportHistoryForOwner(rebindPlan.nextStore, "default").byAgent), ["aria"])
assert.ok(rebindPlan.rebind.deletedDriveDiscIds.includes(enkaOnlyId))
assert.ok(rebindPlan.rebind.detachedDriveDiscIds.includes(sharedCanonicalId))

const rebindUndone = applyEnkaImportSnapshot({
  store: rebindPlan.nextStore,
  buildSelection: rebindPlan.nextBuildSelection,
  legacySelection: rebindPlan.nextLegacySelection,
  journal: rebindPlan.journal,
}, "before")
assert.equal(enkaBindingForOwner(rebindUndone.store, "default").uid, uid)
assert.equal(enkaRebindEligibility(rebindUndone.store, "default").allowed, true)
assert.ok(rebindUndone.store.driveDiscs.some(disc => disc.id === enkaOnlyId))
assert.ok(rebindUndone.store.driveDiscs.find(disc => disc.id === sharedCanonicalId).provenance.enkaZzz)
assert.deepEqual(
  rebindUndone.store.driveDiscLoadouts.find(loadout => loadout.id === "user-loadout-with-old-enka-disc").driveDiscIdsBySlot,
  { 2: enkaOnlyId },
)
assert.equal(rebindUndone.buildSelection.byOwner.default.byAgent[agentId].agentLevel, 47)
assert.deepEqual(
  rebindUndone.store.enkaImportState.byOwner.default.history,
  reboundSourceStore.enkaImportState.byOwner.default.history,
)
assert.equal(rebindUndone.store.enkaImportState.byOwner.default.undoJournal, null)

const jsonSourceStore = markEnkaImportCommitted(
  firstBindingPlan.nextStore,
  "default",
  firstBindingPlan.journal.id,
)
const boundSharedDisc = jsonSourceStore.driveDiscs.find(disc => disc.id === sharedCanonicalId)
const {
  ownerId: _nativeOwnerId,
  source: _nativeSource,
  provenance: _nativeProvenance,
  contentFingerprint: _nativeContentFingerprint,
  identityFingerprint: _nativeIdentityFingerprint,
  ...nativeSharedDisc
} = boundSharedDisc
const jsonMergePlan = buildScannerImportPlan(jsonSourceStore, {
  format: "zzz-calculator-drive-disc-export",
  version: 1,
  exportedAt: "2026-08-20T04:10:00.000Z",
  sourceAccount: { id: "backup-owner", label: "原生备份" },
  driveDiscs: [{ ...nativeSharedDisc, id: "native-shared-record" }],
}, {
  ownerId: "default",
  sourcePath: "native-shared.json",
  now: "2026-08-20T04:10:00.000Z",
})
assert.equal(jsonMergePlan.summary.sourceMerged, 1)
assert.equal(jsonMergePlan.nextStore.driveDiscs.some(disc => disc.id === "native-shared-record"), false)
assert.ok(jsonMergePlan.nextStore.driveDiscs.find(disc => disc.id === sharedCanonicalId).provenance.calculatorJson)
assert.ok(
  jsonMergePlan.nextStore.enkaImportState.byOwner.default.bindingSession
    .driveDiscs[sharedCanonicalId].lastNonEnkaRecord.provenance.calculatorJson,
)

const manuallyEditedShared = upsertDriveDisc(jsonMergePlan.nextStore, {
  ...jsonMergePlan.nextStore.driveDiscs.find(disc => disc.id === sharedCanonicalId),
  level: 14,
  locked: false,
  equippedBy: null,
}).nextStore
const manualSessionRecord = manuallyEditedShared.enkaImportState.byOwner.default.bindingSession
  .driveDiscs[sharedCanonicalId]
assert.equal(manualSessionRecord.lastNonEnkaRecord.level, 14)
assert.ok(manualSessionRecord.lastNonEnkaRecord.provenance.manual)
const manualSourceRebind = buildEnkaRebindPlan({
  previousUid: uid,
  uid: replacementUid,
  mappedAgents: [{
    agentId: "aria",
    agentName: "爱芮",
    sourceUid: replacementUid,
    agentLevel: 60,
    driveDiscSourceCount: 0,
    driveDiscPreset: null,
  }],
  store: manuallyEditedShared,
  ownerId: "default",
  buildSelection: firstBindingPlan.nextBuildSelection,
  legacySelection: firstBindingPlan.nextLegacySelection,
  transactionId: "tx-rebind-after-json-manual-edit",
})
const preservedManualShared = manualSourceRebind.nextStore.driveDiscs.find(disc => disc.id === sharedCanonicalId)
assert.equal(preservedManualShared.level, 14)
assert.equal(preservedManualShared.provenance.enkaZzz, undefined)
assert.ok(preservedManualShared.provenance.calculatorJson)
assert.ok(preservedManualShared.provenance.manual)
assert.equal(preservedManualShared.id, sharedCanonicalId)

const incompleteLegacyStore = structuredClone(reboundSourceStore)
delete incompleteLegacyStore.enkaImportState.byOwner.default.bindingSession
incompleteLegacyStore.enkaImportState.byOwner.default.undoJournal = null
assert.equal(enkaRebindEligibility(incompleteLegacyStore, "default").allowed, false)
const blockedLegacyRebind = buildEnkaRebindPlan({
  previousUid: uid,
  uid: replacementUid,
  mappedAgents: [{ ...selectedAgents[1], sourceUid: replacementUid, driveDiscPreset: null, driveDiscSourceCount: 0 }],
  store: incompleteLegacyStore,
  ownerId: "default",
  buildSelection: selectionBeforeRebind,
  legacySelection: legacyBeforeRebind,
  transactionId: "tx-blocked-legacy-rebind",
})
assert.equal(blockedLegacyRebind.hasBlockingErrors, true)
assert.equal(blockedLegacyRebind.blockingErrors[0].code, "ENKA_REBIND_BASELINE_INCOMPLETE")
assert.equal(blockedLegacyRebind.journal, null)
assert.deepEqual(blockedLegacyRebind.nextStore, incompleteLegacyStore)

console.log("enka-import.test.js: all assertions passed")
