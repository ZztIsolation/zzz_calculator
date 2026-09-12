import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(path.join(rootDir, "webapp", "package.json"))
const { chromium } = require("playwright")
const apiBase = "https://act-api-takumi-static.mihoyo.com/hoyowiki/zzz/wapi/entry_page"
const sourceBase = "https://baike.mihoyo.com/zzz/wiki/content"
const channelUrl = "https://baike.mihoyo.com/zzz/wiki/channel/map/2/45"
const channelApi = "https://act-api-takumi-static.mihoyo.com/common/blackboard/zzz_wiki/v1/home/content/list?channel_id=45&lang=zh-cn&app_sn=zzz_wiki"
const expectedVersions = new Map([
    [2145, "1788411769"],
    [2188, "1788433458"],
    [2189, "1788433825"],
    [2190, "1788440333"],
    [2200, "1788787729"],
])

const headers = {
    "x-rpc-wiki_app": "zzz",
    referer: "https://baike.mihoyo.com/",
}

let browser
let browserContext

async function requestJson(url) {
    const response = browserContext
        ? await browserContext.request.get(url, { headers })
        : await fetch(url, { headers })
    if (!response.ok) {
        throw new Error(`Official Wiki request failed: ${response.status} ${url}`)
    }
    return response.json()
}

function componentJson(page, moduleIndex) {
    const raw = page.modules?.[moduleIndex]?.components?.[0]?.data
    if (typeof raw !== "string") {
        throw new Error(`Missing official Wiki module ${moduleIndex} for ${page.id}`)
    }
    return JSON.parse(raw)
}

