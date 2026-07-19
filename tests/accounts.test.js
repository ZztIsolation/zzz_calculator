import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
    accountSummary,
    createAccount,
    deleteAccount,
    deleteUserDriveDisc,
    importScannerExportToStore,
    loadCurrentUserDriveDiscStore,
    loadUserDriveDiscStore,
    switchAccount,
    updateAccount,
    upsertDriveDiscLoadout,
    upsertUserDriveDisc,
} from "../backend/driveDiscInventory.js"

function scannerDisc(sequence, setName = "流光咏叹") {
    return {
        "序号": sequence,
        "名称": setName,
        "槽位": 1,
        "品质": "S",
        "等级": 15,
        "最大等级": 15,
        "主属性": { "生命值": 2200 },
        "副属性": [
            { "攻击力": "6%" },
            { "暴击率": "4.8%" },
            { "暴击伤害": "14.4%" },
        ],
    }
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), "zzz-accounts-"))

try {
    await writeFile(path.join(tempDir, "user_drive_discs.json"), JSON.stringify({
        version: 1,
        owners: [{ id: "default", label: "默认用户" }],
        driveDiscs: [],
        driveDiscLoadouts: [],
        imports: [],
    }), "utf8")

    let store = await loadUserDriveDiscStore(tempDir)
    assert.equal(store.currentOwnerId, "default")
    assert.equal(store.owners[0].id, "default")

    const created = await createAccount(tempDir, { id: "alt", label: "二号账号" })
    assert.equal(created.account.id, "alt")
    assert.equal(created.summary.owners.length, 2)

    const renamed = await updateAccount(tempDir, "alt", { label: "小号" })
    assert.equal(renamed.account.label, "小号")

    await importScannerExportToStore(tempDir, [scannerDisc(1)], { sourcePath: "default.json" })
    await switchAccount(tempDir, "alt")
    await importScannerExportToStore(tempDir, [scannerDisc(1), scannerDisc(2, "摇摆爵士")], { sourcePath: "alt.json" })

    const current = await loadCurrentUserDriveDiscStore(tempDir)
    assert.equal(current.currentOwnerId, "alt")
    assert.equal(current.driveDiscs.length, 2)
    assert.ok(current.driveDiscs.every(item => item.ownerId === "alt"))

    store = await loadUserDriveDiscStore(tempDir)
    assert.equal(store.driveDiscs.filter(item => item.ownerId === "default").length, 1)
    assert.equal(store.driveDiscs.filter(item => item.ownerId === "alt").length, 2)

    const removed = await importScannerExportToStore(tempDir, [scannerDisc(1)], { removeMissing: true })
    assert.equal(removed.lastImportSummary.removed, 1)
    store = await loadUserDriveDiscStore(tempDir)
    assert.equal(store.driveDiscs.filter(item => item.ownerId === "default").length, 1)
    assert.equal(store.driveDiscs.filter(item => item.ownerId === "alt").length, 1)

    const sharedIdDisc = {
        id: "shared-manual-id",
        setName: "账号隔离测试",
        partition: 3,
        rarity: "S",
        level: 15,
        mainStat: { stat: "defFlat", mode: "flat", value: 183 },
        subStats: [],
    }
    await upsertUserDriveDisc(tempDir, { ...sharedIdDisc, ownerId: "default" })
    await upsertUserDriveDisc(tempDir, { ...sharedIdDisc, ownerId: "alt", setName: "二号账号隔离测试" })
    await upsertDriveDiscLoadout(tempDir, {
        id: "shared-loadout",
        agentId: "ye_shunguang",
        ownerId: "default",
        driveDiscIdsBySlot: { 3: sharedIdDisc.id },
    })
    await upsertDriveDiscLoadout(tempDir, {
        id: "shared-loadout",
        agentId: "ye_shunguang",
        ownerId: "alt",
        driveDiscIdsBySlot: { 3: sharedIdDisc.id },
    })
    store = await loadUserDriveDiscStore(tempDir)
    assert.equal(store.driveDiscs.filter(item => item.id === sharedIdDisc.id).length, 2)

    await assert.rejects(() => deleteAccount(tempDir, "alt"), /current account/i)
    await switchAccount(tempDir, "default")
    const deletedSharedDisc = await deleteUserDriveDisc(tempDir, sharedIdDisc.id)
    assert.equal(deletedSharedDisc.deleted, true)
    store = await loadUserDriveDiscStore(tempDir)
    const defaultSharedLoadout = store.driveDiscLoadouts.find(item => item.id === "shared-loadout" && item.ownerId === "default")
    const altSharedLoadout = store.driveDiscLoadouts.find(item => item.id === "shared-loadout" && item.ownerId === "alt")
    assert.equal(defaultSharedLoadout.driveDiscIdsBySlot["3"], undefined)
    assert.ok(defaultSharedLoadout.missingSlots.includes(3))
    assert.ok(defaultSharedLoadout.missingDriveDiscIds.includes(sharedIdDisc.id))
    assert.equal(altSharedLoadout.driveDiscIdsBySlot["3"], sharedIdDisc.id)
    assert.equal(store.driveDiscs.some(item => item.id === sharedIdDisc.id && item.ownerId === "alt"), true)

    const deleted = await deleteAccount(tempDir, "alt")
    assert.equal(deleted.deleted, true)
    const summary = await accountSummary(tempDir)
    assert.equal(summary.owners.some(owner => owner.id === "alt"), false)
    store = await loadUserDriveDiscStore(tempDir)
    assert.equal(store.driveDiscs.some(item => item.ownerId === "alt"), false)
    assert.equal(store.driveDiscs.some(item => item.id === sharedIdDisc.id), false)
} finally {
    await rm(tempDir, { recursive: true, force: true })
}
