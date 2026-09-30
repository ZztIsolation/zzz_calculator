import assert from "node:assert/strict"
import * as fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { AgentMaintenanceHistory, agentRevision, assertAgentRevision, changedAgentFields } from "../backend/agentMaintenance.js"

assert.equal(agentRevision({ b: [1, 2], a: 1 }), agentRevision({ a: 1, b: [1, 2] }))
assert.notEqual(agentRevision({ b: [1, 2] }), agentRevision({ b: [2, 1] }))
assert.equal(agentRevision({ a: undefined, b: [undefined] }), agentRevision({ b: [null] }))
const original = { id: "agent", name: { zhCN: "原始" } }
const updated = { ...original, name: { zhCN: "修改" } }
const expectError = (fn, status) => assert.throws(fn, error => error.status === status)
expectError(() => assertAgentRevision(original), 428)
expectError(() => assertAgentRevision(original, { "if-match": "*" }), 412)
expectError(() => assertAgentRevision(updated, { "if-match": `"${agentRevision(original)}"` }), 412)
expectError(() => assertAgentRevision(null, { "if-match": `"${agentRevision(original)}"` }), 412)
expectError(() => assertAgentRevision(original, { "if-none-match": "*" }), 412)
assertAgentRevision(original, { "if-match": `"${agentRevision(original)}"` })
assertAgentRevision(null, { "if-none-match": "*" })
assert.deepEqual(changedAgentFields(original, updated), ["name.zhCN"])

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "zzz-agent-history-"))
try {
    const history = new AgentMaintenanceHistory(temp)
    const pending = await history.prepare(original, updated)
    assert.equal((await history.records())[0].record.status, "pending")
    await history.recover([updated])
    assert.equal((await history.records())[0].record.status, "committed")
    assert.deepEqual((await history.records())[0].record.before, original)
    assert.deepEqual((await history.records())[0].record.after, updated)
    const failed = await history.prepare(updated, original)
    await history.recover([updated])
    assert.equal(JSON.parse(await fs.readFile(failed.file)).status, "aborted")

    const diverged = await history.prepare(updated, original)
    await assert.rejects(history.recover([{ ...original, name: "external" }]), error => error.code === "MAINTENANCE_HISTORY_RECOVERY_REQUIRED")
    assert.equal(JSON.parse(await fs.readFile(diverged.file)).status, "pending")
    await history.abort(diverged)
    for (let index = 0; index < 33; index++) {
        await history.commit(await history.prepare({ id: "agent", index }, { id: "agent", index: index + 1 }))
    }
    assert.equal((await history.records()).filter(item => item.record.status === "committed").length, 30)
    assert.equal((await history.records()).filter(item => item.record.status === "aborted").length, 2)
    const deletion = await history.prepare(updated, null)
    await history.recover([])
    assert.equal(JSON.parse(await fs.readFile(deletion.file)).status, "committed")
    const creation = await history.prepare(null, updated)
    await history.recover([])
    assert.equal(JSON.parse(await fs.readFile(creation.file)).status, "aborted")

    const broken = new AgentMaintenanceHistory(temp, { ...fs, open: async () => { throw new Error("disk full") } })
    await assert.rejects(broken.prepare(null, { id: "not-written" }), /disk full/)
    assert.equal((await history.records()).some(item => item.record.agentId === "not-written"), false)
    const fault = await history.prepare(original, updated)
    const finalizationFailure = new AgentMaintenanceHistory(temp, { ...fs, rename: async () => { throw new Error("rename failed") } })
    await assert.rejects(finalizationFailure.commit(fault), /rename failed/)
    assert.equal(JSON.parse(await fs.readFile(fault.file)).status, "pending")
    await history.recover([updated])
    assert.equal(JSON.parse(await fs.readFile(fault.file)).status, "committed")
    assert.ok(pending.file.startsWith(temp))
} finally { await fs.rm(temp, { recursive: true, force: true }) }
console.log("agent maintenance revisions and history: ok")
