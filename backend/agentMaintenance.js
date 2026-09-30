import { createHash, randomUUID } from "node:crypto"
import * as fs from "node:fs/promises"
import path from "node:path"

export function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(item => stableJson(item) ?? "null").join(",")}]`
    if (value && typeof value === "object") {
        return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
    }
    return JSON.stringify(value)
}

export function agentRevision(agent) {
    return agent ? createHash("sha256").update(stableJson(agent)).digest("hex") : null
}

export function agentRevisions(agents = []) {
    return Object.fromEntries(agents.map(agent => [agent.id, agentRevision(agent)]))
}

export class AgentMaintenanceError extends Error {
    constructor(status, code, message, details = {}) {
        super(message)
        this.status = status
        this.code = code
        this.details = details
    }
}

export function assertAgentRevision(currentItem, headers = {}, deleting = false) {
    const match = headers["if-match"]
    const create = headers["if-none-match"]
    if ((!match && !create) || (match && create)) {
        throw new AgentMaintenanceError(428, "MAINTENANCE_REVISION_REQUIRED", "角色资料需要版本校验，请刷新维护页；本机草稿会保留。")
    }
    const revision = agentRevision(currentItem)
    const valid = create === "*" && !match && !currentItem && !deleting
        || !create && typeof match === "string" && revision && match === `"${revision}"`
    if (!valid) {
        throw new AgentMaintenanceError(412, "MAINTENANCE_EDIT_CONFLICT", currentItem
            ? "角色资料已更新，请合并最新资料后再保存。"
            : "角色已被删除，本机草稿已保留。", { currentItem: currentItem ?? null, currentRevision: revision })
    }
}

export function changedAgentFields(before, after, prefix = "") {
    if (stableJson(before) === stableJson(after)) return []
    const object = value => value && typeof value === "object" && !Array.isArray(value)
    if (object(before) && object(after)) {
        return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()
            .flatMap(key => changedAgentFields(before[key], after[key], prefix ? `${prefix}.${key}` : key))
    }
    return [prefix || "角色资料"]
}

// History is deliberately separate from catalogs and browser/user inventory data.
export class AgentMaintenanceHistory {
    constructor(dataDir, io = fs) {
        this.directory = path.join(dataDir, ".agent-history")
        this.io = io
    }

    async atomicJson(file, value) {
        await this.io.mkdir(path.dirname(file), { recursive: true })
        const temp = `${file}.${randomUUID()}.tmp`
        try {
            const handle = await this.io.open(temp, "wx")
            try {
                await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8")
                await handle.sync()
            } finally {
                await handle.close()
            }
            await this.io.rename(temp, file)
        } finally {
            await this.io.rm(temp, { force: true }).catch(() => {})
        }
    }

    async records(directory = this.directory) {
        let entries
        try { entries = await this.io.readdir(directory, { withFileTypes: true }) }
        catch (error) { if (error.code === "ENOENT") return []; throw error }
        const records = []
        for (const entry of entries) {
            const file = path.join(directory, entry.name)
            if (entry.isDirectory()) records.push(...await this.records(file))
            else if (entry.name.endsWith(".json")) records.push({ file, record: JSON.parse(await this.io.readFile(file, "utf8")) })
        }
        return records
    }

    async recover(agents) {
        const revisions = agentRevisions(agents)
        for (const { file, record } of await this.records()) {
            if (record.status !== "pending") continue
            const current = revisions[record.agentId] ?? null
            if (current === record.afterRevision) {
                await this.atomicJson(file, { ...record, status: "committed", recoveredAt: new Date().toISOString() })
                await this.prune(path.dirname(file))
            } else if (current === record.beforeRevision) {
                await this.atomicJson(file, { ...record, status: "aborted", recoveredAt: new Date().toISOString() })
            } else {
                throw new AgentMaintenanceError(503, "MAINTENANCE_HISTORY_RECOVERY_REQUIRED", "角色保存历史尚待核对，请保留草稿并检查本机历史记录后重试。")
            }
        }
    }

    async prepare(before, after) {
        const agentId = (after ?? before).id
        const operationId = randomUUID()
        const timestamp = new Date().toISOString()
        const record = {
            version: 1, operationId, timestamp, agentId, source: "maintenance-api", status: "pending",
            operation: !before ? "create" : !after ? "delete" : "update",
            beforeRevision: agentRevision(before), afterRevision: agentRevision(after),
            changedFields: changedAgentFields(before, after), before: before ?? null, after: after ?? null,
        }
        const directory = path.join(this.directory, createHash("sha256").update(agentId).digest("hex"))
        const file = path.join(directory, `${timestamp.replace(/[:.]/g, "-")}-${operationId}.json`)
        await this.atomicJson(file, record)
        return { file, record }
    }

    async commit(transaction) {
        await this.atomicJson(transaction.file, { ...transaction.record, status: "committed" })
        await this.prune(path.dirname(transaction.file))
    }

    async abort(transaction) {
        await this.atomicJson(transaction.file, { ...transaction.record, status: "aborted" })
    }

    async prune(directory) {
        const committed = (await this.records(directory)).filter(({ record }) => record.status === "committed")
            .sort((a, b) => b.record.timestamp.localeCompare(a.record.timestamp) || b.file.localeCompare(a.file))
        for (const { file } of committed.slice(30)) await this.io.rm(file)
    }
}
