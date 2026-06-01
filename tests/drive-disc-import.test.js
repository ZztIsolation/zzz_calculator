import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
    importScannerExportToStore,
    loadUserDriveDiscStore,
    saveUserDriveDiscStore,
} from "../backend/driveDiscInventory.js"

function scannerDisc(sequence, overrides = {}) {
    return {
        "序号": sequence,
        "名称": overrides.setName ?? "流光咏叹",
        "槽位": overrides.partition ?? 1,
        "品质": overrides.rarity ?? "S",
        "等级": overrides.level ?? 15,
        "最大等级": overrides.maxLevel ?? 15,
        "主属性": overrides.mainStat ?? { "生命值": 2200 },
        "副属性": overrides.subStats ?? [
            { "攻击力": "6%" },
            { "暴击率": "4.8%" },
            { "暴击伤害": "14.4%" },
            { "攻击力": 38 },
        ],
    }
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), "zzz-disc-import-"))

try {
    const first = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
        scannerDisc(2, { partition: 2, mainStat: { "攻击力": 316 } }),
    ], { ownerId: "default", sourcePath: "first.json" })
    assert.equal(first.driveDiscs.length, 2)
    assert.deepEqual(first.lastImportSummary, {
        added: 2,
        skipped: 0,
        updated: 0,
        removed: 0,
        duplicateInImport: 0,
        warnings: [],
    })

    const second = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
        scannerDisc(2, { partition: 2, mainStat: { "攻击力": 316 } }),
    ], { ownerId: "default", sourcePath: "second.json" })
    assert.equal(second.driveDiscs.length, 2)
    assert.equal(second.lastImportSummary.added, 0)
    assert.equal(second.lastImportSummary.skipped, 2)

    const upgraded = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
        scannerDisc(2, { partition: 2, mainStat: { "攻击力": 316 } }),
        scannerDisc(3, {
            partition: 3,
            level: 12,
            mainStat: { "防御力": 184 },
            subStats: [
                { "攻击力": "3%" },
                { "暴击率": "2.4%" },
                { "暴击伤害": "4.8%" },
            ],
        }),
    ], { ownerId: "default", sourcePath: "third.json" })
    const level12 = upgraded.driveDiscs.find(item => Number(item.partition) === 3)
    assert.ok(level12)
    const level12Id = level12.id

    const fourth = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
        scannerDisc(2, { partition: 2, mainStat: { "攻击力": 316 } }),
        scannerDisc(3, {
            partition: 3,
            level: 15,
            mainStat: { "防御力": 184 },
            subStats: [
                { "攻击力": "6%" },
                { "暴击率": "4.8%" },
                { "暴击伤害": "9.6%" },
            ],
        }),
    ], { ownerId: "default", sourcePath: "fourth.json" })
    const level15 = fourth.driveDiscs.find(item => Number(item.partition) === 3)
    assert.equal(level15.id, level12Id)
    assert.equal(level15.level, 15)
    assert.equal(fourth.lastImportSummary.updated, 1)

    const withDuplicate = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
        scannerDisc(1),
    ], { ownerId: "default", sourcePath: "duplicate.json" })
    assert.equal(withDuplicate.lastImportSummary.duplicateInImport, 1)
    assert.ok(withDuplicate.driveDiscs.length >= 3, "merge import should keep old discs when removeMissing is false")

    await saveUserDriveDiscStore(tempDir, {
        version: 1,
        updatedAt: null,
        owners: [
            { id: "default", label: "默认用户" },
            { id: "alt", label: "Alt" },
        ],
        imports: [],
        driveDiscs: [
            ...withDuplicate.driveDiscs,
            {
                id: "manual-delete-me",
                ownerId: "default",
                setId: "manual",
                setName: "手动",
                partition: 6,
                rarity: "S",
                level: 15,
                mainStat: { stat: "critRate", value: 24, mode: "pct" },
                subStats: [],
                source: { type: "manual" },
            },
            {
                id: "alt-keep-me",
                ownerId: "alt",
                setId: "manual",
                setName: "其他账号",
                partition: 1,
                rarity: "S",
                level: 15,
                mainStat: { stat: "hpFlat", value: 2200, mode: "flat" },
                subStats: [],
                source: { type: "manual" },
            },
        ],
        driveDiscLoadouts: [
            {
                id: "loadout-1",
                agentId: "ye_shunguang",
                ownerId: "default",
                name: "引用删除盘",
                driveDiscIdsBySlot: {
                    1: withDuplicate.driveDiscs[0].id,
                    6: "manual-delete-me",
                },
                source: { type: "manual" },
            },
        ],
    })

    const removed = await importScannerExportToStore(tempDir, [
        scannerDisc(1),
    ], { ownerId: "default", sourcePath: "remove.json", removeMissing: true })
    assert.equal(removed.driveDiscs.some(item => item.id === "manual-delete-me"), false)
    assert.equal(removed.driveDiscs.some(item => item.id === "alt-keep-me"), true)
    assert.ok(removed.lastImportSummary.removed >= 1)
    const loadout = removed.driveDiscLoadouts.find(item => item.id === "loadout-1")
    assert.ok(loadout)
    assert.equal(loadout.driveDiscIdsBySlot["6"], undefined)
    assert.equal(loadout.status, "incomplete")

    await writeFile(path.join(tempDir, "user_drive_discs.json"), JSON.stringify({
        version: 1,
        driveDiscs: [
            {
                id: "legacy",
                ownerId: "default",
                setId: "astral_voice",
                setName: "流光咏叹",
                partition: 1,
                rarity: "S",
                level: 15,
                mainStat: { stat: "hpFlat", value: 2200, mode: "flat" },
                subStats: [],
            },
        ],
    }), "utf8")
    const legacy = await loadUserDriveDiscStore(tempDir)
    assert.ok(legacy.driveDiscs[0].contentFingerprint)
    assert.ok(legacy.driveDiscs[0].identityFingerprint)
} finally {
    await rm(tempDir, { recursive: true, force: true })
}
