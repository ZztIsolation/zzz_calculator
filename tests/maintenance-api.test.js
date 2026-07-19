import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { createServer as createNetServer } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceDataDir = path.join(rootDir, "data")
const tempRoot = await mkdtemp(path.join(tmpdir(), "zzz-calculator-maintenance-"))
const tempDataDir = path.join(tempRoot, "data")
const port = await availablePort()
const baseUrl = `http://127.0.0.1:${port}`
let server = null
let serverOutput = ""

function availablePort() {
    return new Promise((resolve, reject) => {
        const probe = createNetServer()
        probe.unref()
        probe.once("error", reject)
        probe.listen(0, "127.0.0.1", () => {
            const address = probe.address()
            const selectedPort = typeof address === "object" && address ? address.port : 0
            probe.close(error => error ? reject(error) : resolve(selectedPort))
        })
    })
}

async function request(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, options)
    const body = await response.json().catch(() => ({}))
    assert.equal(response.ok, true, `${options.method ?? "GET"} ${pathname}: ${response.status} ${JSON.stringify(body)}`)
    assert.notEqual(body.ok, false, `${options.method ?? "GET"} ${pathname}: ${JSON.stringify(body)}`)
    return body
}

async function catalog() {
    return (await request("/api/maintenance/catalog")).data
}

async function save(resource, item, origin = baseUrl) {
    const response = await fetch(`${baseUrl}/api/maintenance/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify(item),
    })
    const body = await response.json().catch(() => ({}))
    assert.equal(response.ok, true, `POST ${resource}: ${response.status} ${JSON.stringify(body)}`)
    assert.notEqual(body.ok, false)
    assert.equal(response.headers.get("access-control-allow-origin"), origin)
    return body
}

async function saveRejected(resource, item, expectedText) {
    const response = await fetch(`${baseUrl}/api/maintenance/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: baseUrl },
        body: JSON.stringify(item),
    })
    const body = await response.json().catch(() => ({}))
    assert.equal(response.status, 400, `POST ${resource} should reject unsupported legacy filters`)
    assert.equal(body.ok, false)
    assert.match(String(body.error ?? ""), new RegExp(expectedText))
    return body
}

async function remove(pathname) {
    return request(pathname, { method: "DELETE", headers: { Origin: baseUrl } })
}

async function waitForServer() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            const response = await fetch(`${baseUrl}/api/health`)
            if (response.ok) {
                return
            }
        } catch {
            // Server startup races are expected.
        }
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`Maintenance integration server did not start.\n${serverOutput}`)
}

function cloneWithId(item, suffix) {
    return {
        ...structuredClone(item),
        id: `${item.id}__${suffix}`,
    }
}