function stripHtml(value) {
    return String(value ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim()
}

function localized(value) {
    return { zhCN: String(value ?? "").trim() }
}

function percentageValues(text) {
    const result = []
    const matcher = /([^：:]+)[：:]\s*([0-9]+(?:\.[0-9]+)?)%/g
    let match
    while ((match = matcher.exec(text))) {
        result.push({ label: match[1].trim(), value: Number(match[2]) })
    }
    return result
}

function rowId(label, kind) {
    const value = String(label).replace(/\s+/g, "")
    if (value.includes("一段")) return "hit_1"
    if (value.includes("二段")) return "hit_2"
    if (value.includes("三段连续斩击")) return "hit_3"
    if (value.includes("三段下砸")) return "hit_4"
    if (value.includes("三段")) return "hit_3"
    if (value.includes("四段")) return "hit_4"
    if (value.includes("上挑")) return "hit_1"
    if (value.includes("横斩")) return "hit_2"
    if (value.includes("毁伤")) return "maim"
    if (value.includes("轻招架")) return "parry_light"
    if (value.includes("重招架")) return "parry_heavy"
    if (value.includes("连续招架")) return "parry_chain"
    if (kind === "damage") return "damage"
    return "daze"
}

function parseMoveRows(move) {
    const levelNames = Array.from({ length: 16 }, (_, index) => String(index + 1))
    const rows = new Map()
    let hasDamage = false
    for (const levelName of levelNames) {
        const growth = move.growth?.find(item => String(item.name) === levelName)
        for (const child of growth?.children ?? []) {
            const childName = String(child.name ?? "")
            const kind = childName.includes("伤害") ? "damage" : childName.includes("失衡") ? "daze" : null
            if (!kind) continue
            const text = stripHtml((child.row ?? []).flat().join(" "))
            for (const item of percentageValues(text)) {
                const baseId = rowId(item.label, kind)
                const id = kind === "daze" ? `daze_${baseId}` : baseId
                const key = `${kind}:${id}`
                if (!rows.has(key)) {
                    rows.set(key, {
                        id,
                        kind: kind === "damage" ? "damageMultiplier" : "dazeMultiplier",
                        label: localized(item.label),
                        values: [],
                    })
                }
                const row = rows.get(key)
                row.values.push(item.value)
                if (kind === "damage") hasDamage = true
            }
        }
    }

    // A row can be absent from the official table at a level only when the
    // action is not a damage action. Keep every row aligned to LV1-LV16.
    for (const row of rows.values()) {
        if (row.values.length !== 16) {
            throw new Error(`Incomplete official multiplier row ${move.title}: ${row.id}`)
        }
        if (row.kind === "damageMultiplier") {
            row.damageKind = "sharp"
            row.damageBasis = "def"
        }
    }
    return { rows: [...rows.values()], hasDamage }
}

const categoryDefinitions = [
    { id: "basic", name: "普通攻击" },
    { id: "dodge", name: "闪避" },
    { id: "assist", name: "支援技" },
    { id: "special", name: "特殊技" },
    { id: "chain", name: "连携技" },
]

const moveIds = {
    "普通攻击：血锻四式": "basic_blood_forge",
    "普通攻击：血华誓·锻星": "basic_crimson_forge",
    "普通攻击：血华誓·伏钺": "basic_crimson_fall",
    "闪避：夜视": "dodge_night_watch",
    "冲刺攻击：淬火": "dash_quench",
    "闪避反击：回锋": "dodge_counter_return",
    "闪避反击：血华誓·回锋": "dodge_counter_crimson_return",
    "快速支援：厄月再临": "assist_moonfall",
    "快速支援：血华誓·厄月再临": "assist_crimson_moonfall",
    "招架支援：不屈炉心": "assist_unyielding_core",
    "支援突击：血华誓·无垢溶锋": "assist_pure_melt",
    "反制支援：寸铁不让": "assist_counter_iron",
    "支援突击：血华誓·琢形": "assist_carve_form",
    "特殊技：初辉启鸣": "special_first_light",
    "强化特殊技：血华誓·铸锋秘术": "special_forge_secret",
    "特殊技：血华誓·斩金断铁": "special_slash_gold",
    "特殊技：血华誓·葬血强袭": "special_blood_assault",
    "连携技：血华誓·血契共鸣": "chain_blood_contract",
    "终结技：血华誓·千锤百炼": "ultimate_hundred_hammers",
}

function skillCatalog(page) {
    const source = componentJson(page, 2)
    const categories = categoryDefinitions.map((definition, categoryIndex) => {
        const sourceCategory = source.list?.[categoryIndex]
        const moves = (sourceCategory?.children ?? []).map(move => {
            const parsed = parseMoveRows(move)
            return {
                id: moveIds[move.title] ?? `move_${categoryIndex}_${move.title}`,
                name: localized(move.title),
                description: localized(stripHtml(move.desc)),
                skillType: definition.id,
                damageElement: parsed.hasDamage ? "electric" : undefined,
                ...(parsed.hasDamage ? { damageKind: "sharp", damageBasis: "def" } : {}),
                skillTags: [
                    ...(move.title.includes("强化特殊技") ? ["exSpecial"] : []),
                    ...(move.title.includes("支援突击") || move.title.includes("快速支援") ? ["assistAttack"] : []),
                    ...(move.title.includes("闪避反击") ? ["dodgeCounter"] : []),
                ],
                ...(move.title.includes("葬血强袭")
                    ? { unmodeledReason: localized("官方说明最多可连续触发3次毁伤，但当前条目没有单列毁伤伤害倍率，因此本体可选、毁伤只保留说明，不计入总伤害。") }
                    : {}),
                rows: parsed.rows.length
                    ? parsed.rows
                    : [{ id: "none", kind: "statBonus", label: localized("无数值倍率"), values: Array(16).fill(0) }],
            }
        })
        return {
            id: definition.id,
            name: localized(definition.name),
            levelRange: { min: 1, max: 16, default: 12 },
            moves,
        }
    })
    return {
        id: "claret",
        agentId: "claret",
        name: localized("克拉蕾技能倍率"),
        categories,
        sources: [pageSourceUrl(page.id)],
        verification: {
            officialEntryPageId: Number(page.id),
            officialEntryVersion: String(page.version),
            damageRows: "All official damage rows are marked damageKind sharp and use DEF; defense support keeps daze rows only.",
        },
    }
}

function pageSourceUrl(id) {
    return `${sourceBase}/${id}/detail?mhy_presentation_style=fullscreen`
}

function specificTarget(categoryId, moveId, rowId = "") {
    return {
        kind: "specific",
        agentSkillId: "claret",
        categoryId,
        skillType: categoryId,
        moveId,
        ...(rowId ? { rowId } : {}),
    }
}

function sharpEvent(id, categoryId, moveId, rowId, extra = {}) {
    return {
        id,
        kind: "sharp",
        count: 1,
        stunned: true,
        critMode: "expected",
        skillRef: {
            agentSkillId: "claret",
            categoryId,
            moveId,
            rowId,
        },
        ...extra,
    }
}

function claretAgent(page) {
    const source = pageSourceUrl(page.id)
    const commonDescription = "克拉蕾发动招式造成的伤害均为锐化伤害，使用防御力作为招式伤害倍率；锐化伤害会积累残痕值，残痕值满时，敌人会进入[残痕]，[残痕]最多叠加3层，发动[特殊技：血华誓·斩金断铁]、[特殊技：血华誓·葬血强袭]命中处于[残痕]状态下的敌人时，会消耗一层[残痕]，触发[毁伤]并造成一次范围伤害；触发暴击时，锐化伤害不受暴击伤害加成，转而计算锐暴伤害加成；若暴击率超过100%且已经触发暴击时，还将基于超过部分的暴击率再进行一次锐暴判定，若触发锐暴则额外计算一次锐暴伤害加成；克拉蕾每拥有1%的初始暴击伤害，初始暴击率提升0.35%；克拉蕾进入战场时即可回复60点锐能，在勘域模式中此效果180秒内最多触发一次；克拉蕾处于[猩红铭刻]期间，抗打断等级提升，克拉蕾发动[连携技]时延长[猩红铭刻]2秒持续时间；克拉蕾处于[猩红铭刻]，或是在发动[连携技]、[终结技]、[反制支援]、[支援突击]期间，暴击率提升15%/17.5%/20%/22.5%/25%/27.5%/30%，残痕积蓄效率提升20%/25%/30%/35%/40%/45%/50%，在[普通攻击：血华誓·锻星]和[普通攻击：血华誓·伏钺]招式攻击期间触发极限闪避时，使招式剩余时间内造成的伤害提升15%。"
    const gashGroup = {
        id: "claret_gash_burst",
        name: localized("三残痕爆发：斩金断铁"),
        defaultCount: 1,
        minCount: 0,
        step: 1,
        events: [
            sharpEvent("uppercut", "special", moveIds["特殊技：血华誓·斩金断铁"], "hit_1"),
            sharpEvent("cross_slash", "special", moveIds["特殊技：血华誓·斩金断铁"], "hit_2"),
            sharpEvent("gash_maim", "special", moveIds["特殊技：血华誓·斩金断铁"], "maim"),
        ],
    }
    const c6Group = {
        id: "claret_c6_ultimate_maim",
        name: localized("六影：终结技与免费毁伤"),
        defaultCount: 1,
        minCount: 0,
        step: 1,
        events: [
            sharpEvent("ultimate", "chain", moveIds["终结技：血华誓·千锤百炼"], "damage"),
            sharpEvent("free_maim", "special", moveIds["特殊技：血华誓·斩金断铁"], "maim"),
        ],
    }
    const defaultEvents = [{ id: "claret_default_group", kind: "skillGroup", skillGroupId: gashGroup.id, count: 1, stunned: true }]
    const cloneEvents = events => events.map(event => ({ ...event, skillRef: event.skillRef ? { ...event.skillRef } : undefined }))
    return {
        id: "claret",
        name: localized("克拉蕾·弗林特"),
        rarity: "S",
        attribute: "electric",
        damageElement: "electric",
        specialty: "armorer",
        attackTypes: ["slash", "blunt"],
        faction: "flint_workshop",
        images: {
            portrait: "/assets/agents/claret.png",
            source: pageSourceUrl(page.id),
        },
        level60: {
            hpBase: 5651,
            atkBase: 626,
            defBase: 441,
            critRate: 22.5,
            critDmg: 50,
            lacerationDmg: 150,
            impact: 93,
            anomalyProficiency: 79,
            anomalyMastery: 80,
            energyRegen: 100,
            penRatio: 0,
        },
        sharpProfile: {
            id: "armorer",
            basisStat: "def",
            baseLacerationDmgPct: 150,
            critRateCapPct: 200,
            initialCritDmgToCritRateRatio: 0.35,
        },
        combatBuffs: {
            corePassive: {
                scope: "inCombat",
                name: localized("核心被动：苍白血宴"),
                description: localized(commonDescription),
                effects: [{
                    id: "claret-sharp-state-crit-rate",
                    type: "fixed",
                    stat: "critRate",
                    value: 15,
                    mode: "flat",
                    valueSource: { kind: "corePassiveScaling", field: "critRatePct" },
                    target: { kind: "default" },
                }, {
                    id: "claret-initial-crit-dmg-to-crit-rate",
                    type: "derived",
                    scope: "outOfCombat",
                    stat: "critRate",
                    mode: "flat",
                    source: {
                        kind: "outOfCombatStat",
                        stat: "critDmg",
                        unit: "storedPercent",
                        label: localized("局外暴击伤害"),
                    },
                    ratio: 35,
                    target: { kind: "default" },
                }],
                buffModifiers: [],
            },
            additionalAbility: {
                scope: "inCombat",
                name: localized("额外能力：血裔传承"),
                description: localized("队伍中存在击破、其他锋御或同属性角色时触发；克拉蕾或队友造成毁伤后全队锋御进入残锋，锐暴伤害提升25%，持续40秒。"),
                effects: [{
                    id: "claret-remnant-edge-laceration",
                    type: "fixed",
                    stat: "lacerationDmg",
                    value: 25,
                    mode: "flat",
                    target: { kind: "default" },
                }],
                buffModifiers: [],
            },
            cinemaBuffs: [
                {
                    cinemaLevel: 1,
                    cinemaName: localized("淋漓古志"),
                    description: localized("毁伤伤害倍率提升至原本的130%。"),
                    scope: "inCombat",
                    defaultChecked: false,
                    effects: [],
                    buffModifiers: [],
                },
                {
                    cinemaLevel: 2,
                    cinemaName: localized("薪火荣冠"),
                    description: localized("猩红铭刻或连携技、终结技、反制支援、支援突击期间无视目标18%电属性伤害抗性。"),
                    scope: "inCombat",
                    defaultChecked: false,
                    effects: [{
                        id: "claret-c2-electric-res-ignore",
                        type: "fixed",
                        stat: "electricResIgnore",
                        value: 18,
                        mode: "flat",
                        target: { kind: "default" },
                    }],
                    buffModifiers: [],
                },
                {
                    cinemaLevel: 3,
                    cinemaName: localized("糖霜宣言"),
                    description: localized("普通攻击、闪避、支援技、特殊技、连携技技能等级+2。"),
                    scope: "inCombat",
                    defaultChecked: false,
                    effects: [],
                    buffModifiers: [],
                },
                {
                    cinemaLevel: 4,
                    cinemaName: localized("赤月彷徨"),
                    description: localized("强化普通攻击第三段、连携技、终结技伤害提升20%。"),
                    scope: "inCombat",
                    defaultChecked: false,
                    effects: [{
                        id: "claret-c4-selected-damage",
                        type: "fixed",
                        stat: "dmgBonus",
                        value: 20,
                        mode: "flat",
                        target: { kind: "skill", damageKinds: ["sharp"], skillTargets: [
                            specificTarget("basic", moveIds["普通攻击：血华誓·锻星"], "hit_3"),
                            specificTarget("basic", moveIds["普通攻击：血华誓·锻星"], "hit_4"),
                            specificTarget("chain", moveIds["连携技：血华誓·血契共鸣"]),
                            specificTarget("chain", moveIds["终结技：血华誓·千锤百炼"]),
                        ] },
                    }],
                    buffModifiers: [],
                },
                {
                    cinemaLevel: 5,
                    cinemaName: localized("暮血熔炉"),
                    description: localized("普通攻击、闪避、支援技、特殊技、连携技技能等级+2。"),
                    scope: "inCombat",
                    defaultChecked: false,
                    effects: [],
                    buffModifiers: [],
                },
                {
                    cinemaLevel: 6,
                    cinemaName: localized("热夜之梦"),
                    description: localized("连携技或终结技重击命中时，不消耗残痕直接触发一次单体毁伤。"),
                    scope: "inCombat",
                    defaultChecked: false,
                    effects: [],
                    buffModifiers: [],
                },
            ],
        },
        coreSkill: {
            name: localized("苍白血宴"),
            defaultLevel: "F",
            maxLevel: "F",
            levels: ["A", "B", "C", "D", "E", "F"].map(level => ({
                level,
                label: `强化${level}`,
                stats: [{ stat: "critRate", value: 4.8, mode: "flat", target: "panel" }],
                skillLevelBonuses: [{ skill: "corePassive", value: 1 }],
            })),
            corePassiveScaling: {
                name: localized("核心被动：苍白血宴"),
                levels: [
                    [15, 20], [17.5, 25], [20, 30], [22.5, 35],
                    [25, 40], [27.5, 45], [30, 50],
                ].map(([critRatePct, sharpBuildupEfficiencyPct], index) => ({
                    level: index + 1,
                    critRatePct,
                    sharpBuildupEfficiencyPct,
                })),
                defaultLevelAtCoreSkill: "F",
            },
            corePassiveMechanics: {
                sharpDamageUsesDefense: true,
                lacerationDamagePct: 150,
                critRateCapPct: 200,
                initialCritDmgToCritRateRatio: 0.35,
                gashMaximumStacks: 3,
                maimWithoutGashAtCinema6: true,
                bloodAssaultMaimModeled: false,
            },
            sources: [source],
            verification: {
                officialEntryPageId: Number(page.id),
                officialEntryVersion: String(page.version),
                coreValues: "Initial/A/B/C/D/E/F Crit Rate and remnant buildup efficiency are 15/20, 17.5/25, 20/30, 22.5/35, 25/40, 27.5/45, 30/50 percent.",
            },
        },
        preferredDriveDiscs: {
            defaultSetIds: ["zzz_wiki_2121"],
            mainStatLimits: {
                "4": ["critRate", "critDmg"],
                "5": ["electricDmg", "defPct"],
                "6": ["defPct"],
            },
        },
        skillGroups: [gashGroup, c6Group],
        defaultCalculationConfig: {
            mode: "custom",
            cinemaLevel: 0,
            name: localized("默认锋御爆发（0-5影）"),
            events: cloneEvents(defaultEvents),
            selectedEventId: defaultEvents[0].id,
            variants: [
                {
                    cinemaLevel: 3,
                    name: localized("默认锋御爆发（3-4影，最终LV14）"),
                    skillLevelsByCategory: { basic: 14, dodge: 14, assist: 14, special: 14, chain: 14 },
                    events: cloneEvents(defaultEvents),
                    selectedEventId: defaultEvents[0].id,
                },
                {
                    cinemaLevel: 5,
                    name: localized("默认锋御爆发（5影，最终LV16）"),
                    skillLevelsByCategory: { basic: 16, dodge: 16, assist: 16, special: 16, chain: 16 },
                    events: cloneEvents(defaultEvents),
                    selectedEventId: defaultEvents[0].id,
                },
                {
                    cinemaLevel: 6,
                    name: localized("默认锋御爆发（6影，终结技与免费毁伤）"),
                    skillLevelsByCategory: { basic: 16, dodge: 16, assist: 16, special: 16, chain: 16 },
                    events: [{ id: "claret_c6_group", kind: "skillGroup", skillGroupId: c6Group.id, count: 1, stunned: true }],
                    selectedEventId: "claret_c6_group",
                },
            ],
        },
        sources: [source],
        verification: {
            officialEntryPageId: Number(page.id),
            officialEntryVersion: String(page.version),
            level60Stats: "source-checked official dynamic Wiki entry; HP 5651, ATK 626, DEF 441, Impact 93, CR 22.5%, CRIT DMG 50%, Sharp/Laceration DMG 150%, AM 80, AP 79.",
            modeling: "Sharp damage is isolated from direct/sheers; blood assault's up-to-three Maim is descriptive-only because the official table has no separate Maim multiplier row.",
        },
        hidden: false,
    }
}

function fixedRule(id, stat, values, target = { kind: "default" }, extra = {}) {
    return {
        id,
        type: "fixed",
        stat,
        value: values[0],
        modificationValues: { value: values },
        mode: "flat",
        target,
        ...extra,
    }
}

function formulaRule(id, stat, expression, source, parameters, modificationValues, extra = {}) {
    return {
        id,
        type: "formula",
        stat,
        mode: "flat",
        target: { kind: "default" },
        ...extra,
        source,
        formula: {
            expression,
            valueUnit: "storedPercent",
            parameters,
            modificationValues,
        },
    }
}

function wEngine(page, config) {
    const source = pageSourceUrl(page.id)
    return {
        id: `zzz_wiki_${page.id}`,
        name: localized(page.name),
        rarity: config.rarity,
        specialty: "armorer",
        ...(Number(page.id) === 2188 ? { relatedAgentId: "claret" } : {}),
        images: {
            icon: `/assets/w-engines/zzz_wiki_${page.id}.png`,
            source: pageSourceUrl(page.id),
        },
        level60: {
            defBase: config.defBase,
            advancedStat: {
                stat: config.advancedStat,
                value: config.advancedValue,
                mode: "pct",
                target: { kind: "default" },
            },
        },
        modification: { minLevel: 1, maxLevel: 5, defaultLevel: 1 },
        effect: {
            name: localized(config.effectName),
            description: localized(config.description),
            requirement: { specialty: "armorer" },
            selfBuff: {
                scope: "inCombat",
                condition: config.condition ?? null,
                effects: config.effects,
                buffModifiers: [],
            },
            teamBuff: null,
        },
        sources: [channelUrl, source],
        verification: {
            officialEntryPageId: Number(page.id),
            officialEntryVersion: String(page.version),
            baseStat: `Level 60 Base DEF ${config.defBase}; advanced ${config.advancedStat} ${config.advancedValue}%`,
        },
        hidden: false,
    }
}

function wEngineConfigs() {
    const levels = {
        scarletCrit: [25, 27.5, 30, 32.5, 35],
        scarletElectric: [15, 17.5, 20, 22.5, 25],
        scarletSharp: [10, 11.5, 13, 14.5, 16],
        marrowPer: [0.48, 0.56, 0.64, 0.72, 0.8],
        marrowCap: [24, 28, 32, 36, 40],
        moonBasic: [18, 21, 24, 27, 30],
        catDef: [8, 9, 10, 11, 12],
    }
    return {
        2188: {
            rarity: "S", defBase: 431, advancedStat: "defPct", advancedValue: 48,
            effectName: "渴血", description: "暴击率提升25%-35%，电属性伤害提升15%-25%；发动强化特殊技或触发毁伤后，电属性锐化伤害提升10%-16%，持续40秒。",
            effects: [
                fixedRule("scarlet-crit-rate", "critRate", levels.scarletCrit),
                fixedRule("scarlet-electric-dmg", "electricDmg", levels.scarletElectric),
                fixedRule("scarlet-electric-sharp-dmg", "electricSharpDmg", levels.scarletSharp),
            ],
        },
        2189: {
            rarity: "A", defBase: 356, advancedStat: "critRate", advancedValue: 20,
            effectName: "启封之刻", description: "锋御角色暴击率超过100%时，每超出1%暴击率使造成的伤害提升0.48%-0.8%，上限24%-40%。",
            effects: [
                formulaRule(
                    "marrow-overflow-damage",
                    "dmgBonus",
                    "clamp(max(x - threshold, 0) * rate, 0, cap)",
                    {
                        kind: "inCombatStat",
                        stat: "critRate",
                        unit: "storedPercent",
                        label: localized("局内暴击率"),
                    },
                    { threshold: 100, rate: levels.marrowPer[0], cap: levels.marrowCap[0] },
                    { rate: levels.marrowPer, cap: levels.marrowCap },
                    { scope: "inCombat" },
                ),
            ],
        },
        2190: {
            rarity: "B", defBase: 282, advancedStat: "defPct", advancedValue: 32,
            effectName: "弦月", description: "发动强化特殊技时，普通攻击造成的伤害提升18%-30%，持续10秒。",
            effects: [
                fixedRule("moon-basic-damage", "dmgBonus", levels.moonBasic, {
                    kind: "skill",
                    damageKinds: ["sharp"],
                    skillTargets: [{ kind: "skillType", skillType: "basic" }],
                }),
            ],
        },
        2200: {
            rarity: "A", defBase: 356, advancedStat: "defPct", advancedValue: 40,
            effectName: "幸运肉球", description: "防御力提升8%-12%；释放强化特殊技时，防御力额外提升8%-12%，持续40秒。",
            effects: [
                fixedRule("lucky-paw-def", "defPct", levels.catDef, { kind: "default" }, { basis: "baseDef" }),
                fixedRule(
                    "lucky-paw-extra-def",
                    "defPct",
                    levels.catDef,
                    { kind: "default" },
                    { basis: "baseDef" },
                ),
            ],
        },
    }
}

async function loadExisting(file) {
    return JSON.parse(await readFile(path.join(rootDir, "data", file), "utf8"))
}

async function saveJson(file, value) {
    await writeFile(path.join(rootDir, "data", file), `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

async function downloadAsset(url, file) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Asset request failed: ${response.status} ${url}`)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, Buffer.from(await response.arrayBuffer()))
}

