import assert from "node:assert/strict"
import { parseEnkaShowcase } from "../core/enka-import/parse-enka.js"
import { mapShowcaseToCatalog } from "../core/enka-import/entity-mapping.js"

// Minimal catalog + metadata covering the import mapping paths.
const catalog = {
    displayAgents: [
        { id: "hoshimi_miyabi", name: { zhCN: "星见雅" } },
        { id: "aria", name: { zhCN: "爱芮" } },
        { id: "remielle_dan", name: { zhCN: "蕾米埃尔·丹" } },
    ],
    displayWEngines: [
        { id: "hailfall_star_palace", name: { zhCN: "霰落星殿" } },
    ],
    displayDriveDiscSets: [],
}
const metadata = {
    avatars: {
        "1091": { Name: "Avatar_Female_Size02_Unagi" },
        "1501": { Name: "Avatar_Female_Size01_Aria" },
        "1581": { Name: "Avatar_Female_Size02_Remielle" },
    },
    weapons: { "14109": { ItemName: "Item_Weapon_S_1091_Name" } },
    locations: {
        "zh-cn": {
            Avatar_Female_Size02_Unagi: "雅",
            Avatar_Female_Size01_Aria: "爱芮",
            Avatar_Female_Size02_Remielle: "蕾米埃尔",
            Item_Weapon_S_1091_Name: "霰落星殿",
        },
    },
    equipments: { Items: {}, Suits: {} },
    properties: {},
}

function makeAvatar(id, overrides = {}) {
    return {
        Id: id,
        Level: 60,
        TalentLevel: 3,
        CoreSkillEnhancement: 6,
        SkillLevelList: [
            { Index: 0, Level: 10 },
            { Index: 1, Level: 10 },
            { Index: 2, Level: 10 },
            { Index: 3, Level: 10 },
            { Index: 5, Level: 5 },
            { Index: 6, Level: 10 },
        ],
        Weapon: { Id: 14109, Level: 50, BreakLevel: 4, UpgradeLevel: 2 },
        ...overrides,
    }
}

// parse: raw Enka fields -> structured agent
const parsed = parseEnkaShowcase({
    PlayerInfo: { ShowcaseDetail: { AvatarList: [makeAvatar(1091)] } },
})
assert.equal(parsed.agents.length, 1)
const miyabi = parsed.agents[0]
assert.equal(miyabi.enkaId, "1091")
assert.equal(miyabi.agentLevel, 60)
assert.equal(miyabi.cinemaLevel, 3)
assert.equal(miyabi.coreSkillLevel, "F")
assert.deepEqual(miyabi.skillLevels, { basic: 10, special: 10, dodge: 10, chain: 10, assist: 10 })
assert.deepEqual(miyabi.wEngine, { enkaId: "14109", level: 50, modificationLevel: 2 })

// map: override (1581 -> remielle_dan) + unique-name (1501 -> aria, 1091 -> miyabi)
const mapped = mapShowcaseToCatalog(
    parseEnkaShowcase({ PlayerInfo: { ShowcaseDetail: { AvatarList: [makeAvatar(1091), makeAvatar(1501), makeAvatar(1581)] } } }),
    catalog,
    metadata,
)
assert.deepEqual(mapped.mappedAgents.map(a => a.agentId), ["hoshimi_miyabi", "aria", "remielle_dan"])
assert.deepEqual(mapped.skippedAgents, [])
assert.equal(mapped.mappedAgents[0].wEngine.id, "hailfall_star_palace")
assert.equal(mapped.mappedAgents[0].wEngine.modificationLevel, 2)

// unmapped agent (no override, no name match) is skipped with a reason
const unmapped = mapShowcaseToCatalog(
    parseEnkaShowcase({ PlayerInfo: { ShowcaseDetail: { AvatarList: [makeAvatar(1999)] } } }),
    catalog,
    metadata,
)
assert.equal(unmapped.mappedAgents.length, 0)
assert.equal(unmapped.skippedAgents.length, 1)
assert.match(unmapped.skippedAgents[0].reason, /未收录|缺失/)

console.log("enka-import.test.js: all assertions passed")

// --- drive-disc import plan (from drive-disc-plan.js) ---
const { buildDriveDiscSyncPlan } = await import("../core/enka-import/drive-disc-plan.js")

const discPreset = {
    agentId: "hoshimi_miyabi",
    agentName: "星见雅",
    driveDiscs: [
        {
            id: "enka-3001", setId: "scanner-set", setName: "折枝剑歌", partition: 1,
            rarity: "S", level: 15, maxLevel: 15, locked: true, equippedBy: "hoshimi_miyabi",
            mainStat: { stat: "hpFlat", value: 2200, mode: "flat", label: "生命值" },
            subStats: [{ stat: "critRate", value: 0.072, mode: "pct", label: "暴击率" }],
            source: { type: "enka-showcase", agentId: "hoshimi_miyabi" },
        },
    ],
}
const emptyStore = { currentOwnerId: "default", driveDiscs: [], driveDiscLoadouts: [] }
const plan = buildDriveDiscSyncPlan({
    mappedAgents: [{ agentId: "hoshimi_miyabi", agentName: "星见雅", driveDiscPreset: discPreset }],
    driveDiscState: { ownerId: "default", store: emptyStore },
    now: new Date("2026-08-05T10:00:00"),
})
assert.equal(plan.changed, true)
assert.equal(plan.addedDiscs, 1)
assert.equal(plan.nextStore.driveDiscs.length, 1)
assert.equal(plan.nextStore.driveDiscs[0].id, "enka-3001")
assert.equal(plan.nextStore.driveDiscs[0].ownerId, "default")
assert.equal(plan.nextStore.driveDiscLoadouts.length, 1)
const loadout = plan.nextStore.driveDiscLoadouts[0]
assert.equal(loadout.id, "enka-showcase-hoshimi_miyabi")
assert.equal(loadout.driveDiscIdsBySlot["1"], "enka-3001")
assert.equal(loadout.status, "incomplete") // only 1 of 6 slots
assert.equal(loadout.source.type, "enka-showcase")

// re-running the same plan is a no-op (idempotent, stable id)
const plan2 = buildDriveDiscSyncPlan({
    mappedAgents: [{ agentId: "hoshimi_miyabi", agentName: "星见雅", driveDiscPreset: discPreset }],
    driveDiscState: { ownerId: "default", store: plan.nextStore },
    now: new Date("2026-08-05T11:00:00"),
})
assert.equal(plan2.changed, false)
assert.equal(plan2.addedDiscs, 0)

// manual (non-enka) disc with a colliding id is preserved + warns
const manualStore = {
    currentOwnerId: "default",
    driveDiscs: [{ ...discPreset.driveDiscs[0], source: { type: "manual" } }],
    driveDiscLoadouts: [],
}
const plan3 = buildDriveDiscSyncPlan({
    mappedAgents: [{ agentId: "hoshimi_miyabi", agentName: "星见雅", driveDiscPreset: discPreset }],
    driveDiscState: { ownerId: "default", store: manualStore },
})
assert.equal(plan3.addedDiscs, 0)
assert.ok(plan3.warnings.some(w => /冲突/.test(w)))

console.log("enka-import.test.js drive-disc plan: all assertions passed")