try {
    await mkdir(tempDataDir, { recursive: true })
    for (const fileName of await readdir(sourceDataDir)) {
        if (fileName.endsWith(".json") && fileName !== "user_drive_discs.json") {
            await copyFile(path.join(sourceDataDir, fileName), path.join(tempDataDir, fileName))
        }
    }

    server = spawn(process.execPath, ["backend/server.js"], {
        cwd: rootDir,
        env: {
            ...process.env,
            NODE_ENV: "production",
            MAINTENANCE_ENABLED: "true",
            PORT: String(port),
            ZZZ_CALCULATOR_DATA_DIR: tempDataDir,
            MAINTENANCE_ALLOWED_ORIGINS: "https://trusted.example",
        },
        stdio: ["ignore", "pipe", "pipe"],
    })
    server.stdout.on("data", chunk => { serverOutput += chunk.toString() })
    server.stderr.on("data", chunk => { serverOutput += chunk.toString() })
    await waitForServer()

    const crossOriginCatalog = await fetch(`${baseUrl}/api/catalog`, {
        headers: { Origin: "https://read-only.example" },
    })
    assert.equal(crossOriginCatalog.status, 200)
    assert.equal(crossOriginCatalog.headers.get("access-control-allow-origin"), "*")

    for (const [method, pathname] of [
        ["POST", "/api/maintenance/agents"],
        ["DELETE", "/api/maintenance/agents/agent_a"],
        ["OPTIONS", "/api/maintenance/agents"],
    ]) {
        const response = await fetch(`${baseUrl}${pathname}`, {
            method,
            headers: {
                Origin: `http://evil.example:${port}`,
                Host: `evil.example:${port}`,
                "Content-Type": "application/json",
                ...(method === "OPTIONS" ? { "Access-Control-Request-Method": "POST" } : {}),
            },
            ...(method === "POST" ? { body: "{}" } : {}),
        })
        assert.equal(response.status, 403, `${method} maintenance request from a foreign Origin must be rejected`)
        assert.match((await response.json()).error, /cross-origin/i)
    }

    const genericResources = [
        ["agents", data => data.agents.agents],
        ["agent-skills", data => data.agentSkills.agentSkills],
        ["w-engines", data => data.wEngines.wEngines],
        ["drive-disc-sets", data => data.driveDiscSets.sets],
        ["field-buffs", data => data.combatBuffs.fieldBuffs],
    ]

    for (const [resource, itemsFor] of genericResources) {
        const before = await catalog()
        const source = itemsFor(before)[0]
        assert.ok(source, `${resource} fixture must exist`)
        const copy = cloneWithId(source, "maintenance_api_copy")
        const result = await save(resource, copy, resource === "agents" ? "https://trusted.example" : baseUrl)
        const savedId = result.savedItem.id
        assert.equal(savedId, copy.id, `${resource} must preserve an existing internal id`)
        assert.ok(savedId)
        assert.ok(itemsFor(await catalog()).some(item => item.id === savedId), `${resource} save must persist after full reload`)
        await remove(`/api/maintenance/${resource}/${encodeURIComponent(savedId)}`)
        assert.equal(itemsFor(await catalog()).some(item => item.id === savedId), false, `${resource} delete must persist after full reload`)

        const idless = structuredClone(source)
        delete idless.id
        if (resource === "agents") {
            delete idless.skillGroups
            delete idless.defaultCalculationConfig
        }
        if (resource === "field-buffs") {
            idless.name = { zhCN: "自动标识场地 Buff" }
        }
        const generatedResult = await save(resource, idless)
        const generatedId = generatedResult.savedItem.id
        assert.ok(generatedId, `${resource} must generate an internal id`)
        assert.notEqual(generatedId, source.id)
        assert.ok(itemsFor(await catalog()).some(item => item.id === generatedId), `${resource} idless save must persist`)
        await remove(`/api/maintenance/${resource}/${encodeURIComponent(generatedId)}`)
    }

    const driveDiscCatalog = await catalog()
    const driveDiscSource = driveDiscCatalog.driveDiscSets.sets.find(item => item.fourPiece?.selfBuff)
    assert.ok(driveDiscSource, "drive-disc fixture with a four-piece self Buff must exist")
    const targetedDriveDisc = cloneWithId(driveDiscSource, "maintenance_api_skill_target")
    targetedDriveDisc.fourPiece.selfBuff.effects = [{
        id: "maintenance_api_drive_disc_skill_target",
        type: "fixed",
        target: {
            kind: "skill",
            skillTargets: [{ kind: "skillType", skillType: "ultimate" }],
        },
        stat: "dmgBonus",
        mode: "flat",
        value: 20,
    }]
    delete targetedDriveDisc.fourPiece.selfBuff.scope
    const firstTargetedDriveDiscSave = await save("drive-disc-sets", targetedDriveDisc)
    assert.equal(firstTargetedDriveDiscSave.savedItem.fourPiece.selfBuff.scope, undefined)
    assert.deepEqual(firstTargetedDriveDiscSave.savedItem.fourPiece.selfBuff.effects[0].target.skillTargets, [
        { kind: "skillType", skillType: "ultimate" },
    ])
    const reloadedTargetedDriveDisc = (await catalog()).driveDiscSets.sets.find(item => item.id === targetedDriveDisc.id)
    assert.ok(reloadedTargetedDriveDisc, "targeted drive-disc save must persist after reload")
    const secondTargetedDriveDiscSave = await save("drive-disc-sets", reloadedTargetedDriveDisc)
    assert.equal(secondTargetedDriveDiscSave.savedItem.fourPiece.selfBuff.scope, undefined)
    assert.deepEqual(secondTargetedDriveDiscSave.savedItem.fourPiece.selfBuff.effects[0].target.skillTargets, [
        { kind: "skillType", skillType: "ultimate" },
    ])
    await remove(`/api/maintenance/drive-disc-sets/${encodeURIComponent(targetedDriveDisc.id)}`)

    const managedAgentCatalog = await catalog()
    const managedAgent = structuredClone(managedAgentCatalog.agents.agents.find(item => item.skillGroups?.length && item.combatBuffs?.corePassive?.effects?.some(rule => rule.coverage)))
    assert.ok(managedAgent, "agent fixture with skill groups and coverage must exist")
    Object.assign(managedAgent.skillGroups[0], { defaultCount: 9, minCount: 2, maxCount: 3, step: 0.5 })
    managedAgent.skillGroups[0].events[0].stunned = false
    const managedCoverageRule = managedAgent.combatBuffs.corePassive.effects.find(rule => rule.coverage)
    Object.assign(managedCoverageRule.coverage, { default: 0.65, min: 0.4, max: 0.6, step: 0.2 })
    const managedAgentResult = await save("agents", managedAgent)
    assert.deepEqual(
        {
            defaultCount: managedAgentResult.savedItem.skillGroups[0].defaultCount,
            minCount: managedAgentResult.savedItem.skillGroups[0].minCount,
            maxCount: managedAgentResult.savedItem.skillGroups[0].maxCount,
            step: managedAgentResult.savedItem.skillGroups[0].step,
        },
        { defaultCount: 1, minCount: 0, maxCount: 100, step: 1 },
    )
    assert.equal(managedAgentResult.savedItem.combatBuffs.corePassive.coverage, undefined)
    assert.equal(managedAgentResult.savedItem.skillGroups[0].events[0].stunned, false)
    assert.deepEqual(
        managedAgentResult.savedItem.combatBuffs.corePassive.effects.find(rule => rule.id === managedCoverageRule.id).coverage,
        { default: 0.65, min: 0, max: 1, step: 0.1 },
    )

    const timedAgent = structuredClone(managedAgentResult.savedItem)
    const disorderEffects = (await catalog()).anomalyEffects.effects.filter(item => item.settlementType === "disorder")
    const halfSecondDisorderEffect = disorderEffects.find(item => item.tickIntervalSeconds === 0.5)
    const wholeSecondDisorderEffect = disorderEffects.find(item => item.tickIntervalSeconds === 1)
    assert.ok(halfSecondDisorderEffect && wholeSecondDisorderEffect, "both Disorder interval fixtures must exist for elapsed-time cleaning")
    timedAgent.defaultCalculationConfig = {
        mode: "custom",
        selectedEventId: "maintenance-api-disorder",
        events: [
            {
                id: "maintenance-api-disorder",
                kind: "anomaly",
                settlementType: "disorder",
                anomalyEffect: halfSecondDisorderEffect.id,
                disorderType: "normal",
                elapsedSeconds: 3.2,
                count: 1,
                stunned: false,
            },
            {
                id: "maintenance-api-disorder-whole-second",
                kind: "anomaly",
                settlementType: "disorder",
                anomalyEffect: wholeSecondDisorderEffect.id,
                disorderType: "normal",
                elapsedSeconds: 4.5,
                count: 1,
                stunned: true,
            },
            {
                id: "maintenance-api-disorder-clamped",
                kind: "anomaly",
                settlementType: "disorder",
                anomalyEffect: wholeSecondDisorderEffect.id,
                disorderType: "normal",
                elapsedSeconds: Number(wholeSecondDisorderEffect.defaultDurationSeconds) + 20,
                count: 1,
                stunned: true,
            },
        ],
    }
    const timedAgentResult = await save("agents", timedAgent)
    assert.equal(timedAgentResult.savedItem.defaultCalculationConfig.events[0].elapsedSeconds, 3)
    assert.equal(timedAgentResult.savedItem.defaultCalculationConfig.events[0].stunned, false)
    assert.equal(timedAgentResult.savedItem.defaultCalculationConfig.events[1].elapsedSeconds, 5)
    assert.equal(
        timedAgentResult.savedItem.defaultCalculationConfig.events[2].elapsedSeconds,
        Number(wholeSecondDisorderEffect.defaultDurationSeconds) + 20,
        "elapsed Disorder time beyond the base duration must survive maintenance save",
    )

    const anomalyData = await catalog()
    const anomalySource = anomalyData.anomalyEffects.effects[0]
    const anomalyCopy = cloneWithId(anomalySource, "maintenance_api_copy")
    const anomalyResult = await save("anomaly-effects", anomalyCopy)
    const anomalySaved = anomalyResult.savedItem
    assert.ok((await catalog()).anomalyEffects.effects.some(item => item.id === anomalySaved.id))
    await remove(`/api/maintenance/anomaly-effects/${encodeURIComponent(anomalySaved.maintenanceType)}/${encodeURIComponent(anomalySaved.id)}`)
    assert.equal((await catalog()).anomalyEffects.effects.some(item => item.id === anomalySaved.id), false)

    const idlessAnomaly = structuredClone(anomalySource)
    delete idlessAnomaly.id
    const generatedAnomaly = (await save("anomaly-effects", idlessAnomaly)).savedItem
    assert.match(generatedAnomaly.id, /^anomaly_[0-9a-f]{10}$/)
    await remove(`/api/maintenance/anomaly-effects/${encodeURIComponent(generatedAnomaly.maintenanceType)}/${encodeURIComponent(generatedAnomaly.id)}`)

    const bossData = await catalog()
    const fieldTemplate = bossData.combatBuffs.fieldBuffs[0]
    const bossTemplate = {
        sourceType: "boss",
        scope: "inCombat",
        bossName: { zhCN: "集成测试 Boss" },
        bossSource: { zhCN: "集成测试" },
        sourcePeriod: { zhCN: "集成测试期" },
        description: { zhCN: "使用真实后端契约验证 Boss Buff。" },
        coverage: { default: 0.6, min: 0.4, max: 0.6, step: 0.2 },
        effects: structuredClone(fieldTemplate.effects).map(({ coverage: _coverage, ...rule }) => rule),
        buffModifiers: structuredClone(fieldTemplate.buffModifiers ?? []),
    }
    const bossCopies = [1, 2].map(index => ({
        ...structuredClone(bossTemplate),
        id: `boss__maintenance_api_concurrent_${index}`,
        bossName: { zhCN: `并发集成测试 Boss ${index}` },
    }))
    const bossResults = await Promise.all(bossCopies.map(item => save("boss-buffs", item)))
    const catalogAfterConcurrentBossSaves = await catalog()
    for (const result of bossResults) {
        assert.ok(catalogAfterConcurrentBossSaves.combatBuffs.bossBuffs.some(item => item.id === result.savedItem.id))
    }
    await Promise.all(bossResults.map(result => remove(`/api/maintenance/boss-buffs/${encodeURIComponent(result.savedItem.id)}`)))
    const catalogAfterConcurrentBossDeletes = await catalog()
    for (const result of bossResults) {
        assert.equal(catalogAfterConcurrentBossDeletes.combatBuffs.bossBuffs.some(item => item.id === result.savedItem.id), false)
    }

    const generatedBoss = (await save("boss-buffs", bossTemplate)).savedItem
    assert.match(generatedBoss.id, /^boss_buff_[0-9a-f]{10}$/)
    assert.equal(generatedBoss.coverage, undefined)
    assert.ok(generatedBoss.effects.length > 1)
    assert.ok(generatedBoss.effects.every(rule => JSON.stringify(rule.coverage) === JSON.stringify({ default: 0.6, min: 0, max: 1, step: 0.1 })))
    await remove(`/api/maintenance/boss-buffs/${encodeURIComponent(generatedBoss.id)}`)

    const bossArchiveTemplate = bossData.bosses.bosses[0]
    const { encounters: _encounters, ...bossProfileTemplate } = bossArchiveTemplate
    const groupedBoss = {
        ...structuredClone(bossProfileTemplate),
        id: "boss.maintenance_api_grouped",
        name: { zhCN: "分组维护集成测试 Boss" },
    }
    const groupedEncounter = {
        ...structuredClone(bossArchiveTemplate.encounters[0]),
        id: "boss_encounter.maintenance_api_grouped.p1",
        appearances: [{ modeId: "critical_assault", gameVersion: "9.9", phaseNo: 1 }],
        mechanics: [{ id: "legacy_mechanic", name: { zhCN: "旧机制" }, description: { zhCN: "应被剥离" } }],
        scoreRules: [{ id: "legacy_score", score: 100, description: { zhCN: "应被剥离" } }],
    }
    const groupedResult = await save("boss-buffs", { boss: groupedBoss, encounter: groupedEncounter })
    assert.equal(groupedResult.savedBoss.id, groupedBoss.id)
    assert.equal(groupedResult.savedEncounter.id, groupedEncounter.id)
    assert.equal(groupedResult.savedItem.id, groupedEncounter.id)
    for (const value of [groupedResult.savedEncounter, groupedResult.savedItem]) {
        assert.equal("mechanics" in value, false)
        assert.equal("scoreRules" in value, false)
    }
    assert.equal(groupedResult.data.version, 2)
    assert.ok(groupedResult.meta.bossCombatBuffs.every(item => !("mechanics" in item) && !("scoreRules" in item)))
    const groupedSavedBoss = (await catalog()).bosses.bosses.find(item => item.id === groupedBoss.id)
    assert.ok(groupedSavedBoss)
    assert.equal("mechanics" in groupedSavedBoss.encounters[0], false)
    assert.equal("scoreRules" in groupedSavedBoss.encounters[0], false)

    const concurrentEncounters = [2, 3].map(phaseNo => ({
        ...structuredClone(groupedEncounter),
        id: `boss_encounter.maintenance_api_grouped.p${phaseNo}`,
        appearances: [{ modeId: "critical_assault", gameVersion: "9.9", phaseNo }],
    }))
    await Promise.all(concurrentEncounters.map(encounter => save("boss-buffs", { boss: groupedBoss, encounter })))
    const groupedAfterConcurrentSave = (await catalog()).bosses.bosses.find(item => item.id === groupedBoss.id)
    assert.deepEqual(groupedAfterConcurrentSave.encounters.map(item => item.id).sort(), [groupedEncounter, ...concurrentEncounters].map(item => item.id).sort())

    await remove(`/api/maintenance/boss-buffs/${encodeURIComponent(groupedBoss.id)}/${encodeURIComponent(concurrentEncounters[0].id)}`)
    const groupedAfterEncounterDelete = (await catalog()).bosses.bosses.find(item => item.id === groupedBoss.id)
    assert.equal(groupedAfterEncounterDelete.encounters.some(item => item.id === concurrentEncounters[0].id), false)
    await remove(`/api/maintenance/boss-buffs/${encodeURIComponent(groupedBoss.id)}`)
    assert.equal((await catalog()).bosses.bosses.some(item => item.id === groupedBoss.id), false)

    const teammateData = await catalog()
    const teammateSource = teammateData.combatBuffs.teammates.find(item => item.buffs?.length)
    assert.ok(teammateSource, "teammate Buff fixture must exist")
    const { buffs: _buffs, ...teammateBase } = teammateSource
    const teammateId = `${teammateSource.id}__maintenance_api_copy`
    const buff = cloneWithId(teammateSource.buffs[0], "maintenance_api_copy")
    buff.scope = "inCombat"
    buff.effects = [
        {
            id: "legacy_chain_target",
            type: "fixed",
            stat: "dmgBonus",
            mode: "flat",
            value: 20,
            target: { kind: "skill", skillTargets: [{ categoryId: "chain", moveIdPrefixes: ["chain_"] }] },
        },
        {
            id: "legacy_element_damage",
            type: "fixed",
            stat: "dmgBonus",
            mode: "flat",
            value: 15,
            appliesTo: { elements: ["physical", "fire"] },
        },
        {
            id: "all_res_ignore",
            type: "fixed",
            stat: "allResIgnore",
            mode: "flat",
            value: 15,
            target: { kind: "skill", skillTargets: [{ kind: "skillType", skillType: "ultimate" }] },
        },
        {
            id: "flinch_duration",
            type: "fixed",
            stat: "anomalyDurationBonusSeconds",
            mode: "flat",
            value: 5,
            target: { kind: "anomaly", settlementType: "disorder", anomalyEffects: ["flinch"] },
        },
    ]
    const teammateResult = await save("teammate-buffs", {
        teammate: { ...teammateBase, id: teammateId },
        buff,
    })
    assert.equal(teammateResult.savedItem.teammateId, teammateId)
    assert.equal(teammateResult.savedItem.teammateName.zhCN, teammateBase.name.zhCN)
    assert.deepEqual(teammateResult.savedItem.effects[0].target.skillTargets, [{ kind: "skillType", skillType: "chain" }])
    assert.deepEqual(teammateResult.savedItem.effects.slice(1, 3).map(rule => rule.stat), ["physicalDmg", "fireDmg"])
    const savedAllResIgnore = teammateResult.savedItem.effects[3]
    assert.equal(savedAllResIgnore.id, "all_res_ignore")
    assert.equal(savedAllResIgnore.stat, "allResIgnore")
    assert.equal(savedAllResIgnore.value, 15)
    assert.deepEqual(savedAllResIgnore.target, {
        kind: "skill",
        skillTargets: [{ kind: "skillType", skillType: "ultimate" }],
    })
    const savedFlinchDuration = teammateResult.savedItem.effects[4]
    assert.equal(savedFlinchDuration.stat, "anomalyDurationBonusSeconds")
    assert.deepEqual(savedFlinchDuration.target, {
        kind: "anomaly",
        settlementType: "disorder",
        anomalyEffects: ["flinch"],
    })
    assert.equal(JSON.stringify(teammateResult.savedItem).includes("moveIdPrefixes"), false)
    assert.equal(JSON.stringify(teammateResult.savedItem).includes("appliesTo"), false)
    const reloadedTeammate = (await catalog()).combatBuffs.teammates.find(item => item.id === teammateId)
    assert.equal(reloadedTeammate?.attribute, teammateBase.attribute)
    assert.equal(reloadedTeammate?.specialty, teammateBase.specialty)
    const reloadedTeammateBuff = reloadedTeammate?.buffs.find(item => item.id === buff.id)
    assert.ok(reloadedTeammateBuff)
    assert.equal(reloadedTeammateBuff.effects.find(rule => rule.id === "all_res_ignore")?.stat, "allResIgnore")
    assert.deepEqual(reloadedTeammateBuff.effects.find(rule => rule.id === "flinch_duration")?.target, savedFlinchDuration.target)

    const orderSecondBuff = cloneWithId(reloadedTeammateBuff, "order_second")
    const orderThirdBuff = cloneWithId(reloadedTeammateBuff, "order_third")
    await save("teammate-buffs", {
        teammate: { ...teammateBase, id: teammateId },
        buff: orderSecondBuff,
    })
    assert.deepEqual(
        (await catalog()).combatBuffs.teammates.find(item => item.id === teammateId)?.buffs.map(item => item.id),
        [buff.id, orderSecondBuff.id],
        "legacy teammate saves without buffOrder should preserve the existing order and append new Buffs",
    )

    const requestedBuffOrder = [orderThirdBuff.id, buff.id, orderSecondBuff.id]
    await save("teammate-buffs", {
        teammate: { ...teammateBase, id: teammateId },
        buff: orderThirdBuff,
        buffOrder: requestedBuffOrder,
    })
    assert.deepEqual(
        (await catalog()).combatBuffs.teammates.find(item => item.id === teammateId)?.buffs.map(item => item.id),
        requestedBuffOrder,
        "teammate maintenance should persist the complete requested Buff order atomically",
    )

    for (const invalidOrder of [
        requestedBuffOrder.slice(0, 2),
        [orderThirdBuff.id, buff.id, buff.id],
        [orderThirdBuff.id, buff.id, "unknown_buff"],
    ]) {
        await saveRejected("teammate-buffs", {
            teammate: { ...teammateBase, id: teammateId },
            buff: structuredClone(reloadedTeammateBuff),
            buffOrder: invalidOrder,
        }, "Buff 顺序")
        assert.deepEqual(
            (await catalog()).combatBuffs.teammates.find(item => item.id === teammateId)?.buffs.map(item => item.id),
            requestedBuffOrder,
            "invalid or stale Buff orders must not partially update the catalog",
        )
    }

    await remove(`/api/maintenance/teammate-buffs/${encodeURIComponent(teammateId)}/${encodeURIComponent(buff.id)}`)
    assert.equal((await catalog()).combatBuffs.teammates
        .find(item => item.id === teammateId)?.buffs.some(item => item.id === buff.id), false)

    const unsupportedLegacyBuff = cloneWithId(teammateSource.buffs[0], "unsupported_legacy_filter")
    unsupportedLegacyBuff.effects = [{
        id: "legacy_anomaly_filter",
        type: "fixed",
        target: { kind: "default" },
        stat: "anomalyDamageBonus",
        mode: "flat",
        value: 20,
        appliesTo: { anomalyEffects: ["burn"] },
    }]
    await saveRejected("teammate-buffs", {
        teammate: { ...teammateBase, id: `${teammateId}__unsupported` },
        buff: unsupportedLegacyBuff,
    }, "旧适用范围")

    await saveRejected("teammate-buffs", {
        teammate: { name: { zhCN: "缺少属性队友" }, specialty: "support" },
        buff: structuredClone(teammateSource.buffs[0]),
    }, "teammate.attribute")

    const generatedTeammateInput = {
        teammate: {
            name: { zhCN: "自动标识队友" },
            attribute: teammateBase.attribute,
            specialty: teammateBase.specialty,
            images: structuredClone(teammateBase.images ?? {}),
        },
        buff: structuredClone(teammateSource.buffs[0]),
    }
    delete generatedTeammateInput.buff.id
    const generatedTeammate = (await save("teammate-buffs", generatedTeammateInput)).savedItem
    assert.match(generatedTeammate.teammateId, /^teammate_[0-9a-f]{10}$/)
    assert.match(generatedTeammate.id, /^buff_[0-9a-f]{10}$/)
    await remove(`/api/maintenance/teammate-buffs/${encodeURIComponent(generatedTeammate.teammateId)}`)
    assert.equal((await catalog()).combatBuffs.teammates.some(item => item.id === generatedTeammate.teammateId), false)

    assert.equal((await readdir(tempDataDir)).some(fileName => fileName.endsWith(".tmp")), false)

    console.log("maintenance API integration: ok (8 resources, generated ids, teammate group delete, same-origin guard, atomic concurrent writes)")
} finally {
    server?.kill()
    await rm(tempRoot, { recursive: true, force: true })
}
