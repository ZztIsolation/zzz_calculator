import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

// 玩家可见说明（各目录 JSON 中的 description.zhCN 与 condition 触发条件）只放来源原文或忠实缩减。
// 默认状态、覆盖率、未建模边界属于数据字段与角色专题，不得写成“默认…可调整”之类的尾句。
// 规则正文见 docs/character-modeling-handbook.md“九、来源与 verification”。

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const catalogFiles = [
    "agents",
    "agent_skills",
    "w_engines",
    "drive_disc_sets",
    "combat_buffs",
    "bosses",
    "anomaly_effects",
]

const forbiddenPatterns = [
    /默认(按|已|启用|关闭|开启)/,
    /可按实战/,
    /可(手动)?调整|均可调|可将.{0,12}调/,
    /独立维护/,
    /不(自动|模拟|代表|随)/,
    /手动(添加|加入)|按需/,
    /用户确认|当前录入|尚未确认|待核实|待.{0,4}确认|保守/,
    /仅保留说明|本模型/,
]

// 既有目录里已存在、由维护页保存而受保护的说明。只豁免这些条目，新增内容不得加入。
// 键格式：文件名:所属条目 id:相对路径。条目被清理后必须同步删除，否则测试失败。
const grandfathered = new Set([
    "agents:aria:combatBuffs.additionalAbility",
    "agents:sigrid:combatBuffs.additionalAbility",
    "agents:fioni:cinemaDescriptions.3",
    "agents:evelyn_chevalier:combatBuffs.cinemaBuffs.3",
    "combat_buffs:system.imbuement",
    "drive_disc_sets:zzz_wiki_2038:fourPiece.selfBuff.condition",
    "drive_disc_sets:yunkui_tales:fourPiece.selfBuff.condition",
])

function collectDescriptions(file) {
    const data = JSON.parse(readFileSync(path.join(rootDir, "data", `${file}.json`), "utf8"))
    const found = []
    const walk = (node, ownerId, relPath) => {
        if (Array.isArray(node)) {
            node.forEach((item, index) => walk(item, ownerId, relPath ? `${relPath}.${index}` : String(index)))
            return
        }
        if (!node || typeof node !== "object") return
        const nextOwner = typeof node.id === "string" ? node.id : ownerId
        const base = typeof node.id === "string" && nextOwner !== ownerId ? "" : relPath
        for (const [key, value] of Object.entries(node)) {
            const childPath = base ? `${base}.${key}` : key
            if (key === "description" && value && typeof value === "object" && typeof value.zhCN === "string") {
                found.push({ key: `${file}:${nextOwner}:${base ? `${base}` : ""}`.replace(/:$/, ""), text: value.zhCN })
                continue
            }
            if (key === "condition" && typeof value === "string") {
                found.push({ key: `${file}:${nextOwner}:${base ? `${base}.` : ""}condition`, text: value })
                continue
            }
            walk(value, nextOwner, childPath)
        }
    }
    walk(data, "", "")
    return found
}

const violations = []
const matchedGrandfathered = new Set()
let scanned = 0

for (const file of catalogFiles) {
    for (const { key, text } of collectDescriptions(file)) {
        scanned += 1
        const hit = forbiddenPatterns.find(pattern => pattern.test(text))
        if (!hit) continue
        if (grandfathered.has(key)) {
            matchedGrandfathered.add(key)
            continue
        }
        const sentence = text.split(/[。\n]/).find(part => hit.test(part)) || text
        violations.push(`${key} -> ${sentence.slice(0, 60)}`)
    }
}

assert.ok(scanned > 100, `description/condition scan looks too small (${scanned}); walker may be broken`)
assert.deepEqual(
    violations,
    [],
    `玩家可见说明含默认值/覆盖率/未建模边界等防御性文字，请改放角色专题或数据字段：\n${violations.join("\n")}`,
)
const stale = [...grandfathered].filter(key => !matchedGrandfathered.has(key))
assert.deepEqual(stale, [], `白名单条目已不再命中，请从 tests/description-style.test.js 删除：\n${stale.join("\n")}`)

console.log(`description-style ok (${scanned} descriptions/conditions, ${matchedGrandfathered.size} grandfathered)`)