const pages = new Map()
browser = await chromium.launch({ headless: true })
browserContext = await browser.newContext()
const sourcePage = await browserContext.newPage()
await sourcePage.goto(pageSourceUrl(2145), { waitUntil: "domcontentloaded" })
for (const id of expectedVersions.keys()) {
    const page = (await requestJson(`${apiBase}?app_sn=zzz_wiki&entry_page_id=${id}&lang=zh-cn`)).data?.page
    if (!page || String(page.version) !== expectedVersions.get(id) || page.status !== "Online" || page.beta === true) {
        throw new Error(`Official Wiki revision mismatch for ${id}`)
    }
    pages.set(id, page)
}

const channelPayload = await requestJson(channelApi)
const expectedEngineIds = [2188, 2189, 2190, 2200]
const channelEntries = (channelPayload.data?.list ?? [])
    .find(item => Number(item?.id) === 45)?.list ?? []
const filteredEngineIds = channelEntries
    .filter(item => {
        try {
            const filters = JSON.parse(item.ext ?? "{}").c_45?.filter?.text
            return JSON.parse(filters ?? "[]").includes("特性/锋御")
        } catch {
            return false
        }
    })
    .map(item => Number(item.content_id))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)
if (JSON.stringify(filteredEngineIds) !== JSON.stringify([...expectedEngineIds].sort((left, right) => left - right))) {
    throw new Error(`Official Armorer channel filter mismatch: ${filteredEngineIds.join(",")}`)
}

const agents = await loadExisting("agents.json")
const skills = await loadExisting("agent_skills.json")
const engines = await loadExisting("w_engines.json")
agents.agents = agents.agents.filter(item => item.id !== "claret").concat(claretAgent(pages.get(2145)))
skills.agentSkills = skills.agentSkills.filter(item => item.id !== "claret").concat(skillCatalog(pages.get(2145)))
const configs = wEngineConfigs()
for (const id of expectedEngineIds) {
    engines.wEngines = engines.wEngines.filter(item => item.id !== `zzz_wiki_${id}`)
    engines.wEngines.push(wEngine(pages.get(id), configs[id]))
}
await saveJson("agents.json", agents)
await saveJson("agent_skills.json", skills)
await saveJson("w_engines.json", engines)

await downloadAsset(
    componentJson(pages.get(2145), 0).tachie_pc || componentJson(pages.get(2145), 0).role_faction,
    path.join(rootDir, "webapp", "public", "assets", "agents", "claret.png"),
)
for (const id of expectedEngineIds) {
    const image = componentJson(pages.get(id), 0).img
    await downloadAsset(image, path.join(rootDir, "webapp", "public", "assets", "w-engines", `zzz_wiki_${id}.png`))
}

const sourceDir = path.join(rootDir, "data", "sources")
await mkdir(sourceDir, { recursive: true })
await writeFile(path.join(sourceDir, "zzz-wiki-claret-armorer.json"), `${JSON.stringify({
    workflow: "Playwright page context -> official entry_page API request",
    api: apiBase,
    requestHeaders: ["x-rpc-wiki_app: zzz", "Referer: https://baike.mihoyo.com/"],
    channelApi,
    channelUrl,
    channelFilter: "特性/锋御",
    filteredEntryIds: filteredEngineIds,
    fetchedAt: "2026-09-09",
    entries: [...pages.values()].map(page => ({
        id: Number(page.id),
        name: page.name,
        version: String(page.version),
        status: page.status,
        beta: Boolean(page.beta),
        sourceUrl: pageSourceUrl(page.id),
    })),
    extractedFrom: "data.page.modules[].components[].data structured JSON; DOM text was not used for numeric values",
}, null, 2)}\n`, "utf8")

console.log(`Imported Claret and ${expectedEngineIds.length} Armorer W-Engines from pinned official revisions.`)
await browser.close()
